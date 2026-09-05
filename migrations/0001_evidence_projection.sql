PRAGMA foreign_keys = ON;

CREATE TABLE evidence (
  evidence_id TEXT PRIMARY KEY NOT NULL,
  github_path TEXT NOT NULL UNIQUE,
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
  CHECK ((transition_from IS NULL AND transition_to IS NULL) OR (transition_from IS NOT NULL AND transition_to IS NOT NULL))
);

CREATE TABLE evidence_stages (
  evidence_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Apparition', 'Mutation', 'Selection', 'Cooperation', 'Specialization')),
  PRIMARY KEY (evidence_id, stage),
  FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE
);

CREATE TABLE evidence_conditions (
  evidence_id TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('Context', 'Execution', 'Verification', 'Coordination', 'Observability', 'Economics', 'Learning')),
  PRIMARY KEY (evidence_id, condition),
  FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE
);

CREATE INDEX idx_evidence_source_date ON evidence(source_date);
CREATE INDEX idx_evidence_producer ON evidence(producer);
CREATE INDEX idx_evidence_verdict ON evidence(verdict);
CREATE INDEX idx_evidence_stages_stage ON evidence_stages(stage, evidence_id);
CREATE INDEX idx_evidence_conditions_condition ON evidence_conditions(condition, evidence_id);
