# Slice 5D — Search with messages input

## Question

Does the current Cloudflare AI Search Worker binding return reliable results when the search request uses the current canonical `messages` input format instead of the older top-level `query` string?

## Evidence leading here

The AI Search instance is healthy in Cloudflare: 19 indexed items, 0 indexing errors, and the Playground returns strong results for `Spotify`.

The production Worker path degraded from the Slice 5A transient-zero baseline to 0/30 non-zero attempts. Slice 5C changed only the binding from direct instance to namespace access and improved production to 6/30 non-zero attempts, but 24/30 still returned zero and 5/10 queries were persistent-zero.

Cloudflare's current Worker search examples use:

```js
messages: [{ role: "user", content: userQuery }]
```

while our Worker still sends the older top-level `query` string.

## Change

Change one dimension only from `main`:

- keep the original direct `ai_search` instance binding;
- keep the same instance name and route;
- replace `query` in the AI Search request with `messages: [{ role: "user", content: query }]`;
- preserve `max_num_results: 5`;
- preserve `context_expansion: 0`;
- preserve query rewrite off;
- preserve reranking off;
- preserve source deduplication, normalization, UI and public `/api/search` response shape.

## Deliberately unchanged

- AI Search index and sync;
- corpus path filters;
- namespace/binding topology;
- ranking;
- embeddings/chunking/overlap;
- hybrid search/threshold;
- visitor retry behavior.

## Validation

After CI is green, deploy this branch Worker and rerun the existing 10-query × 3-round reliability harness.

Success means the Worker path returns non-zero results reliably enough to re-establish a usable baseline. If this fails, do not combine it with namespace binding in the same experiment; evaluate that as a separate follow-up.

No AI Search sync is required.
