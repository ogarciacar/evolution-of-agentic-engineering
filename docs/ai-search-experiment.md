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

The current sitemap contains the signal routes needed for the Slice 1 infrastructure proof. `/practices` is server-rendered from D1 but is not currently listed in the sitemap, so it is not guaranteed to enter the index in Sitemap mode. Do not change sitemap generation merely to expand the experiment before retrieval evaluation demonstrates that this is necessary.

### Discover-mode finding

The first configuration used `Discover`. On 2026-09-09, the crawl repeatedly stopped with:

```text
paused_blocked_by_content_signal
```

The job log showed that Discover initiated a Browser Run crawl job. Switching the experiment to Sitemap parsing avoided that discovery path and indexed the server-rendered signal pages successfully. Browser Run is therefore not part of the working Slice 1 architecture.

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

The first successful Sitemap-based index returned relevant Spotify evidence in the Cloudflare Search playground, including real source URLs such as:

```text
https://agenticengineering.science/signals/2025-11-24-spotify-honk-part-2/
https://agenticengineering.science/signals/2026-06-03-spotify-code-with-claude/
```

This establishes the first half of the Slice 1 hypothesis: the public D1-derived website can be indexed by AI Search and semantically queried while preserving source provenance. The remaining Slice 1 proof is the repository Worker endpoint at `/api/search`.

## Observability

The Worker writes one structured log record per search containing:

- event
- result count
- latency in milliseconds
- whether zero results were returned

Raw public query text is not logged. The experiment does not introduce a new analytics system.

## Local development

AI Search itself does not run locally. The binding is configured with `remote: true`, allowing Wrangler development mode to proxy to the deployed AI Search instance.

After creating and indexing `agentic-engineering-search` in Cloudflare:

```bash
npx --yes wrangler@4 dev --config workers/ai-search/wrangler.jsonc
```

Then query:

```bash
curl "http://localhost:8787/api/search?q=Spotify"
curl "http://localhost:8787/api/search?q=repository%20context"
curl "http://localhost:8787/api/search?q=verification"
```

The contract test is fully local and does not require Cloudflare credentials:

```bash
node workers/ai-search/check-search-endpoint.mjs
```

## Preview behavior

PR preview D1 projections are not independently indexed for this experiment. AI Search crawls the production AgenticEngineering.science website only, so search remains a production-derived retrieval surface even while repository PR previews may expose separate D1 projections.

This avoids adding ephemeral preview evidence to the search index.

## Production deployment

Before deployment, create the AI Search instance and wait for the website source to finish indexing. Inspect the instance Items view and verify that real `/signals/.../` pages are present.

Deploy the Worker with Wrangler 4:

```bash
npx --yes wrangler@4 deploy --config workers/ai-search/wrangler.jsonc
```

The configured route is:

```text
agenticengineering.science/api/search*
```

The Worker itself accepts only the exact `/api/search` path and returns `404` for any other path that happens to match the route pattern.

Production verification:

```bash
curl --fail-with-body \
  --silent \
  --show-error \
  "https://agenticengineering.science/api/search?q=Spotify"
```

At least one returned `url` should resolve to a real AgenticEngineering.science source page, preferably a `/signals/.../` page.

## Manual Cloudflare configuration

The following account-side setup is intentionally not automated by repository code:

1. Create AI Search instance `agentic-engineering-search` in the default namespace.
2. Add `agenticengineering.science` as a Website data source.
3. Configure Sitemap parsing with `https://agenticengineering.science/sitemap.xml`.
4. Configure Static site parsing.
5. Add the initial include patterns listed above.
6. Configure 256-token chunks with 10% overlap.
7. Enable hybrid search; leave query rewriting and reranking disabled.
8. Set maximum results to 5 and leave the initial score threshold at 0.4.
9. Disable similarity cache for the experiment.
10. Start/synchronize the crawl and verify indexed Items and Playground search results.
11. Ensure the API token used for Worker deployment can create/update the Worker route for the `agenticengineering.science` zone.
12. Deploy `agentic-engineering-search-api` using `workers/ai-search/wrangler.jsonc`.

The successful Slice 1 path does not require Browser Run or rendered-site crawling.

## Disable / removal

The experiment is intentionally disposable.

To disable public search, remove or disable the Worker route:

```text
agenticengineering.science/api/search*
```

The Worker and AI Search instance can then be deleted independently:

```text
agentic-engineering-search-api
agentic-engineering-search
```

No D1 rollback, evidence migration, projection rebuild, or Pages change is required.

## Slice 1 boundary

Slice 1 proves retrieval infrastructure only. It does not add an `Ask the evidence` UI, evaluation corpus, retrieval tuning, synthesis, conversational behavior, or generated answers.
