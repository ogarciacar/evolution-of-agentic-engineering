# Slice 5N — deterministic top-five lexical reranking

## Hypothesis

5H already retrieves at least one accepted relevant source in the top five for every benchmark query, but top-result ordering varies materially. A small deterministic application-side reranker may improve top-result relevance without changing retrieval, candidate recall, or Cloudflare configuration.

## Baseline

Slice 5M characterized unchanged 5H over five independent runs / 150 query-attempts:

- reliability: 150/150 non-zero
- Hit@5: 1.000 in every run
- aggregate Hit@1: 0.680
- Hit@1 run range: 0.633–0.733
- mean MRR: 0.777
- MRR run range: 0.740–0.827
- P50 run range: 904–1069 ms
- P90 run range: 1018–1202 ms

## Intervention

Keep the existing 5H AI Search request unchanged:

- hybrid retrieval at instance defaults
- `keyword_match_mode: "or"`
- no Cloudflare reranker
- no query rewriting
- no index or corpus changes

After normalizing and deduplicating the first five source pages, reorder only those same five pages using deterministic lexical affinity between the user query and each result's title + excerpt.

Rules:

- tokenize lower-cased alphanumeric terms
- ignore common interrogative/function words
- count unique query-token overlap
- title matches receive weight 2
- excerpt matches receive weight 1
- preserve original AI Search order for ties
- never add, remove, or backfill source pages

The public `score` remains the original AI Search score; lexical affinity is only an application-side ordering signal and is not exposed as a replacement retrieval score.

## Evaluation protocol

After deployment, run the frozen 5K benchmark five independent times, matching 5M: Q01–Q10 × 3 attempts per run = 150 query-attempts.

Accept only if:

- reliability remains 150/150 non-zero
- Hit@5 remains 1.000 in every run
- Hit@1 is clearly above the 5H upper observed range of 0.733
- MRR is clearly above the 5H upper observed range of 0.827
- latency does not materially regress from the 5H envelope

A precision result inside the 5H variance range is inconclusive, not an improvement.

## Production results

Five independent post-deploy runs completed successfully.

### Reliability

- 150/150 non-zero
- 0 zero-result attempts
- 0 request/API errors
- Hit@5: 1.000 in every run

### Precision

| Run | Hit@1 | MRR |
| --- | ---: | ---: |
| 1 | 0.733 | 0.837 |
| 2 | 0.767 | 0.848 |
| 3 | 0.733 | 0.837 |
| 4 | 0.767 | 0.853 |
| 5 | 0.667 | 0.792 |

- aggregate Hit@1: **0.733 (110/150)**
- Hit@1 run range: **0.667–0.767**
- mean MRR: **0.833**
- MRR run range: **0.792–0.853**

### Latency

- P50 run range: **901–1024 ms**; mean **936 ms**
- P90 run range: **949–1309 ms**; mean **1042 ms**
- maximum observed request: **3188 ms**
- 0 attempts >= 7000 ms

### Query-level behavior

The lexical rule produced useful targeted gains but also a repeatable regression:

- Q06 (`What has Spotify reported?`) moved to a relevant Spotify source at rank 1 in every measured attempt.
- Q09 improved materially relative to 5H but still varied between ranks 1 and 2.
- Q07 (`What practices relate to code search?`) regressed from the 5H rank-1 behavior to a relevant source at rank 2 in repeated 5N runs.
- Q10 remained weak, with the first accepted relevant result consistently at rank 5.

## Decision — reject

5N does not meet its acceptance criterion.

Although mean MRR (0.833) is slightly above the 5H maximum observed run value (0.827), the aggregate Hit@1 of 0.733 is exactly the upper edge of the 5H baseline range rather than clearly above it. Individual 5N runs also overlap substantially with the 5H variance envelope. The deterministic regression on Q07 further shows that the generic lexical rule trades ranking quality between query types rather than providing a robust overall improvement.

The experiment is therefore rejected. Keep 5H as the production baseline and do not merge the lexical reranking behavior.

## Scope

This slice changed only application-side ordering of the already-selected top five source pages. It did not change AI Search retrieval options, indexing, corpus, judgments, source diversity, result count, or visitor retry behavior.
