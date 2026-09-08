import assert from "node:assert/strict";
import { injectPracticeNavigation } from "../../functions/_middleware.js";

const shell = `<section><!-- HOMEPAGE_EVIDENCE_START --><div>landscape</div><!-- HOMEPAGE_EVIDENCE_END --></section>`;
const main = injectPracticeNavigation(shell, "main");
assert.match(main, /href="\/evidence">Explore evidence →<\/a>/);
assert.match(main, /href="\/practices">Practice observations →<\/a>/);
assert.doesNotMatch(main, /projection_id=/);

const projected = injectPracticeNavigation(shell, "deadbeefcafe");
assert.match(projected, /href="\/practices\?projection_id=deadbeefcafe">Practice observations →<\/a>/);

const legacy = `<section><!-- HOMEPAGE_EVIDENCE_END --><div class="links"><a href="evidence.html">Explore evidence →</a></div></section>`;
const migrated = injectPracticeNavigation(legacy, "main");
assert.equal((migrated.match(/Explore evidence →/g) || []).length, 1);
assert.equal((migrated.match(/Practice observations →/g) || []).length, 1);

const unrelated = `<section>No evidence landscape</section>`;
assert.equal(injectPracticeNavigation(unrelated, "main"), unrelated);

console.log("Practice Observations navigation contract is stable");
