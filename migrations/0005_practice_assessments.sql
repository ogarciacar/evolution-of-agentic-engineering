-- Track whether each evidence item has been explicitly assessed for practice observations.
-- Every projected evidence record receives exactly one row; absence in legacy YAML projects as pending.

CREATE TABLE practice_assessments (
  projection_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assessed')),
  PRIMARY KEY (projection_id, evidence_id),
  FOREIGN KEY (projection_id, evidence_id)
    REFERENCES evidence (projection_id, evidence_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_practice_assessments_status
  ON practice_assessments (projection_id, status);
