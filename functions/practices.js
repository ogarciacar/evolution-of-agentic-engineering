import { listPracticeObservations } from "./_lib/practice-observation-read-model.js";
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

export function renderPracticeObservations(observations) {
  if (!observations.length) {
    return '<div class="empty">No practice observations are available for this projection.</div>';
  }

  const rows = observations.map((observation) => {
    const conditions = observation.selection_conditions
      .map((condition) => `<span class="condition">${esc(condition)}</span>`)
      .join("");
    const evidence = `<a class="evidence-link" href="${esc(evidenceHref(observation), true)}" aria-label="View evidence for ${esc(observation.company, true)}">Evidence →</a>`;
    return `<tr data-projection-id="${esc(observation.projection_id, true)}" data-evidence-id="${esc(observation.evidence_id, true)}" data-observation-id="${esc(observation.id, true)}"><td class="company">${esc(observation.company)}<div>${evidence}</div></td><td>${esc(observation.use_case)}</td><td>${esc(observation.problem)}</td><td>${esc(observation.reported_practice)}</td><td><span class="conditions">${conditions}</span></td></tr>`;
  }).join("");

  return `<p class="count">${observations.length} practice observations</p><div class="table-shell"><table class="practice-table"><thead><tr><th>Company</th><th>Specific use case being solved</th><th>Problem encountered</th><th>Reported practice</th><th>Selection condition</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
    const observations = await listPracticeObservations(env, {}, 500, projection.id);
    const rendered = renderPracticeObservations(observations);
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
