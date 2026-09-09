import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { shortExcerpt, safeSourceUrl, normalizeResults, renderResult } = require("../../evidence-search.js");

assert.equal(safeSourceUrl("/signals/example/"), "https://agenticengineering.science/signals/example/");
assert.equal(safeSourceUrl("https://agenticengineering.science/signals/example/"), "https://agenticengineering.science/signals/example/");
assert.equal(safeSourceUrl("https://example.com/not-evidence"), null);

const long = `${"evidence ".repeat(100)}tail`;
assert.ok(shortExcerpt(long).length <= 621);
assert.match(shortExcerpt(long), /…$/);

const normalized = normalizeResults([
  {
    title: "Spotify context engineering",
    url: "https://agenticengineering.science/signals/spotify/",
    excerpt: "Relevant evidence",
    score: 0.98,
  },
  {
    title: "Off-site",
    url: "https://example.com/result",
    excerpt: "Should not render",
  },
]);
assert.equal(normalized.length, 1);
assert.deepEqual(normalized[0], {
  title: "Spotify context engineering",
  url: "https://agenticengineering.science/signals/spotify/",
  excerpt: "Relevant evidence",
});

const markup = renderResult(normalized[0]);
assert.match(markup, /Spotify context engineering/);
assert.match(markup, /Read evidence →/);
assert.match(markup, /https:\/\/agenticengineering\.science\/signals\/spotify\//);
assert.doesNotMatch(markup, /0\.98|score|chunk/i);

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
assert.match(css, /focus-visible/);
assert.match(css, /@media\(max-width:800px\)/);

console.log("Ask the evidence UI contract is stable");
