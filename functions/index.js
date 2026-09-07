const GRID_START = "<!-- HOMEPAGE_EVIDENCE_START -->";
const GRID_END = "<!-- HOMEPAGE_EVIDENCE_END -->";
const MAX_ROWS = 24;
const STAGES = ["Apparition", "Selection", "Cooperation", "Specialization"];
const CONDITIONS = ["Context", "Execution", "Verification", "Coordination", "Observability", "Economics", "Learning"];

function esc(value, quote = false) {
  let out = String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  if (quote) out = out.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  return out;
}

function parseJson(value) {
  return value ? JSON.parse(value) : [];
}

function shortDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return `${new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date).toUpperCase()} ${date.getUTCDate()}`;
}

function monthYear(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return {
    month: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date),
    year: date.getUTCFullYear(),
  };
}

function dateRange(records) {
  const ordered = [...records].sort((a, b) => a.source_date.localeCompare(b.source_date));
  const first = monthYear(ordered[0].source_date);
  const last = monthYear(ordered[ordered.length - 1].source_date);
  return first.year === last.year ? `${first.month}–${last.month} ${first.year}` : `${first.month} ${first.year}–${last.month} ${last.year}`;
}

function stages(row) { return parseJson(row.stages_json); }
function conditions(row) { return parseJson(row.conditions_json); }

function transitionTarget(row, stage) {
  return Boolean((row.transition_from || row.transition_to || row.adjacent_stage) && row.transition_to === stage);
}

function adjacentStage(row, stage) {
  return Boolean((row.transition_from || row.transition_to || row.adjacent_stage) && row.adjacent_stage === stage);
}

function renderStageCell(row, stage) {
  if (!stages(row).includes(stage)) return '<span class="landscape-cell" aria-hidden="true"></span>';
  const arrow = transitionTarget(row, stage) ? '<span class="landscape-arrow">→</span>' : "";
  const marker = adjacentStage(row, stage) ? "landscape-ring" : "landscape-dot";
  return `<span class="landscape-cell" aria-hidden="true">${arrow}<i class="${marker}"></i></span>`;
}

function renderConditionCell(row, condition) {
  const marker = conditions(row).includes(condition) ? '<i class="landscape-square"></i>' : "";
  return `<span class="landscape-cell" aria-hidden="true">${marker}</span>`;
}

function renderRow(row) {
  const tooltip = `${row.headline} — ${row.scale_label}: ${String(row.scale_summary || "").replace(/\s+/g, " ").trim()}`;
  const stageCells = STAGES.map((stage) => renderStageCell(row, stage)).join("");
  const conditionCells = CONDITIONS.map((condition) => renderConditionCell(row, condition)).join("");
  const verdict = String(row.verdict || "");
  return `<a class="landscape-row" href="signals/${esc(row.evidence_id, true)}/" title="${esc(tooltip, true)}"><span class="landscape-source"><span class="landscape-date">${shortDate(row.source_date)}</span><strong>${esc(row.producer)}</strong></span>${stageCells}<span class="landscape-divider" aria-hidden="true"></span>${conditionCells}<span class="landscape-verdict ${esc(verdict.toLowerCase(), true)}">${esc(verdict)}</span></a>`;
}

function countMapping(records, field, value) {
  return records.reduce((count, row) => count + (field === "stages" ? stages(row) : conditions(row)).includes(value), 0);
}

function renderChart(records, total) {
  if (!records.length) return null;
  const subtitle = total <= MAX_ROWS
    ? `${records.length} accepted evidence records · ${dateRange(records)}`
    : `${records.length} of ${total} accepted evidence records · ${dateRange(records)}`;
  const stageHeaders = STAGES.map((stage) => `<span class="landscape-column-label"><b>${esc(stage)}</b><small>${countMapping(records, "stages", stage)}</small></span>`).join("");
  const conditionHeaders = CONDITIONS.map((condition) => `<span class="landscape-column-label"><b>${esc(condition)}</b><small>${countMapping(records, "conditions", condition)}</small></span>`).join("");
  const rows = records.map(renderRow).join("");
  return `<div class="landscape-card"><div class="landscape-card-head"><div><strong>Scale Signal Landscape</strong><span>${esc(subtitle)}</span></div></div><div class="landscape-scroll"><div class="landscape-matrix"><div class="landscape-groups"><span></span><b class="landscape-model-group">Evolutionary model</b><span></span><b class="landscape-conditions-group">Selection conditions</b><b class="landscape-implication-group">Model implication</b></div><div class="landscape-columns"><span></span>${stageHeaders}<span class="landscape-divider" aria-hidden="true"></span>${conditionHeaders}<span></span></div>${rows}</div></div><div class="landscape-legend"><span><i class="landscape-dot"></i> stage mapped</span><span><i class="landscape-ring"></i> adjacent stage signal</span><span><i class="landscape-square"></i> Selection condition mapped</span><span>→ explicit transition in canonical evidence mapping</span><span><b>SUPPORTS / REFINES</b> model implication</span></div></div>`;
}

const SELECT = `
SELECT e.evidence_id, e.source_date, e.producer, e.headline, e.scale_label, e.scale_summary,
       e.verdict, e.transition_from, e.transition_to, e.adjacent_stage,
  (SELECT json_group_array(stage) FROM (SELECT stage FROM evidence_stages s WHERE s.evidence_id = e.evidence_id ORDER BY stage)) AS stages_json,
  (SELECT json_group_array(condition) FROM (SELECT condition FROM evidence_conditions c WHERE c.evidence_id = e.evidence_id ORDER BY condition)) AS conditions_json
FROM evidence e
ORDER BY e.source_date DESC, e.evidence_id ASC
LIMIT ${MAX_ROWS}`;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();

  const staticResponse = await context.next();
  if (!env.EVIDENCE_DB || request.method === "HEAD" || !staticResponse.ok) return staticResponse;

  try {
    const [{ results }, countRow] = await Promise.all([
      env.EVIDENCE_DB.prepare(SELECT).all(),
      env.EVIDENCE_DB.prepare("SELECT COUNT(*) AS count FROM evidence").first(),
    ]);
    const chart = renderChart(results || [], Number(countRow?.count || 0));
    if (!chart) return staticResponse;

    const html = await staticResponse.text();
    const start = html.indexOf(GRID_START);
    const end = html.indexOf(GRID_END);
    if (start === -1 || end === -1 || end < start) return new Response(html, staticResponse);

    const body = html.slice(0, start + GRID_START.length) + chart + html.slice(end);
    const headers = new Headers(staticResponse.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=60");
    headers.set("X-Evidence-Landscape-Source", "d1");
    headers.delete("Content-Length");
    return new Response(body, { status: staticResponse.status, statusText: staticResponse.statusText, headers });
  } catch {
    return staticResponse;
  }
}
