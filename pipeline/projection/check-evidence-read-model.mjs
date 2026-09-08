import assert from "node:assert/strict";
import { shapeEvidence } from "../../functions/_lib/evidence-read-model.js";
import { PROJECTION_HEADER, PROJECTION_QUERY, projectionFromRequest } from "../../functions/_lib/evidence-projection.js";

const row = {
  evidence_id: "2026-07-20-example",
  github_path: "evidence/2026-07-20-example.yaml",
  source_title: "Example",
  source_date: "2026-07-20",
  producer: "Example Org",
  producer_type: "organization",
  source_type: "engineering-blog",
  provenance: "primary",
  source_url: "https://example.com/source",
  headline: "Example headline",
  summary: "Example summary",
  observed_json: JSON.stringify(["Observed fact"]),
  scale_label: "Scale signal",
  scale_summary: "Example scale",
  stages_json: JSON.stringify(["Selection", "Cooperation"]),
  conditions_json: JSON.stringify(["Coordination", "Verification"]),
  transition_from: "Selection",
  transition_to: "Cooperation",
  adjacent_stage: null,
  interpretation: "Example interpretation",
  verdict: "REFINES",
  verdict_explanation: "Example implication",
  limitations_json: JSON.stringify(["Example boundary"]),
  open_question: "Example question?",
  assisted_by_ai: 1,
};

const evidence = shapeEvidence(row);
assert.equal(evidence.id, row.evidence_id);
assert.deepEqual(evidence.mapping.stages, ["Selection", "Cooperation"]);
assert.deepEqual(evidence.mapping.conditions, ["Coordination", "Verification"]);
assert.deepEqual(evidence.mapping.transition, { from: "Selection", to: "Cooperation", adjacent_stage: null });
assert.deepEqual(evidence.observed, ["Observed fact"]);
assert.deepEqual(evidence.what_this_does_not_establish, ["Example boundary"]);
assert.equal(evidence.model_implication.verdict, "REFINES");
assert.equal(evidence.assessment.assisted_by_ai, true);

const shaA = "9ef88b3846dd";
const shaB = "deadbeefcafe";

let request = new Request(`https://example.com/?${PROJECTION_QUERY}=${shaA}`);
assert.deepEqual(projectionFromRequest(request), { id: shaA, explicit: true, source: "query", error: null });

request = new Request(`https://example.com/?${PROJECTION_QUERY}=${shaA}`, {
  headers: { [PROJECTION_HEADER]: shaB },
});
assert.deepEqual(projectionFromRequest(request), { id: shaB, explicit: true, source: "header", error: null });

request = new Request(`https://example.com/?${PROJECTION_QUERY}=bad`);
assert.equal(projectionFromRequest(request).error, `${PROJECTION_QUERY} must be 'main' or a 12-character lowercase hexadecimal commit SHA`);

request = new Request("https://example.com/", { headers: { [PROJECTION_HEADER]: "bad" } });
assert.equal(projectionFromRequest(request).error, `${PROJECTION_HEADER} must be 'main' or a 12-character lowercase hexadecimal commit SHA`);

request = new Request("https://example.com/");
assert.deepEqual(projectionFromRequest(request), { id: "main", explicit: false, source: "default", error: null });

console.log("Shared evidence read model and projection selector contracts are stable");
