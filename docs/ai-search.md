# AI Search

Cloudflare AI Search provides retrieval over the published AgenticEngineering.science evidence corpus. It is a derived search surface, not a source of research truth.

## Architecture

```text
canonical evidence/*.yaml
        ↓
validation
        ↓
D1 projection
        ↓
published /signals/** + /practices
        ↓
Cloudflare AI Search website crawler
        ↓
derived AI Search index

visitor
   ↓
/evidence → Ask the evidence
   ↓
GET /api/search?q=...
   ↓
agentic-engineering-search-api Worker
   ↓
AI_SEARCH namespace binding
   ↓
agentic-engineering-search
```

The canonical research source and D1 projection remain governed by the [evidence projection contract](evidence-projection.md). The search Worker does not bind to or read `EVIDENCE_DB`.

## Cloudflare resources

- AI Search instance: `agentic-engineering-search`
- namespace: `default`
- Worker: `agentic-engineering-search-api`
- Worker route: `agenticengineering.science/api/search*`
- Worker binding: AI Search namespace binding `AI_SEARCH`
- local-development binding mode: `remote: true`

The Worker configuration lives in `workers/ai-search/wrangler.jsonc`. The repository root Wrangler configuration and the Cloudflare Pages application are unchanged by AI Search.

## Indexed corpus

AI Search crawls the production website using Sitemap parsing with:

```text
https://agenticengineering.science/sitemap.xml
```

Current crawl surface:

```text
**/signals/**
**/practices
```

Generic evidence navigation/query pages are intentionally excluded from the AI Search corpus.

Current indexing/retrieval configuration:

- parsing mode: Static site
- chunk size: 256 tokens
- chunk overlap: 10%
- hybrid search: enabled
- hybrid fusion: Reciprocal Rank Fusion
- keyword tokenizer: Standard with Porter stemming
- vector similarity threshold: 0.4
- query rewriting: disabled
- reranking: disabled
- similarity cache: disabled

The Worker overrides keyword matching per request to `or`. This is the current reliable production retrieval baseline.

Browser Run / Discover mode is not part of the working architecture. Sitemap parsing is the supported crawl path for this experiment.

## Retrieval endpoint

The public Worker exposes only:

```text
GET /api/search?q=<query>
```

Contract:

- query is required and trimmed
- maximum query length is 500 characters
- GET only
- maximum public output is five unique on-site source pages
- hybrid retrieval uses `keyword_match_mode: "or"`
- source order is the AI Search order after source-URL deduplication
- no application-side reranking
- no query rewriting
- no visitor retry
- no generated answer

The Worker resolves the namespace binding and instance explicitly:

```js
const instance = env.AI_SEARCH.get("agentic-engineering-search");
const search = await instance.search({
  messages: [{ role: "user", content: query }],
  ai_search_options: {
    retrieval: {
      keyword_match_mode: "or",
    },
  },
});
```

It does not use Workers AI inference, `env.AI.autorag()`, an application-managed Vectorize index, Agents, another LLM provider, or D1 as a search input.

## Provenance and response shape

Every public result must stay connected to a crawled AgenticEngineering.science source page. Source provenance comes from `chunk.item.key`; off-site keys are discarded.

The response exposes only the public retrieval fields:

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

Chunk identifiers, scoring details, vector scores, keyword ranks, and other AI Search internals are not exposed.

## Ask the evidence UI

`/evidence` contains a small natural-language retrieval surface implemented by:

```text
evidence.html
evidence-search.css
evidence-search.js
```

It renders retrieved titles/excerpts as source cards and links every result back to the returned AgenticEngineering.science source. It does not synthesize answers or alter ranking.

## Observability

The Worker emits structured search diagnostics including:

- result count
- candidate count
- duplicate source chunks dropped
- latency
- zero-result state

Raw user query text is not logged.

## Checks and evaluation

Deterministic repository contracts:

```bash
node workers/ai-search/check-search-endpoint.mjs
node workers/ai-search/check-search-ui.mjs
node experiments/ai-search/check-corpus-coverage.mjs
```

Production retrieval evaluation is intentionally separate from PR contracts because it tests the currently deployed Worker, not undeployed PR code. See [`experiments/ai-search/README.md`](../experiments/ai-search/README.md).

## Deployment

Deploy the Worker independently with:

```bash
npx --yes wrangler@4 deploy --config workers/ai-search/wrangler.jsonc
```

Retrieval-option-only Worker deployments do not require an AI Search index sync. Corpus/indexing changes should be synchronized separately when required.

## Boundary

The intended pipeline remains:

```text
canonical evidence → validation → D1 projection → website → AI Search
```

AI Search is disposable derived infrastructure. Removing it must not require a D1 rollback, evidence migration, projection rebuild, or change to canonical evidence.