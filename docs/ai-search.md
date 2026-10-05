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

## Pages previews

The production custom domain reaches `agentic-engineering-search-api` through the Worker route above. Cloudflare Pages preview hostnames do not match that route, so previews expose the same `/api/search` browser contract through `functions/api/search.js`.

The Pages Function is deliberately only a bridge:

```text
<preview>.pages.dev/api/search
        ↓
functions/api/search.js
        ↓
SEARCH_API service binding
        ↓
agentic-engineering-search-api
        ↓
AI_SEARCH namespace binding
        ↓
agentic-engineering-search
```

Configure the Cloudflare Pages project preview environment with this Service Binding:

```text
Binding: SEARCH_API
Service: agentic-engineering-search-api
```

The bridge forwards the original request unchanged. Query validation, retrieval configuration, deduplication, provenance filtering, and response shaping remain owned by the search Worker. If `SEARCH_API` is not configured, the preview endpoint returns `503` instead of silently falling back to another implementation.

Preview search intentionally uses the current published AI Search index. It does not create a PR-specific AI Search instance or crawl a PR-specific corpus.

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
- public results are restricted to `/signals/<id>` and `/practices`
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

Every public result must stay connected to a crawled AgenticEngineering.science source page inside the supported search corpus. Source provenance comes from `chunk.item.key`; off-site and unsupported same-origin keys are discarded.

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

The homepage investigation lifecycle now has deterministic unit, Cloudflare
runtime and desktop/mobile browser acceptance tests. See
[`tests/investigate/README.md`](../tests/investigate/README.md) for setup,
transition criteria and the shared local/CI command `npm run check`.

Deterministic repository contracts:

```bash
node workers/ai-search/check-search-endpoint.mjs
node workers/ai-search/check-preview-bridge.mjs
node workers/ai-search/check-search-ui.mjs
node experiments/ai-search/check-corpus-coverage.mjs
```

Production retrieval evaluation is intentionally separate from PR contracts because it tests the currently deployed Worker, not undeployed PR code. See [`experiments/ai-search/README.md`](../experiments/ai-search/README.md).

## Deployment

The Worker deploys independently from Cloudflare Pages. `.github/workflows/deploy-ai-search-worker.yml` runs after a merge to `main` whenever `workers/ai-search/**` changes, and can also be started manually with `workflow_dispatch`.

The deployment job:

1. runs the Worker endpoint contract,
2. deploys `agentic-engineering-search-api` with Wrangler, and
3. verifies the production `/api/search` response only exposes `/signals/<id>` or `/practices` results.

It uses the existing `production` GitHub environment and expects `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The API token must include permission to deploy Workers.

Manual deployment remains available with:

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

## Inspectable passages (Explore and Reason, slice 2)

The homepage requests `GET /api/search?q=<question>&passages=1`. This opt-in
adds an `evidence` package; the existing `query` and `results` fields and default
endpoint remain compatible with earlier clients and evaluation scripts.

The package has `version: 1`, `provenance: indexed_eae_pages`, `retrieved_at`,
`indexed_at: null` (the provider does not expose a verified index timestamp),
`truncated`, `limits`, `outcome`, and `sources`. Each source contains a stable
`source:<sha256>` ID, canonical EAE URL, title, `kind` (`eae_signal` or
`eae_collection`), optional canonical `record_id`, and passages with stable
`passage:<sha256>` IDs and exact indexed text. A passage hash covers its
canonical EAE URL and exact text; rankings, query strings, fragments and
retrieval times do not change IDs. Content edits do. These are content identity
keys, not a permanent archive or a claim of truth/freshness.

At most 100 candidate chunks are examined, returning up to five EAE pages and
three distinct passages per page. Each passage is at most 12,000 UTF-8 bytes.
Oversized passages are omitted, never silently clipped. Other count omissions
set `truncated: true`. Source ordering follows retrieval ordering; this is not a
new reranker. Multiple passages on one EAE page stay grouped and do not count as
independent evidence. Multiple pages may still cite the same primary source;
primary-source independence must be assessed before answer synthesis.

Outcomes:

- `evidence_found`: at least one traceable passage is available; this does not
  establish that it supports an answer or recommendation.
- `no_matching_evidence`: no eligible nonempty passages matched within the
  examined corpus response. The UI offers question refinement without implying
  that no evidence exists elsewhere.
- `evidence_unavailable`: candidates were omitted by limits and no passages
  remain. The UI treats this as a retrieval failure, not as an evidence gap.
- Invalid provider responses and provider errors return 503.

The existing result cards remain concise. “Inspect passages” opens an accessible
modal with the full retrieved text rendered as escaped plain text. Escape/Close
returns focus to the invoking control. Original-source metadata, when available,
comes from the existing `/api/evidence/<id>` read model. It is labelled separately
from indexed EAE text. Missing metadata leaves the EAE page link available; the UI
does not invent dates, authors or original-source links. Index passages can lag
the current evidence record, and the inspector states this limitation.

This is the evidence retrieval/inspection foundation, not answer generation.
The future reasoning path must resolve canonical source metadata server-side,
check source lineage and freshness, and validate cited claim support; it must not
trust browser-supplied enrichment or equate a search match with sufficient evidence.

Pages and the Worker deploy separately. Until the Worker supports the opt-in,
the new UI falls back to existing cards without an inspector. Preview service
bindings use the deployed production Worker, so deterministic browser acceptance
tests exercise the candidate Worker with fixture bindings in-process to verify
the new contract before merge. After merge, the Worker deployment smoke check
also verifies the opt-in package.
