# Slice 5I — Rerank OR candidates for semantic precision

## Question

Can AI Search reranking recover semantic precision after Slice 5H changed keyword matching from `and` to `or`, without losing the recovered natural-language reliability or making latency unacceptable?

## Starting condition

Slice 5H is the current deployed condition:

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

Slice 5H restored recall but admitted broader results. In the parity run, `What has Spotify reported?` ranked the unrelated Cursor/pstack signal `Cooperation has to earn its coordination cost` first in the representative attempt.

## Change

Keep the Slice 5H retrieval condition and change one precision variable only:

```js
reranking: {
  enabled: true,
  model: "@cf/baai/bge-reranker-base",
}
```

Do not set a reranking match threshold in this slice; use Cloudflare's default. Do not change candidate retrieval, keyword OR matching, query rewrite, index configuration, corpus, or source normalization.

## Why this variable

Cloudflare describes reranking as a secondary semantic relevance pass over retrieved results. This is a direct fit for the current failure mode: Slice 5H supplies enough candidates reliably, but the order can be semantically weak for natural-language questions.

## Acceptance

After deployment, rerun:

1. the 10-query × 3-round reliability characterization, and
2. the 10-round Playground-parity probe for `Spotify` and `What has Spotify reported?`.

Keep Slice 5I only if:

- the full corpus remains effectively stable with no material return of zero-result failures
- both parity queries remain stable
- the natural-language Spotify query ranks Spotify evidence ahead of clearly unrelated evidence in the representative output
- broader representative outputs remain plausible for their questions
- reranking latency remains acceptable relative to the ~1 second Slice 5H baseline

## Deliberately unchanged

- AI Search index / sync
- corpus and path filters
- namespace binding
- `messages` input
- `keyword_match_mode: "or"`
- embedding model
- hybrid retrieval/fusion
- candidate result count
- query rewriting
- reranking match threshold
- source deduplication and normalization
- public response schema
- UI
- visitor retry behavior

No AI Search sync is required.
