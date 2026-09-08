import { CONDITIONS, STAGES, getHomepageEvidence } from "./_lib/evidence-read-model.js";
import { PROJECTION_HEADER, applyProjectionHeaders, projectionFromRequest } from "./_lib/evidence-projection.js";

const GRID_START = "<!-- HOMEPAGE_EVIDENCE_START -->";
const GRID_END = "<!-- HOMEPAGE_EVIDENCE_END -->";
const MAX_ROWS = 24;

function esc(value, quote = false) {
  let out = String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  if (quote) out = out.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  return out;
}

function shortDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return `${new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date).toUpperCase()} ${date.getUTCDate()}`;
}

function monthYear(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return { month: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date), year: date.getUTCFullYear() };
}

function dateRange(records) {
  const ordered = [...records].sort((a, b) => a.source.date.localeCompare(b.source.date));
  const first = monthYear(ordered[0].source.date);
  const last = monthYear(ordered[ordered.length - 1].source.date);
  return first.year === last.year ? `${first.month}–${last.month} ${first.year}` : `${first.month} ${first.year}–${last.month} ${last.year}`;
}

function transitionTarget(evidence, stage) {
  return Boolean(evidence.mapping.transition && evidence.mapping.transition.to === stage);
}

function adjacentStage(evidence, stage) {
  return Boolean(evidence.mapping.transition && evidence.mapping.transition.adjacent_stage === stage);
}

function renderStageCell(evidence, stage) {
  if (!evidence.mapping.stages.includes(stage)) return '<span class="landscape-cell" aria-hidden="true"></span>';
  const arrow = transitionTarget(evidence, stage) ? '<span class="landscape-arrow">→</span>' : "";
  const marker = adjacentStage(evidence, stage) ? "landscape-ring" : "landscape-dot";
  return `<span class="landscape-cell" aria-hidden="true">${arrow}<i class="${marker}"></i></span>`;
}

function renderConditionCell(evidence, condition) {
  const marker = evidence.mapping.conditions.includes(condition) ? '<i class="landscape-square"></i>' : "";
  return `<span class="landscape-cell" aria-hidden="true">${marker}</span>`;
}

function renderMobileStage(evidence, stage) {
  if (!evidence.mapping.stages.includes(stage)) return "";
  const marker = adjacentStage(evidence, stage) ? "○" : "●";
  const arrow = transitionTarget(evidence, stage) ? '<span class="landscape-mobile-transition">→</span>' : "";
  return `${arrow}<span class="landscape-mobile-pill landscape-mobile-stage">${marker} ${esc(stage)}</span>`;
}

function renderMobileSignal(evidence) {
  const stages = STAGES.map((stage) => renderMobileStage(evidence, stage)).filter(Boolean).join("");
  const conditions = CONDITIONS.filter((condition) => evidence.mapping.conditions.includes(condition))
    .map((condition) => `<span class="landscape-mobile-pill landscape-mobile-condition">■ ${esc(condition)}</span>`).join("");
  const verdict = String(evidence.model_implication.verdict || "");
  return `<a class="landscape-mobile-row" href="signals/${esc(evidence.id, true)}/"><span class="landscape-mobile-meta"><span>${shortDate(evidence.source.date)}</span><strong>${esc(evidence.source.producer)}</strong></span><span class="landscape-mobile-headline">${esc(evidence.presentation.headline)}</span><span class="landscape-mobile-mapping">${stages}${conditions}</span><span class="landscape-mobile-verdict ${esc(verdict.toLowerCase(), true)}">${esc(verdict)}</span></a>`;
}

function renderRow(evidence) {
  const tooltip = `${evidence.presentation.headline} — ${evidence.scale.label}: ${String(evidence.scale.summary || "").replace(/\s+/g, " ").trim()}`;
  const stageCells = STAGES.map((stage) => renderStageCell(evidence, stage)).join("");
  const conditionCells = CONDITIONS.map((condition) => renderConditionCell(evidence, condition)).join("");
  const verdict = String(evidence.model_implication.verdict || "");
  return `<a class="landscape-row" href="signals/${esc(evidence.id, true)}/" title="${esc(tooltip, true)}"><span class="landscape-source"><span class="landscape-date">${shortDate(evidence.source.date)}</span><strong>${esc(evidence.source.producer)}</strong></span>${stageCells}<span class="landscape-divider" aria-hidden="true"></span>${conditionCells}<span class="landscape-verdict ${esc(verdict.toLowerCase(), true)}">${esc(verdict)}</span></a>`;
}

function countMapping(records, field, value) {
  return records.reduce((count, evidence) => count + evidence.mapping[field].includes(value), 0);
}

