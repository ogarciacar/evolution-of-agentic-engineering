export const PROJECTION_HEADER = "X-Evidence-Projection";
export const PROJECTION_QUERY = "projection_id";
const SHORT_SHA = /^[0-9a-f]{12}$/;

export function normalizeProjectionId(value) {
  const projection = String(value ?? "").trim().toLowerCase();
  if (projection === "main" || SHORT_SHA.test(projection)) return projection;
  return null;
}

function selectionError(source) {
  return `${source} must be 'main' or a 12-character lowercase hexadecimal commit SHA`;
}

export function projectionFromRequest(request) {
  const headerValue = request.headers.get(PROJECTION_HEADER);
  if (headerValue != null && headerValue.trim() !== "") {
    const id = normalizeProjectionId(headerValue);
    if (!id) return { id: null, explicit: true, source: "header", error: selectionError(PROJECTION_HEADER) };
    return { id, explicit: true, source: "header", error: null };
  }

  const queryValue = new URL(request.url).searchParams.get(PROJECTION_QUERY);
  if (queryValue != null && queryValue.trim() !== "") {
    const id = normalizeProjectionId(queryValue);
    if (!id) return { id: null, explicit: true, source: "query", error: selectionError(PROJECTION_QUERY) };
    return { id, explicit: true, source: "query", error: null };
  }

  return { id: "main", explicit: false, source: "default", error: null };
}

export function applyProjectionHeaders(headers, projectionId) {
  headers.set(PROJECTION_HEADER, projectionId);
  const vary = headers.get("Vary");
  const parts = vary ? vary.split(",").map((item) => item.trim()).filter(Boolean) : [];
  if (!parts.some((item) => item.toLowerCase() === PROJECTION_HEADER.toLowerCase())) parts.push(PROJECTION_HEADER);
  headers.set("Vary", parts.join(", "));
  return headers;
}
