-- Evidence that refines the model and maps to Coordination.
SELECT e.evidence_id, e.source_date, e.producer, e.headline
FROM evidence e
JOIN evidence_conditions c ON c.evidence_id = e.evidence_id
WHERE e.verdict = 'REFINES'
  AND c.condition = 'Coordination'
ORDER BY e.source_date DESC;

-- Producers with evidence mapped to Cooperation.
SELECT e.producer, COUNT(DISTINCT e.evidence_id) AS evidence_count
FROM evidence e
JOIN evidence_stages s ON s.evidence_id = e.evidence_id
WHERE s.stage = 'Cooperation'
GROUP BY e.producer
ORDER BY evidence_count DESC, e.producer;

-- Frequency of Selection conditions across the corpus.
SELECT condition, COUNT(*) AS evidence_count
FROM evidence_conditions
GROUP BY condition
ORDER BY evidence_count DESC, condition;

-- Model implications over time.
SELECT source_date, verdict, COUNT(*) AS evidence_count
FROM evidence
GROUP BY source_date, verdict
ORDER BY source_date, verdict;
