import { CONDITIONS, STAGES, VERDICTS, getEvidenceById, listEvidence } from "../../_lib/evidence-read-model.js";

const STAGE_SET = new Set(STAGES);
const CONDITION_SET = new Set(CONDITIONS);
const VERDICT_SET = new Set(VERDICTS);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=60" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
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

  const rawId = Array.isArray(params.id) ? params.id.join("/") : params.id;
  if (rawId) {
    if (rawId.includes("/")) return json({ error: "Invalid evidence id" }, 400);
    const evidence = await getEvidenceById(env, decodeURIComponent(rawId));
    return evidence ? json(evidence) : json({ error: "Evidence not found" }, 404);
  }

  const filters = filtersFrom(new URL(request.url));
  if (filters.stage && !STAGE_SET.has(filters.stage)) return json({ error: "Invalid stage" }, 400);
  if (filters.condition && !CONDITION_SET.has(filters.condition)) return json({ error: "Invalid condition" }, 400);
  if (filters.verdict && !VERDICT_SET.has(filters.verdict)) return json({ error: "Invalid verdict" }, 400);

  const evidence = await listEvidence(env, filters, 100);
  return json({ count: evidence.length, evidence });
}
