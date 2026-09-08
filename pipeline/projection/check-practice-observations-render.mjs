import assert from "node:assert/strict";
import { renderPracticeObservations } from "../../functions/practices.js";

const observations = [
  {
    id: "dependency-lineage-targeting",
    projection_id: "main",
    evidence_id: "2026-04-22-spotify-honk-part-4",
    company: "Spotify",
    use_case: "Identify downstream consumers",
    problem: "The agent must discover affected repositories",
    reported_practice: "Use dependency lineage",
    selection_conditions: ["context", "coordination"],
    evidence: {},
  },
];

const html = renderPracticeObservations(observations);
assert.match(html, /<nav class="practice-filters"/);
for (const condition of ["context", "execution", "verification", "coordination", "observability", "economics", "learning"]) {
  assert.match(html, new RegExp(`href="\\/practices\\?condition=${condition}"`));
}
assert.match(html, /class="filter active" href="\/practices">All<\/a>/);
assert.match(html, /<table class="practice-table">/);
assert.match(html, /Company/);
assert.match(html, /Specific use case being solved/);
assert.match(html, /Problem encountered/);
assert.match(html, /Reported practice/);
assert.match(html, /Selection condition/);
assert.match(html, /Spotify/);
assert.match(html, /Identify downstream consumers/);
assert.match(html, /Use dependency lineage/);
assert.match(html, />context</);
assert.match(html, />coordination</);
assert.match(html, /data-projection-id="main"/);
assert.match(html, /data-evidence-id="2026-04-22-spotify-honk-part-4"/);
assert.match(html, /data-observation-id="dependency-lineage-targeting"/);
assert.match(html, /href="\/signals\/2026-04-22-spotify-honk-part-4\/"/);
assert.match(html, />Evidence →<\/a>/);

const filtered = renderPracticeObservations(observations, "context", "main");
assert.match(filtered, /class="filter active" href="\/practices\?condition=context">context<\/a>/);
assert.match(filtered, /1 practice observations · context/);

const projected = renderPracticeObservations([{ ...observations[0], projection_id: "deadbeefcafe" }], "context", "deadbeefcafe");
assert.match(projected, /href="\/signals\/2026-04-22-spotify-honk-part-4\/\?projection_id=deadbeefcafe"/);
assert.match(projected, /href="\/practices\?projection_id=deadbeefcafe&amp;condition=context"/);
assert.match(projected, /href="\/practices\?projection_id=deadbeefcafe">All<\/a>/);

const escaped = renderPracticeObservations([{ ...observations[0], company: "A & <B>" }]);
assert.match(escaped, /A &amp; &lt;B&gt;/);
assert.doesNotMatch(escaped, /A & <B>/);

assert.match(renderPracticeObservations([]), /No practice observations are available for this projection/);
assert.match(renderPracticeObservations([], "learning"), /No practice observations match the learning selection condition/);

console.log("Practice Observations rendering, traceability, and filtering contract is stable");
