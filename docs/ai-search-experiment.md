# AI Search experiment

This experiment tests whether Cloudflare AI Search can provide useful semantic retrieval over the public AgenticEngineering.science evidence corpus without changing the research publication architecture.

## Architecture

```text
canonical evidence
      ↓
validation
      ↓
D1 projection
      ↓
public AgenticEngineering.science pages
      ↓
Cloudflare AI Search website crawler
      ↓
derived AI Search index

visitor
   ↓
/evidence → Ask the evidence
   ↓
/api/search
   ↓
agentic-engineering-search-api Worker
   ↓
AI Search instance binding
   ↓
agentic-engineering-search
```

> AI Search is a derived retrieval index. It does not contain independently authored research state and does not participate in the evidence projection pipeline.

The canonical research source and D1 projection remain governed by the existing [evidence projection contract](evidence-projection.md). The search Worker does not bind to or read `EVIDENCE_DB`.

## Cloudflare resources

- AI Search instance: `agentic-engineering-search`
- Worker: `agentic-engineering-search-api`
- Worker route: `agenticengineering.science/api/search*`
- Worker binding: direct `ai_search` instance binding named `AI_SEARCH`
- Binding local-development mode: `remote: true`

The Worker configuration is isolated at `workers/ai-search/wrangler.jsonc`. The repository root Wrangler configuration and the Cloudflare Pages application remain unchanged.

## Website source

Configure `agenticengineering.science` as the AI Search website data source.

Working crawler configuration for Slice 1:

- parse type: Sitemap
- specific sitemap: `https://agenticengineering.science/sitemap.xml`
- parsing mode: Static site
- chunk size: 256 tokens
- chunk overlap: 10%
- hybrid search: enabled
- hybrid fusion: Reciprocal Rank Fusion
- keyword match mode: AND
- keyword tokenizer: Standard with Stemming (Porter)
- query rewriting: disabled
- reranking: disabled
- maximum results: 5
- score threshold: 0.4
- similarity cache: disabled
- content selectors: none initially
- custom metadata: none initially

Initial include patterns:

```text
**/signals/**
**/practices
**/evidence
**/evidence.html
```

The experiment intentionally starts with a narrow crawl surface. `/signals/**` is the most important source because Scale Signal pages are rendered server-side from the D1 read model and contain the evidence source, observed facts, interpretation, model implication, epistemic boundaries, and open question.

The current sitemap contains the signal routes needed for the infrastructure proof. `/practices` is server-rendered from D1 but is not currently listed in the sitemap, so it is not guaranteed to enter the index in Sitemap mode. Do not change sitemap generation merely to expand the experiment before retrieval evaluation demonstrates that this is necessary.

### Discover-mode finding

The first configuration used `Discover`. On 2026-09-09, the crawl repeatedly stopped with:

```text
paused_blocked_by_content_signal
```

The job log showed that Discover initiated a Browser Run crawl job. Switching the experiment to Sitemap parsing avoided that discovery path and indexed the server-rendered signal pages successfully. Browser Run is therefore not part of the working architecture.

Cloudflare-managed `robots.txt` configuration was also disabled during diagnosis so the repository-owned `robots.txt` is served unchanged. The repository policy explicitly allows Cloudflare AI Search and publishes the sitemap. Any future managed robots/content-signal policy should be reviewed separately from the retrieval experiment rather than weakening the evidence site's content policy to satisfy a crawler.

## Retrieval endpoint

The Worker exposes only:

```text
GET /api/search?q=<query>
```

Contract:

- query is required and trimmed
- maximum query length is 500 characters
- maximum returned results is 5
- the AI Search instance uses hybrid retrieval
- query rewriting is disabled
- reranking is disabled
- no generation is performed

The Worker calls the direct instance binding with:

```text
env.AI_SEARCH.search(...)
```

It does not use Workers AI, `env.AI`, `env.AI.autorag()`, an application-managed Vectorize index, Agents, or another model provider.

Cloudflare AI Search may expose internal indexing implementation details in its own job logs; those do not add a Vectorize resource or binding to this repository's architecture.

## Provenance

Every public result must remain connected to the crawled AgenticEngineering.science source page.

The source URL comes from:

```text
chunk.item.key
```

Absolute AgenticEngineering.science URLs are preserved. Site-relative keys are resolved against `https://agenticengineering.science`. Off-site keys are discarded.

The public response intentionally exposes only:

```json
{
  "query": "Spotify",
  "results": [
    {
      "title": "...",
      "url": "https://agenticengineering.science/signals/.../",
      "excerpt": "...",
      "score": 0.82
    }
  ]
}
```

It does not expose chunk identifiers, scoring details, vector scores, keyword ranks, or other AI Search internals.

