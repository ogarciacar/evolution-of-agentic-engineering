export const STAGES = ["Apparition", "Selection", "Cooperation", "Specialization"];
export const CONDITIONS = ["Context", "Execution", "Verification", "Coordination", "Observability", "Economics", "Learning"];
export const VERDICTS = ["SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE"];

const SELECT_BASE = `
SELECT e.*,
  (SELECT json_group_array(stage) FROM (
    SELECT stage FROM evidence_stages s
    WHERE s.projection_id = e.projection_id AND s.evidence_id = e.evidence_id
    ORDER BY stage
  )) AS stages_json,
  (SELECT json_group_array(condition) FROM (
    SELECT condition FROM evidence_conditions c
    WHERE c.projection_id = e.projection_id AND c.evidence_id = e.evidence_id
    ORDER BY condition
  )) AS conditions_json
FROM evidence e`;

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  return JSON.parse(value);
}

export function shapeEvidence(row) {
  const transition = row.transition_from || row.transition_to || row.adjacent_stage
    ? { from: row.transition_from, to: row.transition_to, adjacent_stage: row.adjacent_stage }
    : null;

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
    observed: parseJson(row.observed_json, []),
    scale: { label: row.scale_label, summary: row.scale_summary },
    mapping: {
      stages: parseJson(row.stages_json, []),
      conditions: parseJson(row.conditions_json, []),
      transition,
    },
    interpretation: row.interpretation,
    model_implication: { verdict: row.verdict, explanation: row.verdict_explanation },
    what_this_does_not_establish: parseJson(row.limitations_json, []),
    open_question: row.open_question,
    assessment: { assisted_by_ai: Boolean(row.assisted_by_ai) },
  };
}

export async function getEvidenceById(env, id, projectionId = "main") {
  const row = await env.EVIDENCE_DB.prepare(`${SELECT_BASE} WHERE e.projection_id = ? AND e.evidence_id = ?`)
    .bind(projectionId, id)
    .first();
  return row ? shapeEvidence(row) : null;
}

export async function listEvidence(env, filters = {}, limit = 100, projectionId = "main") {
  const where = ["e.projection_id=?"];
  const params = [projectionId];

  if (filters.stage) {
    where.push("EXISTS (SELECT 1 FROM evidence_stages s WHERE s.projection_id=e.projection_id AND s.evidence_id=e.evidence_id AND s.stage=?)");
    params.push(filters.stage);
  }
  if (filters.condition) {
    where.push("EXISTS (SELECT 1 FROM evidence_conditions c WHERE c.projection_id=e.projection_id AND c.evidence_id=e.evidence_id AND c.condition=?)");
    params.push(filters.condition);
  }
  if (filters.verdict) {
    where.push("e.verdict=?");
    params.push(filters.verdict);
  }
  if (filters.producer) {
    where.push("e.producer=?");
    params.push(filters.producer);
  }
  if (filters.from) {
    where.push("e.source_date>=?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("e.source_date<=?");
    params.push(filters.to);
  }

  const query = `${SELECT_BASE} WHERE ${where.join(" AND ")} ORDER BY e.source_date DESC, e.evidence_id ASC LIMIT ?`;
  const result = await env.EVIDENCE_DB.prepare(query).bind(...params, limit).all();
  return (result.results || []).map(shapeEvidence);
}

export async function getHomepageEvidence(env, limit = 24, projectionId = "main") {
  const [records, countRow] = await Promise.all([
    listEvidence(env, {}, limit, projectionId),
    env.EVIDENCE_DB.prepare("SELECT COUNT(*) AS count FROM evidence WHERE projection_id = ?").bind(projectionId).first(),
  ]);
  return { records, total: Number(countRow?.count || 0) };
}
