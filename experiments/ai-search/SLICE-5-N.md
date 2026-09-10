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
- no reranker
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

## Scope

This slice changes only application-side ordering of the already-selected top five source pages. It does not change AI Search retrieval options, indexing, corpus, judgments, source diversity, result count, or visitor retry behavior.