## Slice 1 retrieval proof

The successful Sitemap-based index returned relevant Spotify evidence in the Cloudflare Search playground and through the deployed Worker endpoint.

A live request to:

```text
https://agenticengineering.science/api/search?q=Spotify
```

returned real source URLs including:

```text
https://agenticengineering.science/signals/2025-11-24-spotify-honk-part-2/
https://agenticengineering.science/signals/2026-06-03-spotify-code-with-claude/
https://agenticengineering.science/signals/2025-12-09-spotify-honk-part-3/
```

This satisfies the Slice 1 infrastructure and provenance acceptance criteria.

## Slice 2 — Ask the evidence UI

The Evidence page exposes one deliberately small natural-language search surface immediately before the existing structured evidence filters.

Files:

```text
evidence.html
evidence-search.css
evidence-search.js
```

Behavior:

- label: `Ask the evidence`
- native search input with `maxlength=500`
- same-origin request to `/api/search?q=...`
- loading state disables the submit button and announces `Searching evidence…`
- empty-result state is announced through an `aria-live` status region
- errors degrade to the existing structured evidence filters below
- returned titles and excerpts are rendered as retrieval results, not generated answers
- excerpts are presentation-clamped in the browser to keep result cards compact; retrieval/ranking is unchanged
- every rendered result links to the AgenticEngineering.science source URL returned by the Worker
- off-site URLs are rejected defensively in the browser as well as by the Worker
- relevance scores and AI Search implementation details are not shown to visitors
- the existing structured evidence query remains unchanged

The UI does not deduplicate results, change ranking, rewrite queries, alter score thresholds, or modify the AI Search instance. Those questions belong to retrieval evaluation and tuning.

## Observability

The Worker writes one structured log record per search containing:

- event
- result count
- latency in milliseconds
- whether zero results were returned

Raw public query text is not logged. The experiment does not introduce a new analytics system.

## Local development and checks

AI Search itself does not run locally. The binding is configured with `remote: true`, allowing Wrangler development mode to proxy to the deployed AI Search instance.

```bash
npx --yes wrangler@4 dev --config workers/ai-search/wrangler.jsonc
```

Then query:

```bash
curl "http://localhost:8787/api/search?q=Spotify"
curl "http://localhost:8787/api/search?q=repository%20context"
curl "http://localhost:8787/api/search?q=verification"
```

The experiment checks do not require Cloudflare credentials:

```bash
node workers/ai-search/check-search-endpoint.mjs
node workers/ai-search/check-search-ui.mjs
```

## Preview behavior

PR preview D1 projections are not independently indexed for this experiment. AI Search crawls the production AgenticEngineering.science website only, so search remains a production-derived retrieval surface even while repository PR previews may expose separate D1 projections.

The Slice 2 browser UI in a Pages preview therefore calls the production `/api/search` Worker route when exercised on the production hostname; preview deployments do not create a separate AI Search corpus.

## Production deployment

The search Worker is independently deployed with Wrangler 4:

```bash
npx --yes wrangler@4 deploy --config workers/ai-search/wrangler.jsonc
```

The configured route is:

```text
agenticengineering.science/api/search*
```

The Pages application deploys the Evidence-page UI through its existing Git integration. Slice 2 does not require another Worker deployment because it does not change Worker code or retrieval configuration.

## Manual Cloudflare configuration

The working account-side setup is:

1. AI Search instance `agentic-engineering-search` in the default namespace.
2. `agenticengineering.science` Website data source.
3. Sitemap parsing with `https://agenticengineering.science/sitemap.xml`.
4. Static site parsing.
5. Initial include patterns listed above.
6. 256-token chunks with 10% overlap.
7. Hybrid search enabled; query rewriting and reranking disabled.
8. Maximum results 5; score threshold 0.4.
9. Similarity cache disabled for the experiment.
10. `agentic-engineering-search-api` deployed with the direct `AI_SEARCH` binding.

The successful path does not require Browser Run or rendered-site crawling.

## Disable / removal

The experiment is intentionally disposable.

To disable public search immediately, remove or disable the Worker route:

```text
agenticengineering.science/api/search*
```

To remove the visitor-facing Slice 2 surface, remove the `#ask-evidence` section and the `evidence-search.js` / `evidence-search.css` references from `evidence.html`.

The Worker and AI Search instance can then be deleted independently:

```text
agentic-engineering-search-api
agentic-engineering-search
```

No D1 rollback, evidence migration, projection rebuild, or core Pages runtime change is required.

## Experiment boundary

Slice 2 adds only the minimal visitor-facing retrieval UI. It does not add an evaluation corpus, retrieval tuning, deduplication, synthesis, conversational behavior, memory, or generated answers.
