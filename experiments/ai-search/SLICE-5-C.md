# Slice 5C — Restore Worker → AI Search connectivity

## Observation

The AI Search instance is healthy in Cloudflare: 19 indexed items, 0 indexing errors, and the Playground returns relevant results for `Spotify`.

At the same time, production `/api/search` returns zero results for every query. This isolates the failure to the Worker → AI Search access path rather than the indexed corpus.

## Change

Change one connectivity dimension only:

- replace the direct `ai_search` instance binding with the `ai_search_namespaces` binding for namespace `default`;
- resolve the existing `agentic-engineering-search` instance at runtime with `env.AI_SEARCH.get("agentic-engineering-search")`;
- keep the same search request payload (`query`, `max_num_results: 5`, `context_expansion: 0`, query rewrite off, reranking off);
- keep result normalization, source deduplication, public API response schema, UI, corpus and index settings unchanged.

This matches Cloudflare's current namespace-binding access pattern while preserving retrieval semantics.

## Acceptance

After CI is green, deploy this branch's Worker and run the existing 10-query × 3-round reliability harness.

Success means `/api/search` returns non-zero results again for the known-good corpus. Only after connectivity is restored should the bounded retry experiment be reconsidered.

No AI Search sync is required.
