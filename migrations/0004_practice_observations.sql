-- Persist exhaustive practice observations scoped to one evidence item in one projection.
-- This schema intentionally does not aggregate or canonicalize similar practices.

CREATE TABLE practice_observations (
  projection_id TEXT NOT NULL CHECK (length(trim(projection_id)) > 0),
  evidence_id TEXT NOT NULL CHECK (length(trim(evidence_id)) > 0),
  observation_id TEXT NOT NULL CHECK (length(trim(observation_id)) > 0),
  use_case TEXT NOT NULL CHECK (length(trim(use_case)) > 0),
  problem TEXT NOT NULL CHECK (length(trim(problem)) > 0),
  reported_practice TEXT NOT NULL CHECK (length(trim(reported_practice)) > 0),
  PRIMARY KEY (projection_id, evidence_id, observation_id),
  FOREIGN KEY (projection_id, evidence_id)
    REFERENCES evidence (projection_id, evidence_id)
    ON DELETE CASCADE
);

CREATE TABLE practice_observation_conditions (
  projection_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN (
    'context',
    'execution',
    'verification',
    'coordination',
    'observability',
    'economics',
    'learning'
  )),
  PRIMARY KEY (projection_id, evidence_id, observation_id, condition),
  FOREIGN KEY (projection_id, evidence_id, observation_id)
    REFERENCES practice_observations (projection_id, evidence_id, observation_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_practice_observations_evidence
  ON practice_observations (projection_id, evidence_id);

CREATE INDEX idx_practice_observation_conditions_condition
  ON practice_observation_conditions (projection_id, condition);
