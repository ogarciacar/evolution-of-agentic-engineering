import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_BASE_URL = "https://agenticengineering.science";
const DEFAULT_QUERIES = new URL("./evaluation-queries.json", import.meta.url);
const DEFAULT_JUDGMENTS = new URL("./precision-judgments.json", import.meta.url);
const DEFAULT_ATTEMPTS = 1;

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function positiveInteger(name, fallback) {
  const raw = arg(name);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function cleanCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function normalizePath(value, baseUrl = DEFAULT_BASE_URL) {
  const url = new URL(value, baseUrl);
  let path = url.pathname;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path;
}

function validateQueries(corpus) {
  if (corpus?.version !== 1 || !Array.isArray(corpus.queries) || corpus.queries.length === 0) {
    throw new Error("evaluation query corpus must be version 1 with a non-empty queries array");
  }
  const ids = new Set();
  for (const item of corpus.queries) {
    if (!/^Q\d{2}$/.test(item?.id ?? "")) throw new Error(`invalid query id: ${item?.id}`);
    if (ids.has(item.id)) throw new Error(`duplicate query id: ${item.id}`);
    ids.add(item.id);
    if (!String(item?.query ?? "").trim()) throw new Error(`empty query for ${item.id}`);
  }
  return ids;
}

function validateJudgments(data, queryIds) {
  if (data?.version !== 1 || !Array.isArray(data.judgments) || data.judgments.length === 0) {
    throw new Error("precision judgments must be version 1 with a non-empty judgments array");
  }
  const ids = new Set();
  for (const judgment of data.judgments) {
    if (!queryIds.has(judgment?.id)) throw new Error(`precision judgment has unknown query id: ${judgment?.id}`);
    if (ids.has(judgment.id)) throw new Error(`duplicate precision judgment id: ${judgment.id}`);
    ids.add(judgment.id);
    if (!Array.isArray(judgment.relevant_paths) || judgment.relevant_paths.length === 0) {
      throw new Error(`precision judgment ${judgment.id} must define relevant_paths`);
    }
    for (const path of judgment.relevant_paths) {
      if (!String(path).startsWith("/")) throw new Error(`precision judgment ${judgment.id} contains a non-path source: ${path}`);
    }
  }
  for (const id of queryIds) {
    if (!ids.has(id)) throw new Error(`missing precision judgment for ${id}`);
  }
  if (ids.size !== queryIds.size) throw new Error("precision judgments must cover the query corpus exactly");
}

async function runQuery(baseUrl, item, relevantPaths, attempt) {
  const endpoint = new URL("/api/search", baseUrl);
  endpoint.searchParams.set("q", item.query);
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return { ...item, attempt, error: `HTTP ${response.status}`, results: [], firstRelevantRank: null };
    }
    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const firstRelevantIndex = results.findIndex((result) => {
      try {
        return relevantPaths.has(normalizePath(result?.url ?? "", baseUrl));
      } catch {
        return false;
      }
    });
    return {
      ...item,
      attempt,
      results,
      firstRelevantRank: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
    };
  } catch (error) {
    return {
      ...item,
      attempt,
      error: error?.message ?? "request failed",
      results: [],
      firstRelevantRank: null,
    };
  }
}

function metrics(runs) {
  const total = runs.length;
  const hit1Count = runs.filter((run) => run.firstRelevantRank === 1).length;
  const hit5Count = runs.filter((run) => run.firstRelevantRank != null && run.firstRelevantRank <= 5).length;
  const reciprocalRankSum = runs.reduce((sum, run) => sum + (run.firstRelevantRank ? 1 / run.firstRelevantRank : 0), 0);
  return {
    total,
    hit1Count,
    hit5Count,
    hit1: total ? hit1Count / total : 0,
    hit5: total ? hit5Count / total : 0,
    mrr: total ? reciprocalRankSum / total : 0,
    misses: total - hit5Count,
    errors: runs.filter((run) => run.error).length,
    zeros: runs.filter((run) => !run.error && run.results.length === 0).length,
  };
}

function formatMetric(value) {
  return value.toFixed(3);
}

function representativeRun(runs) {
  return runs.find((run) => !run.error && run.results.length > 0) ?? runs[0];
}

