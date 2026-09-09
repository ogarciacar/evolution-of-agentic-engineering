import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_BASE_URL = "https://agenticengineering.science";
const DEFAULT_QUERIES = new URL("./evaluation-queries.json", import.meta.url);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
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

async function runQuery(baseUrl, item) {
  const endpoint = new URL("/api/search", baseUrl);
  endpoint.searchParams.set("q", item.query);
  const started = performance.now();
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return { ...item, latencyMs, error: `HTTP ${response.status}`, results: [], diagnostics: analyzeResults([]) };
    }
    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return { ...item, latencyMs, results, diagnostics: analyzeResults(results) };
  } catch (error) {
    return { ...item, latencyMs: Math.round(performance.now() - started), error: error?.message ?? "request failed", results: [], diagnostics: analyzeResults([]) };
  }
}

function renderReport(baseUrl, runs) {
  const duplicateQueries = runs.filter((run) => run.diagnostics.duplicateSources > 0).length;
  const zeroQueries = runs.filter((run) => run.diagnostics.resultCount === 0 && !run.error).length;
  const errorQueries = runs.filter((run) => run.error).length;
  const offSiteResults = runs.reduce((sum, run) => sum + run.diagnostics.offSite, 0);
  const missingTitles = runs.reduce((sum, run) => sum + run.diagnostics.missingTitles, 0);

  const lines = [
    "# AI Search retrieval evaluation",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Endpoint: ${baseUrl.replace(/\/$/, "")}/api/search`,
    "",
    "This report records retrieval output only. It does not assign semantic relevance scores or change retrieval configuration.",
    "",
    "## Mechanical diagnostics",
    "",
    `- Queries: ${runs.length}`,
    `- Queries with zero results: ${zeroQueries}`,
    `- Queries with request/API errors: ${errorQueries}`,
    `- Queries with duplicate source pages in the top results: ${duplicateQueries}`,
    `- Off-site source URLs returned: ${offSiteResults}`,
    `- Results with missing titles: ${missingTitles}`,
    "",
    "| ID | Results | Unique sources | Duplicate sources | Latency | Error |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const run of runs) {
    lines.push(`| ${run.id} | ${run.diagnostics.resultCount} | ${run.diagnostics.uniqueSourceCount} | ${run.diagnostics.duplicateSources} | ${run.latencyMs} ms | ${cleanCell(run.error ?? "")} |`);
  }

  for (const run of runs) {
    lines.push("", `## ${run.id} — ${run.query}`, "");
    if (run.error) {
      lines.push(`Request error: ${run.error}`);
      continue;
    }
    if (!run.results.length) {
      lines.push("No results returned.");
      continue;
    }
    run.results.forEach((result, index) => {
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
    "## Interpretation checklist",
    "",
    "Review the report manually for:",
    "",
    "- irrelevant results",
    "- duplicate results from the same source page",
    "- missing important evidence",
    "- navigation/footer contamination",
    "- signal pages dominating other useful research surfaces",
    "- weak source titles",
    "- poor chunk boundaries",
    "",
    "Do not tune retrieval until these observations are reviewed.",
    "",
  );
  return lines.join("\n");
}

const baseUrl = arg("--base-url") ?? DEFAULT_BASE_URL;
const output = arg("--output");
const corpusPath = arg("--queries") ? resolve(arg("--queries")) : DEFAULT_QUERIES;
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
validateCorpus(corpus);

const runs = [];
for (const item of corpus.queries) runs.push(await runQuery(baseUrl, item));
const report = renderReport(baseUrl, runs);

if (output) {
  const path = resolve(output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, report, "utf8");
  console.log(`Wrote ${path}`);
} else {
  console.log(report);
}
