import { listPracticeObservations, PRACTICE_SELECTION_CONDITIONS } from "./_lib/practice-observation-read-model.js";
import { getPracticeAssessmentSummary } from "./_lib/practice-assessment-read-model.js";
import { PROJECTION_HEADER, applyProjectionHeaders, projectionFromRequest } from "./_lib/evidence-projection.js";

const START = "<!-- PRACTICE_OBSERVATIONS_START -->";
const END = "<!-- PRACTICE_OBSERVATIONS_END -->";

function esc(value, quote = false) {
  let out = String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  if (quote) out = out.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  return out;
}

function evidenceHref(observation) {
  const path = `/signals/${encodeURIComponent(observation.evidence_id)}/`;
  if (observation.projection_id === "main") return path;
  return `${path}?projection_id=${encodeURIComponent(observation.projection_id)}`;
}

function filterHref(condition, projectionId) {
  const params = new URLSearchParams();
  if (projectionId !== "main") params.set("projection_id", projectionId);
  if (condition) params.set("condition", condition);
  const query = params.toString();
  return query ? `/practices?${query}` : "/practices";
}

export function renderPracticeSummary(summary) {
  const metrics = [
    ["Evidence", summary.evidence],
    ["Assessed", summary.assessed],
    ["Pending", summary.pending],
    ["Observations", summary.observations],
    ["Coverage", `${summary.coverage}%`],
  ];
  return `<section class="corpus-summary" aria-label="Practice observation corpus assessment summary">${metrics.map(([label, value]) => `<div class="summary-metric"><span class="summary-value">${esc(value)}</span><span class="summary-label">${esc(label)}</span></div>`).join("")}</section><p class="assessment-note">Assessment coverage measures evidence records explicitly assessed for practice observations. Assessed evidence may legitimately contain zero observations.</p>`;
}

export function renderPracticeObservations(observations, selectedCondition = null, projectionId = "main", summary = null) {
  const summaryHtml = summary ? renderPracticeSummary(summary) : "";
  const filters = `<nav class="practice-filters" aria-label="Filter practice observations by selection condition"><a class="filter${selectedCondition ? "" : " active"}" href="${esc(filterHref(null, projectionId), true)}">All</a>${PRACTICE_SELECTION_CONDITIONS.map((condition) => `<a class="filter${selectedCondition === condition ? " active" : ""}" href="${esc(filterHref(condition, projectionId), true)}">${esc(condition)}</a>`).join("")}</nav>`;

  if (!observations.length) {
    const message = selectedCondition
      ? `No practice observations match the ${esc(selectedCondition)} selection condition.`
      : "No practice observations are available for this projection.";
    return `${summaryHtml}${filters}<div class="empty">${message}</div>`;
  }

  const rows = observations.map((observation) => {
    const conditions = observation.selection_conditions.map((condition) => `<span class="condition">${esc(condition)}</span>`).join("");
    const evidence = `<a class="evidence-link" href="${esc(evidenceHref(observation), true)}" aria-label="View evidence for ${esc(observation.company, true)}">Evidence →</a>`;
    return `<tr data-projection-id="${esc(observation.projection_id, true)}" data-evidence-id="${esc(observation.evidence_id, true)}" data-observation-id="${esc(observation.id, true)}"><td class="company">${esc(observation.company)}<div>${evidence}</div></td><td>${esc(observation.use_case)}</td><td>${esc(observation.problem)}</td><td>${esc(observation.reported_practice)}</td><td><span class="conditions">${conditions}</span></td></tr>`;
  }).join("");

  const countLabel = selectedCondition ? `${observations.length} practice observations · ${esc(selectedCondition)}` : `${observations.length} practice observations`;
  return `${summaryHtml}${filters}<p class="count">${countLabel}</p><div class="table-shell"><table class="practice-table"><thead><tr><th>Company</th><th>Specific use case being solved</th><th>Problem encountered</th><th>Reported practice</th><th>Selection condition</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();
  const projection = projectionFromRequest(request);
  if (projection.error) return new Response(projection.error, { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Projection-Header": PROJECTION_HEADER } });

  const url = new URL(request.url);
  const condition = url.searchParams.get("condition");
  if (condition && !PRACTICE_SELECTION_CONDITIONS.includes(condition)) return new Response(`Unknown selection condition: ${condition}`, { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

  const staticResponse = await context.next();
  if (!env.EVIDENCE_DB || request.method === "HEAD" || !staticResponse.ok) return staticResponse;

  try {
    const [observations, summary] = await Promise.all([
      listPracticeObservations(env, condition ? { condition } : {}, 500, projection.id),
      getPracticeAssessmentSummary(env, projection.id),
    ]);
    const rendered = renderPracticeObservations(observations, condition, projection.id, summary);
    const html = await staticResponse.text();
    const start = html.indexOf(START);
    const end = html.indexOf(END);
    if (start === -1 || end === -1 || end < start) return new Response(html, staticResponse);

    const body = html.slice(0, start + START.length) + rendered + html.slice(end);
    const headers = new Headers(staticResponse.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=60");
    headers.set("X-Practice-Observations-Source", "d1");
    applyProjectionHeaders(headers, projection.id);
    headers.delete("Content-Length");
    return new Response(body, { status: staticResponse.status, statusText: staticResponse.statusText, headers });
  } catch {
    return staticResponse;
  }
}
