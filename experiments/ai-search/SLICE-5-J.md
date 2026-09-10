# Slice 5J — Rerank OR candidates without reranker filtering

## Question

Can semantic reranking improve ordering on top of the reliable Slice 5H `keyword_match_mode: "or"` baseline if we remove the reranker's result-filtering effect?

## Starting condition

Slice 5H is restored in production and revalidated:

- full corpus: 30/30 non-zero attempts
- 10/10 stable-nonzero queries
- Playground parity: `Spotify` 10/10 and `What has Spotify reported?` 10/10
- 0 API errors
- full-corpus latency P50 ~1.0 s, P90 ~1.1 s

Its remaining weakness is precision: for `What has Spotify reported?`, an unrelated Cursor/pstack signal can rank ahead of Spotify evidence.

Slice 5I enabled reranking with Cloudflare's default reranking match threshold of `0.4`. It improved the targeted Spotify ordering but reduced the full corpus to 15/30 non-zero attempts and produced five persistent-zero queries.

## Change

Keep Slice 5H retrieval and enable the same reranker used in 5I, but explicitly set the reranking match threshold to `0`:

```js
reranking: {
  enabled: true,
  model: "@cf/baai/bge-reranker-base",
  match_threshold: 0,
}
```

Cloudflare documents `reranking.match_threshold` as the minimum reranking score and allows values from `0` to `1`; the default is `0.4`. Setting it to `0` is intentionally maximally permissive so this experiment tests reranking primarily as an ordering step rather than as an additional result filter.

The retrieval-stage match threshold remains unchanged at the instance default.

## Hypothesis

The 5I recall regression was caused mainly by the reranker's default `0.4` threshold filtering candidates after semantic scoring, not by semantic reordering itself.

If that is true, a zero reranking threshold should preserve the 5H non-zero reliability while still allowing the reranker to place semantically relevant Spotify evidence ahead of unrelated OR-retrieved candidates.

## Acceptance

After deployment, rerun:

1. the 10-query × 3-round production reliability characterization, and
2. the 10-round Playground-parity probe for `Spotify` and `What has Spotify reported?`.

Keep Slice 5J only if:

- the full corpus remains effectively at the 5H reliability level with no material return of zero-result failures
- both parity queries remain stable
- `What has Spotify reported?` ranks Spotify evidence ahead of clearly unrelated evidence in the representative output
- the representative outputs for the broader corpus remain plausible
- latency remains acceptable relative to the ~1 second 5H baseline and does not reproduce 5I's pathological tail behavior

## Production result

After deployment, both independent production runs preserved recall:

- primary full-corpus run: 30/30 non-zero, 10/10 stable-nonzero, 0 API errors, 0 slow attempts; P50 1,417 ms, P90 1,535 ms, max 5,561 ms
- parity workflow full-corpus run: 30/30 non-zero, 10/10 stable-nonzero, 0 API errors; P50 1,691 ms, P90 1,868 ms, max 3,964 ms
- Playground parity: `Spotify` 10/10 and `What has Spotify reported?` 10/10; P50 1,599 ms, P90 1,767 ms, max 3,093 ms
- duplicate source pages: 0
- off-site URLs: 0
- missing titles: 0

The targeted precision problem improved: `What has Spotify reported?` now ranks `Coding stops being the constraint` first, followed by four additional Spotify evidence pages.

However, broader ranking quality regressed for at least one benchmark query. For Q07, `What practices relate to code search?`, the reranker placed the Anthropic signal `Human expertise stays load-bearing while the agent executes` first. That result is not a plausible top answer to the code-search question. Other representative queries also changed materially, showing that zero-threshold reranking is not a monotonic precision improvement across the corpus.

Latency increased from the ~1 second 5H baseline to roughly 1.4–1.7 seconds at P50. No >=7 second pathological tail was observed in these post-deployment runs.

## Decision

Reject Slice 5J.

The experiment confirms that the 5I recall loss was largely caused by reranker filtering: setting the reranking threshold to `0` restores 30/30 retrieval reliability. But the reranker still produces unacceptable ordering regressions on broader benchmark questions, so the targeted Spotify improvement does not satisfy the predeclared corpus-wide precision acceptance criterion.

Return production to Slice 5H. Before another retrieval change, add an explicit precision benchmark so ranking experiments can be evaluated across all benchmark queries rather than optimized around one Spotify example.

## Deliberately unchanged

- AI Search index / sync
- corpus and path filters
- namespace binding
- `messages` input
- `keyword_match_mode: "or"`
- retrieval-stage match threshold
- retrieval result count / instance defaults
- embedding model
- hybrid retrieval/fusion
- query rewriting
- reranking model
- source normalization and deduplication
- public response schema
- UI
- visitor retry behavior

No AI Search sync is required.
