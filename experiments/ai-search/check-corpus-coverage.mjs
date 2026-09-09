import assert from "node:assert/strict";
import fs from "node:fs";

const sitemap = fs.readFileSync(new URL("../../sitemap.xml", import.meta.url), "utf8");
const practicesUrl = "https://agenticengineering.science/practices";

assert.equal(
  (sitemap.match(new RegExp(practicesUrl.replaceAll(".", "\\."), "g")) || []).length,
  1,
  "sitemap must contain exactly one Practice Observations URL",
);

assert.match(
  sitemap,
  /https:\/\/agenticengineering\.science\/signals\/[a-z0-9-]+\//,
  "sitemap must continue to contain runtime signal URLs",
);

console.log("AI Search corpus sitemap coverage is stable");
