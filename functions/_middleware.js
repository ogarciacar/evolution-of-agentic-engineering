import { projectionFromRequest } from "./_lib/evidence-projection.js";

const LANDSCAPE_END = "<!-- HOMEPAGE_EVIDENCE_END -->";

function practicesHref(projectionId) {
  if (projectionId === "main") return "/practices";
  return `/practices?projection_id=${encodeURIComponent(projectionId)}`;
}

export function injectPracticeNavigation(html, projectionId = "main") {
  const marker = html.indexOf(LANDSCAPE_END);
  if (marker === -1) return html;
  const insertionPoint = marker + LANDSCAPE_END.length;
  const navigation = `<div class="links practice-navigation"><a href="/evidence">Explore evidence →</a><a href="${practicesHref(projectionId)}">Practice observations →</a><a href="evaluate.html">Evaluate the model →</a></div>`;

  // The Evidence Landscape owns the homepage navigation immediately after it.
  // Replace the older evidence/evaluation links so evidence is exposed once.
  const tail = html.slice(insertionPoint);
  const legacy = tail.match(/^\s*<div class="links"><a href="evidence\.html">Explore (?:the )?evidence →<\/a>(?:<a href="evaluate\.html">Evaluate the model →<\/a>)?<\/div>/);
  const afterLegacy = legacy ? insertionPoint + legacy[0].length : insertionPoint;
  return html.slice(0, insertionPoint) + navigation + html.slice(afterLegacy);
}

export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);
  if ((url.pathname !== "/" && url.pathname !== "/index.html") || context.request.method !== "GET" || !response.ok) return response;

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return response;

  const projection = projectionFromRequest(context.request);
  if (projection.error) return response;

  const html = await response.text();
  const body = injectPracticeNavigation(html, projection.id);
  if (body === html) return new Response(html, response);

  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
