const STAGES = new Set(["Apparition", "Mutation", "Selection", "Cooperation", "Specialization"]);
const CONDITIONS = new Set(["Context", "Execution", "Verification", "Coordination", "Observability", "Economics", "Learning"]);
const VERDICTS = new Set(["SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE"]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=60" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseJson(value) {
  return value ? JSON.parse(value) : value;
}

function shape(row) {
  return {
    id: row.evidence_id,
    github_path: row.github_path,
    source: {
      title: row.source_title,
      date: row.source_date,
      producer: row.producer,
      producer_type: row.producer_type,
      type: row.source_type,
      provenance: row.provenance,
      url: row.source_url,
    },
    presentation: { headline: row.headline, summary: row.summary },
    observed: parseJson(row.observed_json),
    scale: { label: row.scale_label, summary: row.scale_summary },
    mapping: {
      stages: parseJson(row.stages_json) || [],
      conditions: parseJson(row.conditions_json) || [],
      transition: row.transition_from || row.transition_to || row.adjacent_stage ? {
        from: row.transition_from,
        to: row.transition_to,
        adjacent_stage: row.adjacent_stage,
      } : null,
    },
    claims: parseJson(row.claims_json) || [],
    interpretation: row.interpretation,
    model_implication: { verdict: row.verdict, explanation: row.verdict_explanation },
    what_this_does_not_establish: parseJson(row.limitations_json),
    open_question: row.open_question,
    assessment: { assisted_by_ai: Boolean(row.assisted_by_ai) },
  };
}

const SELECT = `
SELECT e.*,
  (SELECT json_group_array(stage) FROM (SELECT stage FROM evidence_stages s WHERE s.evidence_id = e.evidence_id ORDER BY stage)) AS stages_json,
  (SELECT json_group_array(condition) FROM (SELECT condition FROM evidence_conditions c WHERE c.evidence_id = e.evidence_id ORDER BY condition)) AS conditions_json,
  (SELECT json_group_array(json_object('id', claim_id, 'relationship', relationship)) FROM (SELECT claim_id, relationship FROM evidence_claims ec WHERE ec.evidence_id = e.evidence_id ORDER BY claim_id)) AS claims_json
FROM evidence e`;

async function listEvidence(url, env) {
  const where = [];
  const params = [];
  const stage = url.searchParams.get("stage");
  const condition = url.searchParams.get("condition");
  const verdict = url.searchParams.get("verdict");
  const producer = url.searchParams.get("producer");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (stage) {
    if (!STAGES.has(stage)) return json({ error: "Invalid stage" }, 400);
    where.push("EXISTS (SELECT 1 FROM evidence_stages s WHERE s.evidence_id=e.evidence_id AND s.stage=?)");
    params.push(stage);
  }
  if (condition) {
    if (!CONDITIONS.has(condition)) return json({ error: "Invalid condition" }, 400);
    where.push("EXISTS (SELECT 1 FROM evidence_conditions c WHERE c.evidence_id=e.evidence_id AND c.condition=?)");
    params.push(condition);
  }
  if (verdict) {
    if (!VERDICTS.has(verdict)) return json({ error: "Invalid verdict" }, 400);
    where.push("e.verdict=?");
    params.push(verdict);
  }
  if (producer) { where.push("e.producer=?"); params.push(producer); }
  if (from) { where.push("e.source_date>=?"); params.push(from); }
  if (to) { where.push("e.source_date<=?"); params.push(to); }

  const query = `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY e.source_date DESC, e.evidence_id ASC LIMIT 100`;
  const result = await env.EVIDENCE_DB.prepare(query).bind(...params).all();
  return json({ count: result.results.length, evidence: result.results.map(shape) });
}

async function getEvidence(id, env) {
  const row = await env.EVIDENCE_DB.prepare(`${SELECT} WHERE e.evidence_id = ?`).bind(id).first();
  return row ? json(shape(row)) : json({ error: "Evidence not found" }, 404);
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(context.request.url);
  const rawId = context.params.id;
  const id = Array.isArray(rawId) ? rawId.join("/") : rawId;

  if (!id) return listEvidence(url, context.env);
  if (id.includes("/")) return json({ error: "Invalid evidence id" }, 400);
  return getEvidence(decodeURIComponent(id), context.env);
}
