# Slice 5I — Rerank OR candidates for semantic precision

## Question

Can AI Search reranking recover semantic precision after Slice 5H changed keyword matching from `and` to `or`, without losing the recovered natural-language reliability or making latency unacceptable?

## Starting condition

Slice 5H was the deployed starting condition:

- namespace binding with `env.AI_SEARCH.get("agentic-engineering-search")`
- `messages` input
- `retrieval.keyword_match_mode: "or"`
- instance defaults for the remaining retrieval settings
- public response capped locally at five unique source pages

Observed Slice 5H production result:

- full corpus: 30/30 non-zero attempts, 10/10 stable-nonzero queries, 0 API errors
- Playground parity: `Spotify` 10/10 and `What has Spotify reported?` 10/10
- full-corpus latency P50 915 ms, P90 964 ms, max 3,668 ms
- parity latency P50 956 ms, P90 1,025 ms, max 2,343 ms

Slice 5H restored recall but admitted broader results. In one parity run, `What has Spotify reported?` ranked the unrelated Cursor/pstack signal `Cooperation has to earn its coordination cost` first in the representative attempt.

## Change

Keep the Slice 5H retrieval condition and change one precision variable only:

```js
reranking: {
  enabled: true,
  model: "@cf/baai/bge-reranker-base",
}
```

No reranking match threshold override. Candidate retrieval, keyword OR matching, query rewrite, index configuration, corpus, and source normalization remained unchanged.

## Production result

Post-deployment full-corpus characterization:

- 15/30 non-zero attempts
- 15/30 zero-result attempts
- 0 request/API errors
- 5/10 stable-nonzero queries
- 5/10 persistent-zero queries
- persistent-zero: Q05, Q07, Q08, Q09, Q10
- latency P50 1,777 ms, P90 1,937 ms, max 4,825 ms in one run
- a parallel characterization reproduced the same 15/30 split, with P50 1,662 ms, P90 2,158 ms, max 8,045 ms

Post-deployment Playground-parity probe:

- `Spotify`: 10/10 non-zero
- `What has Spotify reported?`: 10/10 non-zero
- the natural-language Spotify query now ranks Spotify evidence first, second, and third in the representative output
- parity latency P50 1,587 ms, P90 2,650 ms, max 15,748 ms

## Interpretation

Reranking improved semantic ordering for the specific Spotify natural-language query, but it materially regressed corpus-wide recall. Five evaluation queries that were stable under Slice 5H became persistent-zero under Slice 5I. The effect was reproduced in two overlapping characterization runs, with 0 API errors in both.

Reranking also increased normal latency from roughly 1 second under Slice 5H to roughly 1.6–1.8 seconds, with a much worse observed tail.

This means the default reranking behavior is too aggressive for the current small corpus and query set. The precision gain does not justify losing half of the corpus-level retrieval attempts.

## Decision

Reject Slice 5I and do not merge it.

Restore the deployed Worker to Slice 5H (`keyword_match_mode: "or"`, reranking disabled). Any future precision experiment should preserve the 5H recall baseline and test a narrower relevance intervention.

No AI Search sync is required.
