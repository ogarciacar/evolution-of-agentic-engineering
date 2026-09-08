import assert from "node:assert/strict";
import { renderPracticeObservations, renderPracticeSummary } from "../../functions/practices.js";

const observations = [{ id:"dependency-lineage-targeting", projection_id:"main", evidence_id:"2026-04-22-spotify-honk-part-4", company:"Spotify", use_case:"Identify downstream consumers", problem:"The agent must discover affected repositories", reported_practice:"Use dependency lineage", selection_conditions:["context","coordination"], evidence:{} }];
const summary = { evidence:18, assessed:18, pending:0, observations:38, coverage:100 };

const summaryHtml = renderPracticeSummary(summary);
for (const [label, value] of [["Evidence","18"],["Assessed","18"],["Pending","0"],["Observations","38"],["Coverage","100%"]]) {
  assert.match(summaryHtml, new RegExp(`>${value}<`));
  assert.match(summaryHtml, new RegExp(`>${label}<`));
}
assert.match(summaryHtml, /Assessed evidence may legitimately contain zero observations/);

const html = renderPracticeObservations(observations, null, "main", summary);
assert.match(html, /<section class="corpus-summary"/);
assert.match(html, /<nav class="practice-filters"/);
for (const condition of ["context","execution","verification","coordination","observability","economics","learning"]) assert.match(html, new RegExp(`href="\\/practices\\?condition=${condition}"`));
assert.match(html, /class="filter active" href="\/practices">All<\/a>/);
assert.match(html, /<table class="practice-table">/);
assert.match(html, /Spotify/);
assert.match(html, /data-projection-id="main"/);
assert.match(html, /data-evidence-id="2026-04-22-spotify-honk-part-4"/);
assert.match(html, /data-observation-id="dependency-lineage-targeting"/);
assert.match(html, /href="\/signals\/2026-04-22-spotify-honk-part-4\/"/);

const filtered = renderPracticeObservations(observations, "context", "main", summary);
assert.match(filtered, /class="filter active" href="\/practices\?condition=context">context<\/a>/);
assert.match(filtered, /1 practice observations · context/);
assert.match(filtered, />38<\/span><span class="summary-label">Observations/);

const projected = renderPracticeObservations([{...observations[0],projection_id:"deadbeefcafe"}], "context", "deadbeefcafe", summary);
assert.match(projected, /href="\/signals\/2026-04-22-spotify-honk-part-4\/\?projection_id=deadbeefcafe"/);
assert.match(projected, /href="\/practices\?projection_id=deadbeefcafe&amp;condition=context"/);

assert.match(renderPracticeObservations([], "learning", "main", summary), /No practice observations match the learning selection condition/);
assert.match(renderPracticeObservations([], null, "main", summary), /No practice observations are available for this projection/);

console.log("Practice Observations rendering, traceability, filtering, and assessment summary contract is stable");