function renderChart(records, total) {
  if (!records.length) return null;
  const subtitle = total <= MAX_ROWS
    ? `${records.length} accepted evidence records · ${dateRange(records)}`
    : `${records.length} of ${total} accepted evidence records · ${dateRange(records)}`;
  const stageHeaders = STAGES.map((stage) => `<span class="landscape-column-label"><b>${esc(stage)}</b><small>${countMapping(records, "stages", stage)}</small></span>`).join("");
  const conditionHeaders = CONDITIONS.map((condition) => `<span class="landscape-column-label"><b>${esc(condition)}</b><small>${countMapping(records, "conditions", condition)}</small></span>`).join("");
  const rows = records.map(renderRow).join("");
  const mobileRows = records.map(renderMobileSignal).join("");
  return `<style>.landscape-mobile{display:none}@media(max-width:1119px){.landscape-scroll,.landscape-legend{display:none}.landscape-mobile{display:block}.landscape-mobile-row{display:block;padding:20px 24px;border-top:1px solid var(--line);color:inherit;text-decoration:none}.landscape-mobile-row:first-child{border-top:0}.landscape-mobile-meta{display:flex;gap:10px;align-items:baseline}.landscape-mobile-meta>span{font-size:11px;color:var(--muted);white-space:nowrap}.landscape-mobile-meta strong{font-size:13px}.landscape-mobile-headline{display:block;margin-top:6px;font-size:13px;line-height:1.4;font-weight:500}.landscape-mobile-mapping{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:12px;font-size:11px;line-height:1.2;color:var(--muted)}.landscape-mobile-pill{display:inline-flex;align-items:center;min-height:26px;padding:4px 10px;border-radius:999px;background:#f3f3f5;white-space:nowrap}.landscape-mobile-stage{color:var(--muted)}.landscape-mobile-condition{color:var(--muted)}.landscape-mobile-transition{display:inline-flex;align-items:center;padding:0 1px;font-size:18px;line-height:1;color:var(--accent)}.landscape-mobile-verdict{display:block;margin-top:14px;font-size:10px;font-weight:700;letter-spacing:.06em}.landscape-mobile-legend{display:flex;flex-wrap:wrap;gap:6px 12px;padding:16px 24px 20px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}}</style><div class="landscape-card"><div class="landscape-card-head"><div><strong>Scale Signal Landscape</strong><span>${esc(subtitle)}</span></div></div><div class="landscape-scroll"><div class="landscape-matrix"><div class="landscape-groups"><span></span><b class="landscape-model-group">Evolutionary model</b><span></span><b class="landscape-conditions-group">Selection conditions</b><b class="landscape-implication-group">Model implication</b></div><div class="landscape-columns"><span></span>${stageHeaders}<span class="landscape-divider" aria-hidden="true"></span>${conditionHeaders}<span></span></div>${rows}</div></div><div class="landscape-legend"><span><i class="landscape-dot"></i> stage mapped</span><span><i class="landscape-ring"></i> adjacent stage signal</span><span><i class="landscape-square"></i> Selection condition mapped</span><span>→ explicit transition in canonical evidence mapping</span><span><b>SUPPORTS / REFINES</b> model implication</span></div><div class="landscape-mobile">${mobileRows}<div class="landscape-mobile-legend"><span>● stage</span><span>○ adjacent stage</span><span>→ transition</span><span>■ selection condition</span></div></div></div>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();

  const projection = projectionFromRequest(request);
  if (projection.error) {
    return new Response(projection.error, {
      status: 400,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Projection-Header": PROJECTION_HEADER },
    });
  }

  const staticResponse = await context.next();
  if (!env.EVIDENCE_DB || request.method === "HEAD" || !staticResponse.ok) return staticResponse;

  try {
    const { records, total } = await getHomepageEvidence(env, MAX_ROWS, projection.id);
    const chart = renderChart(records, total);
    if (!chart) {
      const headers = new Headers(staticResponse.headers);
      applyProjectionHeaders(headers, projection.id);
      return new Response(staticResponse.body, { status: staticResponse.status, statusText: staticResponse.statusText, headers });
    }

    const html = await staticResponse.text();
    const start = html.indexOf(GRID_START);
    const end = html.indexOf(GRID_END);
    if (start === -1 || end === -1 || end < start) return new Response(html, staticResponse);

    const body = html.slice(0, start + GRID_START.length) + chart + html.slice(end);
    const headers = new Headers(staticResponse.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=60");
    headers.set("X-Evidence-Landscape-Source", "d1");
    applyProjectionHeaders(headers, projection.id);
    headers.delete("Content-Length");
    return new Response(body, { status: staticResponse.status, statusText: staticResponse.statusText, headers });
  } catch {
    return staticResponse;
  }
}
