export const PROJECTION_HEADER = "X-Evidence-Projection";
const SHORT_SHA = /^[0-9a-f]{12}$/;

export function normalizeProjectionId(value) {
  const projection = String(value ?? "").trim().toLowerCase();
  if (projection === "main" || SHORT_SHA.test(projection)) return projection;
  return null;
}

export function projectionFromRequest(request) {
  const raw = request.headers.get(PROJECTION_HEADER);
  if (raw == null || raw.trim() === "") return { id: "main", explicit: false, error: null };
  const id = normalizeProjectionId(raw);
  if (!id) {
    return {
      id: null,
      explicit: true,
      error: `${PROJECTION_HEADER} must be 'main' or a 12-character lowercase hexadecimal commit SHA`,
    };
  }
  return { id, explicit: true, error: null };
}

export function applyProjectionHeaders(headers, projectionId) {
  headers.set(PROJECTION_HEADER, projectionId);
  const vary = headers.get("Vary");
  const parts = vary ? vary.split(",").map((item) => item.trim()).filter(Boolean) : [];
  if (!parts.some((item) => item.toLowerCase() === PROJECTION_HEADER.toLowerCase())) parts.push(PROJECTION_HEADER);
  headers.set("Vary", parts.join(", "));
  return headers;
}