function renderReport(baseUrl, queryItems, judgmentsById, attempts, runs) {
  const overall = metrics(runs);
  const lines = [
    "# AI Search precision benchmark",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Endpoint: ${baseUrl.replace(/\/$/, "")}/api/search`,
    `Attempts per query: ${attempts}`,
    "",
    "This benchmark uses explicit, human-reviewable binary relevance judgments. It does not change retrieval, rerank results locally, or use an LLM to judge relevance.",
    "",
    "## Precision metrics",
    "",
    `- Query-attempts: ${overall.total}`,
    `- Hit@1: ${formatMetric(overall.hit1)} (${overall.hit1Count}/${overall.total})`,
    `- Hit@5: ${formatMetric(overall.hit5)} (${overall.hit5Count}/${overall.total})`,
    `- MRR: ${formatMetric(overall.mrr)}`,
    `- No relevant result in top 5: ${overall.misses}`,
    `- Request/API errors: ${overall.errors}`,
    `- Zero-result attempts: ${overall.zeros}`,
    "",
    "| ID | Hit@1 | Hit@5 | MRR | First relevant ranks |",
    "| --- | ---: | ---: | ---: | --- |",
  ];

  for (const item of queryItems) {
    const queryRuns = runs.filter((run) => run.id === item.id);
    const summary = metrics(queryRuns);
    const ranks = queryRuns.map((run) => run.firstRelevantRank ?? "—").join(", ");
    lines.push(`| ${item.id} | ${formatMetric(summary.hit1)} | ${formatMetric(summary.hit5)} | ${formatMetric(summary.mrr)} | ${ranks} |`);
  }

  for (const item of queryItems) {
    const judgment = judgmentsById.get(item.id);
    const relevantPaths = new Set(judgment.relevant_paths.map((path) => normalizePath(path, baseUrl)));
    const queryRuns = runs.filter((run) => run.id === item.id);
    const representative = representativeRun(queryRuns);

    lines.push("", `## ${item.id} — ${item.query}`, "");
    lines.push(`Judgment rationale: ${judgment.rationale ?? ""}`, "", "Relevant source paths:");
    for (const path of judgment.relevant_paths) lines.push(`- \`${path}\``);

    lines.push("", `Representative ranked output: attempt ${representative.attempt}.`, "");
    if (representative.error) {
      lines.push(`Request error: ${representative.error}`);
      continue;
    }
    if (!representative.results.length) {
      lines.push("No results returned.");
      continue;
    }

    lines.push("| Rank | Relevant | Title | Source | Score |", "| ---: | --- | --- | --- | ---: |");
    representative.results.forEach((result, index) => {
      let path = "";
      try {
        path = normalizePath(result?.url ?? "", baseUrl);
      } catch {
        path = String(result?.url ?? "");
      }
      const relevant = relevantPaths.has(path) ? "yes" : "no";
      lines.push(`| ${index + 1} | ${relevant} | ${cleanCell(result?.title || "Untitled result")} | ${cleanCell(path)} | ${result?.score ?? "n/a"} |`);
    });
  }

  lines.push(
    "",
    "## Interpretation",
    "",
    "- `Hit@1` measures whether the first result is in the accepted relevance set.",
    "- `Hit@5` measures whether at least one accepted source appears in the first five results.",
    "- `MRR` rewards relevant results that appear earlier in the ranking; a miss contributes 0.",
    "- Errors and zero-result attempts count as misses for precision metrics rather than being excluded.",
    "",
    "The v1 judgments are a deliberately small seed benchmark, not exhaustive ground truth. Changes to the judgment set change the benchmark itself and should be reviewed separately from retrieval changes.",
    "",
  );

  return lines.join("\n");
}

const baseUrl = arg("--base-url") ?? DEFAULT_BASE_URL;
const output = arg("--output");
const attempts = positiveInteger("--attempts", DEFAULT_ATTEMPTS);
const queriesPath = arg("--queries") ? resolve(arg("--queries")) : DEFAULT_QUERIES;
const judgmentsPath = arg("--judgments") ? resolve(arg("--judgments")) : DEFAULT_JUDGMENTS;

const corpus = JSON.parse(await readFile(queriesPath, "utf8"));
const queryIds = validateQueries(corpus);
const judgmentData = JSON.parse(await readFile(judgmentsPath, "utf8"));
validateJudgments(judgmentData, queryIds);
const judgmentsById = new Map(judgmentData.judgments.map((judgment) => [judgment.id, judgment]));

const runs = [];
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  for (const item of corpus.queries) {
    const relevantPaths = new Set(judgmentsById.get(item.id).relevant_paths.map((path) => normalizePath(path, baseUrl)));
    runs.push(await runQuery(baseUrl, item, relevantPaths, attempt));
  }
}

const report = renderReport(baseUrl, corpus.queries, judgmentsById, attempts, runs);
if (output) {
  const path = resolve(output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, report, "utf8");
  console.log(`Wrote ${path}`);
} else {
  console.log(report);
}
