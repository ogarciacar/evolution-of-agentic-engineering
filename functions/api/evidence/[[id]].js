import { CONDITIONS, STAGES, VERDICTS, getEvidenceById, listEvidence } from "../../_lib/evidence-read-model.js";
import { PROJECTION_HEADER, PROJECTION_QUERY, applyProjectionHeaders, projectionFromRequest } from "../../_lib/evidence-projection.js";

const STAGE_SET = new Set(STAGES);
const CONDITION_SET = new Set(CONDITIONS);
const VERDICT_SET = new Set(VERDICTS);

function json(data, status = 200, projectionId = null) {
  const headers = new Headers({
    "Cache-Control": status === 200 ? "public, max-age=60" : "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (projectionId) applyProjectionHeaders(headers, projectionId);
  return Response.json(data, { status, headers });
}

function filtersFrom(url) {
  return {
    stage: url.searchParams.get("stage"),
    condition: url.searchParams.get("condition"),
    verdict: url.searchParams.get("verdict"),
    producer: url.searchParams.get("producer"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);

  const projection = projectionFromRequest(request);
  if (projection.error) {
    return json({
      error: projection.error,
      selector: projection.source === "query" ? PROJECTION_QUERY : PROJECTION_HEADER,
    }, 400);
  }

  const rawId = Array.isArray(params.id) ? params.id.join("/") : params.id;
  if (rawId) {
    if (rawId.includes("/")) return json({ error: "Invalid evidence id" }, 400, projection.id);
    const evidence = await getEvidenceById(env, decodeURIComponent(rawId), projection.id);
    return evidence ? json(evidence, 200, projection.id) : json({ error: "Evidence not found" }, 404, projection.id);
  }

  const filters = filtersFrom(new URL(request.url));
  if (filters.stage && !STAGE_SET.has(filters.stage)) return json({ error: "Invalid stage" }, 400, projection.id);
  if (filters.condition && !CONDITION_SET.has(filters.condition)) return json({ error: "Invalid condition" }, 400, projection.id);
  if (filters.verdict && !VERDICT_SET.has(filters.verdict)) return json({ error: "Invalid verdict" }, 400, projection.id);

  const evidence = await listEvidence(env, filters, 100, projection.id);
  return json({ projection: projection.id, count: evidence.length, evidence }, 200, projection.id);
}
