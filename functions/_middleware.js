import { projectionFromRequest } from "./_lib/evidence-projection.js";

const LANDSCAPE_END = "<!-- HOMEPAGE_EVIDENCE_END -->";
const BRAND_LOGO_CSS = `<style data-brand-logo>.brand{display:inline-flex;align-items:center;gap:10px}.brand-mark{display:block;width:30px;height:auto;flex:0 0 auto}@media(max-width:680px){.brand-mark{width:26px}}</style>`;
const BRAND_LOGO_HTML = `<img class="brand-mark" src="/assets/logo.svg" alt="" width="30" height="36"/><span>AgenticEngineering.science</span>`;

function practicesHref(projectionId) {
  if (projectionId === "main") return "/practices";
  return `/practices?projection_id=${encodeURIComponent(projectionId)}`;
}

export function withProjectionHref(href, projectionId) {
  const value = String(href ?? "");
  if (projectionId === "main" || !value) return value;
  if (value.startsWith("#") || value.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;

  const hashIndex = value.indexOf("#");
  const hash = hashIndex === -1 ? "" : value.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1));
  params.set("projection_id", projectionId);
  return `${path}?${params.toString()}${hash}`;
}

export function injectProjectionNavigation(html, projectionId = "main") {
  if (projectionId === "main") return html;
  return html.replace(/<a\b[^>]*>/gi, (anchor) => anchor.replace(/href=(["'])([^"']*)\1/i, (match, quote, href) => {
    const projected = withProjectionHref(href, projectionId);
    return projected === href ? match : `href=${quote}${projected}${quote}`;
  }));
}

export function normalizeSiteNavigation(html) {
  return html.replace(/href=(["'])\/?#about\1/gi, (match, quote) => `href=${quote}/about${quote}`);
}

export function injectBrandLogo(html) {
  const brandPattern = /<a\b([^>]*\bclass=(["'])[^"']*\bbrand\b[^"']*\2[^>]*)>AgenticEngineering\.science<\/a>/i;
  if (!brandPattern.test(html)) return html;

  let body = html.replace(brandPattern, `<a$1>${BRAND_LOGO_HTML}</a>`);
  if (!body.includes("data-brand-logo")) {
    body = body.replace(/<\/head>/i, `${BRAND_LOGO_CSS}</head>`);
  }
  return body;
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
  if (context.request.method !== "GET" || !response.ok) return response;

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return response;

  const projection = projectionFromRequest(context.request);
  if (projection.error) return response;

  const html = await response.text();
  let body = normalizeSiteNavigation(html);
  body = injectBrandLogo(body);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    body = injectPracticeNavigation(body, projection.id);
  }
  body = injectProjectionNavigation(body, projection.id);

  if (body === html) return new Response(html, response);

  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
