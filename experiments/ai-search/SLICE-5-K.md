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

A source counts as relevant when it materially helps answer the question, including negative or counter-evidence. Relevance is not limited to evidence that supports the premise of the question.

A change to `precision-judgments.json` changes the benchmark itself and should therefore be reviewed separately from a retrieval/configuration experiment. Future search experiments should normally keep the judgment set fixed.

## 5H production baseline

The benchmark ran against the merged/deployed 5H Worker with three attempts per question.

Reliability in the same run:

- 30/30 non-zero attempts
- 0 zero-result attempts
- 0 request/API errors
- 10/10 stable-nonzero queries
- latency P50 926 ms, P90 981 ms, max 3,909 ms

Precision:

- Hit@1: **0.667 (20/30)**
- Hit@5: **1.000 (30/30)**
- MRR: **0.775**
- no relevant-result misses in the top five

Per-query first-relevant ranks across the three attempts:

| ID | Hit@1 | Hit@5 | MRR | First relevant ranks |
| --- | ---: | ---: | ---: | --- |
| Q01 | 1.000 | 1.000 | 1.000 | 1, 1, 1 |
| Q02 | 1.000 | 1.000 | 1.000 | 1, 1, 1 |
| Q03 | 1.000 | 1.000 | 1.000 | 1, 1, 1 |
| Q04 | 0.667 | 1.000 | 0.750 | 1, 4, 1 |
| Q05 | 1.000 | 1.000 | 1.000 | 1, 1, 1 |
| Q06 | 0.000 | 1.000 | 0.500 | 2, 2, 2 |
| Q07 | 1.000 | 1.000 | 1.000 | 1, 1, 1 |
| Q08 | 1.000 | 1.000 | 1.000 | 1, 1, 1 |
| Q09 | 0.000 | 1.000 | 0.200 | 5, 5, 5 |
| Q10 | 0.000 | 1.000 | 0.300 | 2, 5, 5 |

The benchmark makes the remaining precision problem concrete. Q06 consistently retrieves Spotify evidence but only from rank 2 because an unrelated source can rank first. Q09 consistently finds directly relevant organizational-context evidence only at rank 5. Q10 also has weak top-rank precision. Q04 shows ranking variability across repeated identical questions.

## Acceptance

Slice 5K passes its acceptance criteria:

- the evaluator validates exact Q01–Q10 judgment coverage
- CI runs the benchmark against production without changing retrieval
- the report exposes Hit@1, Hit@5, MRR, per-query first-relevant ranks, and representative ranked outputs
- the 5H measurements provide a stable comparison baseline for future experiments

This slice deliberately does not introduce pass/fail precision thresholds yet. Future retrieval experiments can now be evaluated against both reliability and precision without optimizing a single example in isolation.

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
