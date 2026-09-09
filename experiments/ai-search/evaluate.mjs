import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_BASE_URL = "https://agenticengineering.science";
const DEFAULT_QUERIES = new URL("./evaluation-queries.json", import.meta.url);
const DEFAULT_ATTEMPTS = 1;
const DEFAULT_SLOW_MS = 7000;

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

function short(value, max = 180) {
  const text = cleanCell(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function validateCorpus(corpus) {
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
}

function analyzeResults(results) {
  const safe = Array.isArray(results) ? results : [];
  const urls = safe.map((result) => String(result?.url ?? "")).filter(Boolean);
  const uniqueUrls = new Set(urls);
  const duplicateSources = urls.length - uniqueUrls.size;
  const missingTitles = safe.filter((result) => !String(result?.title ?? "").trim()).length;
  const offSite = urls.filter((value) => {
    try {
      return new URL(value).origin !== "https://agenticengineering.science";
    } catch {
      return true;
    }
  }).length;
  return {
    resultCount: safe.length,
    uniqueSourceCount: uniqueUrls.size,
    duplicateSources,
    missingTitles,
    offSite,
  };
}

async function runQuery(baseUrl, item, attempt) {
  const endpoint = new URL("/api/search", baseUrl);
  endpoint.searchParams.set("q", item.query);
  const started = performance.now();
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return { ...item, attempt, latencyMs, error: `HTTP ${response.status}`, results: [], diagnostics: analyzeResults([]) };
    }
    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return { ...item, attempt, latencyMs, results, diagnostics: analyzeResults(results) };
  } catch (error) {
    return {
      ...item,
      attempt,
      latencyMs: Math.round(performance.now() - started),
      error: error?.message ?? "request failed",
      results: [],
      diagnostics: analyzeResults([]),
    };
  }
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function classifyQuery(runs, slowMs) {
  const nonZero = runs.filter((run) => !run.error && run.diagnostics.resultCount > 0).length;
  const zero = runs.filter((run) => !run.error && run.diagnostics.resultCount === 0).length;
  const errors = runs.filter((run) => run.error).length;
  const slow = runs.filter((run) => run.latencyMs >= slowMs).length;

  let classification;
  if (errors === runs.length) classification = "persistent-error";
  else if (errors > 0) classification = "transient-error";
  else if (zero === runs.length) classification = "persistent-zero";
  else if (zero > 0) classification = "transient-zero";
  else classification = "stable-nonzero";

  const latencies = runs.map((run) => run.latencyMs);
  return {
    classification,
    nonZero,
    zero,
    errors,
    slow,
    minLatencyMs: Math.min(...latencies),
    medianLatencyMs: median(latencies),
    maxLatencyMs: Math.max(...latencies),
  };
}

function stateFor(run, slowMs) {
  if (run.error) return run.latencyMs >= slowMs ? "error + slow" : "error";
  if (run.diagnostics.resultCount === 0) return run.latencyMs >= slowMs ? "zero + slow" : "zero";
  return run.latencyMs >= slowMs ? "nonzero + slow" : "nonzero";
}

function representativeRun(runs) {
  return runs.find((run) => !run.error && run.diagnostics.resultCount > 0) ?? runs[runs.length - 1];
}

function renderReport(baseUrl, queryItems, attempts, slowMs, runs) {
  const byQuery = new Map(queryItems.map((item) => [item.id, runs.filter((run) => run.id === item.id)]));
  const summaries = queryItems.map((item) => ({ item, runs: byQuery.get(item.id), summary: classifyQuery(byQuery.get(item.id), slowMs) }));

  const totalAttempts = runs.length;
  const nonZeroAttempts = runs.filter((run) => !run.error && run.diagnostics.resultCount > 0).length;
  const zeroAttempts = runs.filter((run) => !run.error && run.diagnostics.resultCount === 0).length;
  const errorAttempts = runs.filter((run) => run.error).length;
  const slowAttempts = runs.filter((run) => run.latencyMs >= slowMs).length;
  const duplicateAttempts = runs.filter((run) => run.diagnostics.duplicateSources > 0).length;
  const offSiteResults = runs.reduce((sum, run) => sum + run.diagnostics.offSite, 0);
  const missingTitles = runs.reduce((sum, run) => sum + run.diagnostics.missingTitles, 0);
  const latencies = runs.map((run) => run.latencyMs);

  const classificationCounts = new Map();
  for (const { summary } of summaries) {
    classificationCounts.set(summary.classification, (classificationCounts.get(summary.classification) ?? 0) + 1);
  }

  const lines = [
    "# AI Search retrieval reliability",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Endpoint: ${baseUrl.replace(/\/$/, "")}/api/search`,
    `Attempts per query: ${attempts}`,
    `Slow threshold: ${slowMs} ms`,
    "",
    "This report observes repeated production retrieval. It does not retry visitor requests, change ranking, or assign semantic relevance scores.",
    "",
    "## Reliability diagnostics",
    "",
    `- Queries: ${queryItems.length}`,
    `- Total attempts: ${totalAttempts}`,
    `- Non-zero attempts: ${nonZeroAttempts}`,
    `- Zero-result attempts: ${zeroAttempts}`,
    `- Request/API error attempts: ${errorAttempts}`,
    `- Slow attempts (>= ${slowMs} ms): ${slowAttempts}`,
    `- Stable non-zero queries: ${classificationCounts.get("stable-nonzero") ?? 0}`,
    `- Transient-zero queries: ${classificationCounts.get("transient-zero") ?? 0}`,
    `- Persistent-zero queries: ${classificationCounts.get("persistent-zero") ?? 0}`,
    `- Transient-error queries: ${classificationCounts.get("transient-error") ?? 0}`,
    `- Persistent-error queries: ${classificationCounts.get("persistent-error") ?? 0}`,
    `- Attempts with duplicate source pages: ${duplicateAttempts}`,
    `- Off-site source URLs returned: ${offSiteResults}`,
    `- Results with missing titles: ${missingTitles}`,
    `- Latency P50: ${percentile(latencies, 0.5)} ms`,
    `- Latency P90: ${percentile(latencies, 0.9)} ms`,
    `- Latency max: ${Math.max(...latencies)} ms`,
    "",
    "| ID | Classification | Non-zero | Zero | Errors | Slow | Latency min / median / max |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const { item, summary } of summaries) {
    lines.push(`| ${item.id} | ${summary.classification} | ${summary.nonZero} | ${summary.zero} | ${summary.errors} | ${summary.slow} | ${summary.minLatencyMs} / ${summary.medianLatencyMs} / ${summary.maxLatencyMs} ms |`);
  }

  for (const { item, runs: queryRuns, summary } of summaries) {
    lines.push("", `## ${item.id} — ${item.query}`, "", `Reliability classification: **${summary.classification}**`, "");
    lines.push("| Attempt | State | Results | Unique sources | Latency | Error |", "| ---: | --- | ---: | ---: | ---: | --- |");
    for (const run of queryRuns) {
      lines.push(`| ${run.attempt} | ${stateFor(run, slowMs)} | ${run.diagnostics.resultCount} | ${run.diagnostics.uniqueSourceCount} | ${run.latencyMs} ms | ${cleanCell(run.error ?? "")} |`);
    }

    const representative = representativeRun(queryRuns);
    lines.push("", `Representative retrieval output: attempt ${representative.attempt}.`, "");
    if (representative.error) {
      lines.push(`Request error: ${representative.error}`);
      continue;
    }
    if (!representative.results.length) {
      lines.push("No results returned in any usable representative attempt.");
      continue;
    }
    representative.results.forEach((result, index) => {
      lines.push(
        `### ${index + 1}. ${String(result?.title ?? "").trim() || "Untitled result"}`,
        "",
        `- Score: ${result?.score ?? "n/a"}`,
        `- Source: ${result?.url ?? ""}`,
        `- Excerpt: ${short(result?.excerpt)}`,
        "",
      );
    });
  }

  lines.push(
    "## Reliability interpretation",
    "",
    "Use the classifications to separate retrieval quality from service reliability:",
    "",
    "- `stable-nonzero`: every attempt returned one or more results.",
    "- `transient-zero`: at least one attempt returned zero results and another returned results.",
    "- `persistent-zero`: every attempt returned zero results without an HTTP/API error.",
    "- `transient-error`: at least one attempt had an HTTP/API error while another attempt did not.",
    "- `persistent-error`: every attempt failed with an HTTP/API error.",
    "",
    "A transient zero is evidence of inconsistent production retrieval for an unchanged query; it is not treated as a relevance judgement and is not hidden by an automatic visitor retry.",
    "",
  );
  return lines.join("\n");
}

const baseUrl = arg("--base-url") ?? DEFAULT_BASE_URL;
const output = arg("--output");
const attempts = positiveInteger("--attempts", DEFAULT_ATTEMPTS);
const slowMs = positiveInteger("--slow-ms", DEFAULT_SLOW_MS);
const corpusPath = arg("--queries") ? resolve(arg("--queries")) : DEFAULT_QUERIES;
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
validateCorpus(corpus);

const runs = [];
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  for (const item of corpus.queries) runs.push(await runQuery(baseUrl, item, attempt));
}
const report = renderReport(baseUrl, corpus.queries, attempts, slowMs, runs);

if (output) {
  const path = resolve(output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, report, "utf8");
  console.log(`Wrote ${path}`);
} else {
  console.log(report);
}
