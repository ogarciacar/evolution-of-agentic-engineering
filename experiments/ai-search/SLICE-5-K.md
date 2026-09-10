# Slice 5K — Precision benchmark

## Question

Can we replace example-by-example relevance inspection with a repeatable precision benchmark for the fixed AI Search evaluation corpus?

## Starting condition

Slice 5H is merged and is the production baseline:

- `keyword_match_mode: "or"`
- 30/30 non-zero attempts across repeated 10-query reliability runs
- 0 request/API errors
- roughly 0.9 s median latency
- known ranking imperfections, including `What has Spotify reported?` occasionally ranking unrelated Cursor/pstack evidence ahead of Spotify evidence

Slices 5I and 5J showed why a precision benchmark is needed. Reranking improved the targeted Spotify example, but either reduced recall or degraded ordering for other questions such as code search.

## Change

This slice changes evaluation only. It does not change the Worker or AI Search configuration.

Add:

1. `precision-judgments.json` — an explicit v1 set of accepted source paths for Q01–Q10, with a short rationale for each judgment.
2. `evaluate-precision.mjs` — a production evaluator that runs the existing fixed queries and computes:
   - Hit@1
   - Hit@5
   - Mean Reciprocal Rank (MRR)
3. CI execution of the precision benchmark alongside the existing reliability characterization.

The evaluator records the ranked top-five output for each representative query so precision failures remain inspectable rather than being reduced to a single score.

## Metric semantics

For one query attempt:

- `Hit@1 = 1` when rank 1 is in the accepted relevance set, otherwise 0.
- `Hit@5 = 1` when any of ranks 1–5 is in the accepted relevance set, otherwise 0.
- reciprocal rank is `1 / rank` for the first accepted result, or 0 if there is no accepted result in the top five.

Aggregate metrics are calculated across all query attempts. Errors and zero-result attempts count as misses rather than being excluded.

## Judgment policy

The v1 judgments are intentionally small and human-reviewable. They are not intended to be exhaustive ground truth.

A change to `precision-judgments.json` changes the benchmark itself and should therefore be reviewed separately from a retrieval/configuration experiment. Future search experiments should normally keep the judgment set fixed.

## Acceptance

Keep Slice 5K if:

- the evaluator validates exact Q01–Q10 judgment coverage
- CI can run the benchmark against production without changing retrieval
- the report exposes Hit@1, Hit@5, MRR, per-query first-relevant ranks, and representative ranked outputs
- the resulting 5H numbers are useful as a stable comparison baseline for future experiments

This slice does not introduce pass/fail precision thresholds yet. Its first purpose is characterization and benchmark establishment.

## Deliberately unchanged

- production Worker
- AI Search namespace binding
- `messages` request shape
- `keyword_match_mode: "or"`
- index / sync
- corpus and path filters
- embedding model
- hybrid fusion
- result count
- query rewriting
- reranking
- public response schema
- UI
- visitor retry behavior

No deployment and no AI Search sync are required.
