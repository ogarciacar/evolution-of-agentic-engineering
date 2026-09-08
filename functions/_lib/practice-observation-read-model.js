export const PRACTICE_SELECTION_CONDITIONS = [
  "context",
  "execution",
  "verification",
  "coordination",
  "observability",
  "economics",
  "learning",
];

const SELECT_BASE = `
SELECT
  p.projection_id,
  p.evidence_id,
  p.observation_id,
  p.use_case,
  p.problem,
  p.reported_practice,
  e.producer,
  e.source_title,
  e.source_date,
  e.source_url,
  e.github_path,
  (SELECT json_group_array(condition) FROM (
    SELECT condition FROM practice_observation_conditions c
    WHERE c.projection_id = p.projection_id
      AND c.evidence_id = p.evidence_id
      AND c.observation_id = p.observation_id
    ORDER BY condition
  )) AS conditions_json
FROM practice_observations p
JOIN evidence e
  ON e.projection_id = p.projection_id
 AND e.evidence_id = p.evidence_id`;

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  return JSON.parse(value);
}

export function shapePracticeObservation(row) {
  return {
    id: row.observation_id,
    projection_id: row.projection_id,
    evidence_id: row.evidence_id,
    company: row.producer,
    use_case: row.use_case,
    problem: row.problem,
    reported_practice: row.reported_practice,
    selection_conditions: parseJson(row.conditions_json),
    evidence: {
      title: row.source_title,
      date: row.source_date,
      url: row.source_url,
      github_path: row.github_path,
    },
  };
}

export async function listPracticeObservations(env, filters = {}, limit = 500, projectionId = "main") {
  const where = ["p.projection_id = ?"];
  const params = [projectionId];

  if (filters.condition) {
    where.push(`EXISTS (
      SELECT 1 FROM practice_observation_conditions c
      WHERE c.projection_id = p.projection_id
        AND c.evidence_id = p.evidence_id
        AND c.observation_id = p.observation_id
        AND c.condition = ?
    )`);
    params.push(filters.condition);
  }

  const query = `${SELECT_BASE}
WHERE ${where.join(" AND ")}
ORDER BY e.source_date DESC, p.evidence_id ASC, p.observation_id ASC
LIMIT ?`;

  const result = await env.EVIDENCE_DB.prepare(query).bind(...params, limit).all();
  return (result.results || []).map(shapePracticeObservation);
}
