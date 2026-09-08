export async function getPracticeAssessmentSummary(env, projectionId = "main") {
  const query = `
SELECT
  (SELECT COUNT(*) FROM evidence WHERE projection_id = ?) AS evidence_count,
  (SELECT COUNT(*) FROM practice_assessments WHERE projection_id = ? AND status = 'assessed') AS assessed_count,
  (SELECT COUNT(*) FROM practice_assessments WHERE projection_id = ? AND status = 'pending') AS pending_count,
  (SELECT COUNT(*) FROM practice_observations WHERE projection_id = ?) AS observation_count`;

  const row = await env.EVIDENCE_DB.prepare(query)
    .bind(projectionId, projectionId, projectionId, projectionId)
    .first();

  const evidence = Number(row?.evidence_count || 0);
  const assessed = Number(row?.assessed_count || 0);
  const pending = Number(row?.pending_count || 0);
  const observations = Number(row?.observation_count || 0);
  const coverage = evidence === 0 ? 0 : Math.round((assessed / evidence) * 100);

  return { evidence, assessed, pending, observations, coverage };
}
