# Slice 5H — Natural-language recall via keyword OR

## Question

Does changing only AI Search keyword matching from `and` to `or` remove the zero-result instability seen for natural-language questions while preserving acceptable retrieval quality?

## Change

Starting from the deployed Slice 5F condition:

- keep namespace binding and `env.AI_SEARCH.get("agentic-engineering-search")`
- keep `messages` input
- keep instance defaults for result count, threshold, fusion, context expansion, query rewrite and reranking
- override only `retrieval.keyword_match_mode` to `or`
- keep the public response capped locally at five unique source pages

## Production result

Post-deployment reliability characterization:

- 30/30 non-zero attempts
- 0 zero-result attempts
- 0 request/API errors
- 10/10 stable-nonzero queries
- latency P50 915 ms, P90 964 ms, max 3,668 ms

Post-deployment Playground-parity probe:

- `Spotify`: 10/10 non-zero
- `What has Spotify reported?`: 10/10 non-zero
- 0 request/API errors

This is a complete reliability recovery in the observed sample and strongly supports `and` keyword matching as the cause of the natural-language zero-result behavior.

## Relevance warning

The recall gain is accompanied by a precision regression. In one post-deployment parity run, `What has Spotify reported?` ranked the unrelated `Cooperation has to earn its coordination cost` Cursor/pstack signal first, ahead of Spotify evidence. Other queries also admitted broader, less-specific results.

Therefore Slice 5H passes the reliability gate but does not yet pass the relevance gate.

## Decision

Do not merge 5H yet. Preserve it as the current best reliability condition while testing one precision-restoration variable at a time.

The next candidate experiment should retain the recovered recall and test whether reranking can restore semantic precision. Cloudflare documents reranking as a secondary semantic relevance pass over retrieved candidates; it adds latency, so acceptance must include both relevance and latency.

No AI Search sync is required.
