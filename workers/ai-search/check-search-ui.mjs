import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  shortExcerpt,
  safeSourceUrl,
  isPracticesUrl,
  signalIdFromUrl,
  matchedPassage,
  normalizeResults,
  enrichResults,
  renderResult,
} = require("../../evidence-search.js");

assert.equal(safeSourceUrl("/signals/example/"), "https://agenticengineering.science/signals/example/");
assert.equal(safeSourceUrl("https://agenticengineering.science/signals/example/"), "https://agenticengineering.science/signals/example/");
assert.equal(safeSourceUrl("https://example.com/not-evidence"), null);
assert.equal(isPracticesUrl("https://agenticengineering.science/practices"), true);
assert.equal(isPracticesUrl("https://agenticengineering.science/practices/"), true);
assert.equal(isPracticesUrl("https://agenticengineering.science/signals/example/"), false);
assert.equal(signalIdFromUrl("https://agenticengineering.science/signals/2026-09-03-cursor/"), "2026-09-03-cursor");
assert.equal(signalIdFromUrl("https://agenticengineering.science/practices"), null);

const long = `${"evidence ".repeat(100)}tail`;
assert.ok(shortExcerpt(long).length <= 621);
assert.match(shortExcerpt(long), /…$/);

assert.deepEqual(
  matchedPassage("## What this does not establish * The source does not compare alternatives. * Another boundary."),
  {
    label: "WHAT THIS DOES NOT ESTABLISH",
    text: "The source does not compare alternatives. Another boundary.",
  },
);
assert.deepEqual(
  matchedPassage("## Source → Observed → Interpretation → Model implication **SOURCE** Evaluating AGENTS.md [View source →](https://example.com)"),
  {
    label: "MATCHED EVIDENCE",
    text: "SOURCE · Evaluating AGENTS.md View source →",
  },
);

const normalized = normalizeResults([
  {
    title: "Spotify context engineering",
    url: "https://agenticengineering.science/signals/spotify/",
    excerpt: "Relevant evidence",
    score: 0.98,
  },
  {
    title: "Practice Observations",
    url: "https://agenticengineering.science/practices",
    excerpt: "Practice collection",
  },
  {
    title: "Off-site",
    url: "https://example.com/result",
    excerpt: "Should not render",
  },
]);
assert.equal(normalized.length, 2);
assert.deepEqual(normalized[0], {
  title: "Spotify context engineering",
  url: "https://agenticengineering.science/signals/spotify/",
  excerpt: "Relevant evidence",
});

const enrichmentCalls = [];
const enriched = await enrichResults(normalized, async (url) => {
  enrichmentCalls.push(url);
  return {
    ok: true,
    async json() {
      return {
        id: "spotify",
        source: { date: "2026-09-03", producer: "Spotify" },
        presentation: { headline: "Spotify context engineering" },
        mapping: {
          stages: ["Selection"],
          conditions: ["Context", "Verification"],
          transition: { from: "Selection", to: "Cooperation", adjacent_stage: "Specialization" },
        },
        model_implication: { verdict: "REFINES" },
      };
    },
  };
});
assert.deepEqual(enrichmentCalls, ["/api/evidence/spotify"]);
assert.equal(enriched[0].evidence.verdict, "REFINES");
assert.equal(enriched[1].evidence, undefined);

const markup = renderResult(enriched[0]);
assert.match(markup, /September 3, 2026 · Spotify/);
assert.match(markup, /Spotify context engineering/);
assert.match(markup, /Selection → Cooperation \/ Specialization/);
assert.match(markup, /Context/);
assert.match(markup, /Verification/);
assert.match(markup, /MATCHED EVIDENCE/);
assert.match(markup, /Relevant evidence/);
assert.match(markup, /REFINES/);
assert.match(markup, /Read Scale Signal →/);
assert.match(markup, /https:\/\/agenticengineering\.science\/signals\/spotify\//);
assert.doesNotMatch(markup, /0\.98|score|chunk/i);

const boundaryMarkup = renderResult({
  ...enriched[0],
  excerpt: "## What this does not establish * The source does not compare alternatives.",
});
assert.match(boundaryMarkup, /WHAT THIS DOES NOT ESTABLISH/);
assert.doesNotMatch(boundaryMarkup, /##|\* The source/);

const practiceMarkup = renderResult(normalized[1]);
assert.match(practiceMarkup, /Practice Observations/);
assert.match(practiceMarkup, /Explore practices →/);
assert.doesNotMatch(practiceMarkup, /Read Scale Signal →|Read evidence →/);

const page = fs.readFileSync("evidence.html", "utf8");
assert.match(page, /id="ask-evidence"/);
assert.match(page, /<h2>Ask the evidence<\/h2>/);
assert.match(page, /id="ask-evidence-input"/);
assert.match(page, /maxlength="500"/);
assert.match(page, /id="ask-evidence-results"/);
assert.match(page, /evidence-search\.css/);
assert.match(page, /evidence-search\.js/);
assert.match(page, /Results are excerpts from published evidence pages, not generated answers\./);

const css = fs.readFileSync("evidence-search.css", "utf8");
assert.match(css, /ask-match/);
assert.match(css, /ask-result-signal/);
assert.match(css, /focus-visible/);
assert.match(css, /@media\(max-width:800px\)/);

console.log("Ask the evidence UI contract is stable");
