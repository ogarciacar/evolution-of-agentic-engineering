PRAGMA foreign_keys = ON;

CREATE TABLE evidence_claims (
  evidence_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('SUPPORTS', 'REFINES', 'CONTRADICTS', 'INCONCLUSIVE')),
  PRIMARY KEY (evidence_id, claim_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE
);

CREATE INDEX idx_evidence_claims_claim ON evidence_claims(claim_id, relationship, evidence_id);
