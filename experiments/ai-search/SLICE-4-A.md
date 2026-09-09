# Slice 4A — Practice Observations corpus coverage

This is the first controlled retrieval-tuning intervention.

## Change

Add the existing public runtime route:

```text
https://agenticengineering.science/practices
```

to `sitemap.xml` so the current Sitemap-mode Cloudflare AI Search source can index the Practice Observations page.

No retrieval or ranking settings change in this intervention.

## Production acceptance

After merge and normal Pages deployment:

1. Verify `https://agenticengineering.science/sitemap.xml` contains `/practices`.
2. In Cloudflare AI Search → `agentic-engineering-search`, trigger **Sync**.
3. Wait until `/practices` appears in **Items** and indexing is complete.
4. Run the unchanged evaluation corpus:

```bash
node experiments/ai-search/evaluate.mjs \
  --output .artifacts/ai-search-evaluation-after-practices.md
```

5. Compare with the Slice 3 baseline, especially:
   - Q03 — dependency lineage
   - Q07 — code search
   - duplicate-source incidence
   - `evidence.html` contamination
   - regressions in previously strong queries

## Decision rule

Keep this intervention if the practice-oriented queries become materially more useful without meaningful regressions elsewhere.

Do not start another tuning intervention until this comparison is recorded.
