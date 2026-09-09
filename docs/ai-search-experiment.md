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

Initial crawler configuration:

- parse/discovery mode: Discover
- rendering: Static
- include subdomains: disabled
- follow external links: disabled
- chunk size: 256 tokens
- content selectors: none initially

Initial include patterns:

```text
**/signals/**
**/practices
**/evidence
**/evidence.html
```

The experiment intentionally starts with a narrow crawl surface. `/signals/**` is the most important source because Scale Signal pages are rendered server-side from the D1 read model and contain the evidence source, observed facts, interpretation, model implication, epistemic boundaries, and open question. `/practices` is also rendered server-side from D1. `/evidence` is included for corpus framing, while its interactive result list remains client-side.

`robots.txt` already allows the `Cloudflare-AI-Search` crawler and advertises the production sitemap.

## Retrieval endpoint

The Worker exposes only:

```text
GET /api/search?q=<query>
```

Contract:

- query is required and trimmed
- maximum query length is 500 characters
- maximum returned results is 5
- default AI Search hybrid retrieval is used
- query rewriting is disabled
- reranking is disabled
- context expansion is 0
- no generation is performed

The Worker calls the direct instance binding with:

```text
env.AI_SEARCH.search(...)
```

It does not use Workers AI, `env.AI`, `env.AI.autorag()`, Vectorize, Agents, or another model provider.

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
3. Configure Discover + Static crawling.
4. Add the initial include patterns listed above.
5. Configure 256-token chunks.
6. Start/synchronize the crawl and verify indexed Items.
7. Ensure the API token used for Worker deployment can create/update the Worker route for the `agenticengineering.science` zone.
8. Deploy `agentic-engineering-search-api` using `workers/ai-search/wrangler.jsonc`.

Normal website crawling should be tested first. Do not enable browser-rendered crawling unless static crawling demonstrably fails to capture the intended server-rendered pages.

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
