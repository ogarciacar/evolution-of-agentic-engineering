PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_evidence_source_date;
DROP INDEX IF EXISTS idx_evidence_producer;
DROP INDEX IF EXISTS idx_evidence_verdict;
DROP INDEX IF EXISTS idx_evidence_stages_stage;
DROP INDEX IF EXISTS idx_evidence_conditions_condition;
DROP INDEX IF EXISTS idx_evidence_claims_claim;

ALTER TABLE evidence_claims RENAME TO evidence_claims_legacy;
ALTER TABLE evidence_conditions RENAME TO evidence_conditions_legacy;
ALTER TABLE evidence_stages RENAME TO evidence_stages_legacy;
ALTER TABLE evidence RENAME TO evidence_legacy;

CREATE TABLE evidence (
  projection_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  github_path TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_date TEXT NOT NULL,
  producer TEXT NOT NULL,
  producer_type TEXT NOT NULL CHECK (producer_type IN ('organization', 'authors', 'individual', 'project')),
  source_type TEXT NOT NULL CHECK (source_type IN ('engineering-blog', 'paper', 'repository', 'documentation', 'changelog', 'report', 'benchmark', 'talk')),
  provenance TEXT NOT NULL CHECK (provenance IN ('primary', 'secondary')),
  source_url TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  observed_json TEXT NOT NULL CHECK (json_valid(observed_json)),
  scale_label TEXT NOT NULL CHECK (scale_label IN ('Scale signal', 'Evidence boundary')),
  scale_summary TEXT NOT NULL,
  transition_from TEXT,
  transition_to TEXT,
  adjacent_stage TEXT,
  interpretation TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('SUPPORTS', 'REFINES', 'CONTRADICTS', 'INCONCLUSIVE')),
  verdict_explanation TEXT NOT NULL,
  limitations_json TEXT NOT NULL CHECK (json_valid(limitations_json)),
  open_question TEXT NOT NULL,
  assisted_by_ai INTEGER NOT NULL CHECK (assisted_by_ai IN (0, 1)),
  PRIMARY KEY (projection_id, evidence_id),
  UNIQUE (projection_id, github_path),
  CHECK ((transition_from IS NULL AND transition_to IS NULL) OR (transition_from IS NOT NULL AND transition_to IS NOT NULL))
);

CREATE TABLE evidence_stages (
  projection_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Apparition', 'Selection', 'Cooperation', 'Specialization')),
  PRIMARY KEY (projection_id, evidence_id, stage),
  FOREIGN KEY (projection_id, evidence_id) REFERENCES evidence(projection_id, evidence_id) ON DELETE CASCADE
);

CREATE TABLE evidence_conditions (
  projection_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('Context', 'Execution', 'Verification', 'Coordination', 'Observability', 'Economics', 'Learning')),
  PRIMARY KEY (projection_id, evidence_id, condition),
  FOREIGN KEY (projection_id, evidence_id) REFERENCES evidence(projection_id, evidence_id) ON DELETE CASCADE
);

CREATE TABLE evidence_claims (
  projection_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('SUPPORTS', 'REFINES', 'CONTRADICTS', 'INCONCLUSIVE')),
  PRIMARY KEY (projection_id, evidence_id, claim_id),
  FOREIGN KEY (projection_id, evidence_id) REFERENCES evidence(projection_id, evidence_id) ON DELETE CASCADE
);

INSERT INTO evidence (
  projection_id, evidence_id, github_path, source_title, source_date, producer, producer_type,
  source_type, provenance, source_url, headline, summary, observed_json, scale_label, scale_summary,
  transition_from, transition_to, adjacent_stage, interpretation, verdict, verdict_explanation,
  limitations_json, open_question, assisted_by_ai
)
SELECT
  'main', evidence_id, github_path, source_title, source_date, producer, producer_type,
  source_type, provenance, source_url, headline, summary, observed_json, scale_label, scale_summary,
  transition_from, transition_to, adjacent_stage, interpretation, verdict, verdict_explanation,
  limitations_json, open_question, assisted_by_ai
FROM evidence_legacy;

INSERT INTO evidence_stages (projection_id, evidence_id, stage)
SELECT 'main', evidence_id, stage FROM evidence_stages_legacy;

INSERT INTO evidence_conditions (projection_id, evidence_id, condition)
SELECT 'main', evidence_id, condition FROM evidence_conditions_legacy;

INSERT INTO evidence_claims (projection_id, evidence_id, claim_id, relationship)
SELECT 'main', evidence_id, claim_id, relationship FROM evidence_claims_legacy;

DROP TABLE evidence_claims_legacy;
DROP TABLE evidence_conditions_legacy;
DROP TABLE evidence_stages_legacy;
DROP TABLE evidence_legacy;

CREATE INDEX idx_evidence_source_date ON evidence(projection_id, source_date);
CREATE INDEX idx_evidence_producer ON evidence(projection_id, producer);
CREATE INDEX idx_evidence_verdict ON evidence(projection_id, verdict);
CREATE INDEX idx_evidence_stages_stage ON evidence_stages(projection_id, stage, evidence_id);
CREATE INDEX idx_evidence_conditions_condition ON evidence_conditions(projection_id, condition, evidence_id);
CREATE INDEX idx_evidence_claims_claim ON evidence_claims(projection_id, claim_id, relationship, evidence_id);

PRAGMA foreign_keys = ON;
