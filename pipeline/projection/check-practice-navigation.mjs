import assert from "node:assert/strict";
import { injectPracticeNavigation, injectProjectionNavigation, withProjectionHref } from "../../functions/_middleware.js";

const shell = `<section><!-- HOMEPAGE_EVIDENCE_START --><div>landscape</div><!-- HOMEPAGE_EVIDENCE_END --></section>`;
const main = injectPracticeNavigation(shell, "main");
assert.match(main, /href="\/evidence">Explore evidence →<\/a>/);
assert.match(main, /href="\/practices">Practice observations →<\/a>/);
assert.match(main, /href="evaluate\.html">Evaluate the model →<\/a>/);
assert.doesNotMatch(main, /projection_id=/);

const projected = injectPracticeNavigation(shell, "deadbeefcafe");
assert.match(projected, /href="\/practices\?projection_id=deadbeefcafe">Practice observations →<\/a>/);

const legacy = `<section><!-- HOMEPAGE_EVIDENCE_END --><div class="links"><a href="evidence.html">Explore evidence →</a></div></section>`;
const migrated = injectPracticeNavigation(legacy, "main");
assert.equal((migrated.match(/Explore evidence →/g) || []).length, 1);
assert.equal((migrated.match(/Practice observations →/g) || []).length, 1);
assert.equal((migrated.match(/Evaluate the model →/g) || []).length, 1);

const current = `<section><!-- HOMEPAGE_EVIDENCE_END --><div class="links"><a href="evidence.html">Explore the evidence →</a><a href="evaluate.html">Evaluate the model →</a></div></section>`;
const consolidated = injectPracticeNavigation(current, "main");
assert.equal((consolidated.match(/Explore evidence →/g) || []).length, 1);
assert.equal((consolidated.match(/Explore the evidence →/g) || []).length, 0);
assert.equal((consolidated.match(/Practice observations →/g) || []).length, 1);
assert.equal((consolidated.match(/Evaluate the model →/g) || []).length, 1);
assert.equal((consolidated.match(/class="links/g) || []).length, 1);

const unrelated = `<section>No evidence landscape</section>`;
assert.equal(injectPracticeNavigation(unrelated, "main"), unrelated);

assert.equal(withProjectionHref("/evidence", "deadbeefcafe"), "/evidence?projection_id=deadbeefcafe");
assert.equal(withProjectionHref("evaluate.html#claims", "deadbeefcafe"), "evaluate.html?projection_id=deadbeefcafe#claims");
assert.equal(withProjectionHref("/evidence?stage=Selection", "deadbeefcafe"), "/evidence?stage=Selection&projection_id=deadbeefcafe");
assert.equal(withProjectionHref("/evidence?projection_id=aaaaaaaaaaaa", "deadbeefcafe"), "/evidence?projection_id=deadbeefcafe");
assert.equal(withProjectionHref("https://example.com/source", "deadbeefcafe"), "https://example.com/source");
assert.equal(withProjectionHref("#details", "deadbeefcafe"), "#details");
assert.equal(withProjectionHref("/evidence", "main"), "/evidence");

const projectedHtml = injectProjectionNavigation(
  `<link rel="stylesheet" href="site.css"><nav><a href="/evidence">Evidence</a><a href="evaluate.html">Evaluate</a><a href="https://example.com/source">Source</a></nav>`,
  "deadbeefcafe",
);
assert.match(projectedHtml, /href="site\.css"/);
assert.doesNotMatch(projectedHtml, /site\.css\?projection_id=/);
assert.match(projectedHtml, /href="\/evidence\?projection_id=deadbeefcafe"/);
assert.match(projectedHtml, /href="evaluate\.html\?projection_id=deadbeefcafe"/);
assert.match(projectedHtml, /href="https:\/\/example\.com\/source"/);

console.log("Practice Observations and projection navigation contracts are stable");
