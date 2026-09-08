import assert from "node:assert/strict";
import fs from "node:fs";
import { injectPracticeNavigation } from "../../functions/_middleware.js";
import { renderPracticeObservations } from "../../functions/practices.js";

const conditions = ["context", "execution", "verification", "coordination", "observability", "economics", "learning"];
const summary = { evidence: 18, assessed: 18, pending: 0, observations: 38, coverage: 100 };
const observations = [
  { id:"multi", projection_id:"main", evidence_id:"signal-a", company:"A", use_case:"Use case A", problem:"Problem A", reported_practice:"Practice A", selection_conditions:["context","coordination"] },
  { id:"single", projection_id:"main", evidence_id:"signal-b", company:"B", use_case:"Use case B", problem:"Problem B", reported_practice:"Practice B", selection_conditions:["verification"] },
];

// The canonical shell exposes the Practice Observations dynamic insertion point.
const practicesShell = fs.readFileSync("practices.html", "utf8");
assert.match(practicesShell, /<!-- PRACTICE_OBSERVATIONS_START -->/);
assert.match(practicesShell, /<!-- PRACTICE_OBSERVATIONS_END -->/);
assert.match(practicesShell, /href="evidence\.html">Evidence →<\/a>/);
assert.match(practicesShell, /href="index\.html">← Model<\/a>/);

// Main projection: exhaustive view, corpus summary, filters, and evidence traceability compose.
const main = renderPracticeObservations(observations, null, "main", summary);
assert.match(main, />18<\/span><span class="summary-label">Evidence/);
assert.match(main, />18<\/span><span class="summary-label">Assessed/);
assert.match(main, />0<\/span><span class="summary-label">Pending/);
assert.match(main, />38<\/span><span class="summary-label">Observations/);
assert.match(main, />100%<\/span><span class="summary-label">Coverage/);
assert.equal((main.match(/<tr data-projection-id=/g) || []).length, 2);
assert.match(main, /href="\/signals\/signal-a\/"/);
for (const condition of conditions) assert.match(main, new RegExp(`href="\\/practices\\?condition=${condition}"`));

// Multi-condition observations remain one observation row and are discoverable under either condition.
assert.equal((main.match(/data-observation-id="multi"/g) || []).length, 1);
assert.match(main, />context</);
assert.match(main, />coordination</);

// Filtering changes the result set/count, not corpus completeness semantics.
const contextOnly = renderPracticeObservations([observations[0]], "context", "main", summary);
assert.match(contextOnly, /1 practice observations · context/);
assert.match(contextOnly, />38<\/span><span class="summary-label">Observations/);
assert.match(contextOnly, />100%<\/span><span class="summary-label">Coverage/);

// Preview projection stays isolated across model → practices → evidence and filter navigation.
const projection = "deadbeefcafe";
const projectedObservation = { ...observations[0], projection_id: projection };
const projected = renderPracticeObservations([projectedObservation], "context", projection, summary);
assert.match(projected, /href="\/signals\/signal-a\/\?projection_id=deadbeefcafe"/);
assert.match(projected, /href="\/practices\?projection_id=deadbeefcafe&amp;condition=context"/);
assert.match(projected, /href="\/practices\?projection_id=deadbeefcafe">All<\/a>/);

const modelShell = `<!-- HOMEPAGE_EVIDENCE_START --><div>landscape</div><!-- HOMEPAGE_EVIDENCE_END -->`;
const projectedModel = injectPracticeNavigation(modelShell, projection);
assert.match(projectedModel, /href="\/practices\?projection_id=deadbeefcafe">Practice observations →<\/a>/);
assert.match(projectedModel, /href="\/evidence">Explore evidence →<\/a>/);

console.log("Practice Observations end-to-end integration contract is stable");
