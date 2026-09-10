# Slice 5M — 5H baseline variance characterization

## Purpose

Quantify the natural run-to-run variation of the frozen 5K precision benchmark against the unchanged 5H production retrieval configuration before testing another ranking change.

This slice is evaluation-only. It does not change the Worker, AI Search configuration, corpus, index, relevance judgments, response schema, or visitor behavior.

## Method

Five independent production benchmark runs were executed against `https://agenticengineering.science/api/search` with 5H unchanged.

Each run used:

- the same Q01–Q10 query set
- three attempts per query
- the same 5K binary relevance judgments
- the same reliability characterization
- the same public top-five result boundary

That produces 30 query-attempts per run and 150 query-attempts across the characterization.

## Results

| Run | Non-zero | Errors | Hit@1 | Hit@5 | MRR | P50 | P90 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 30/30 | 0 | 0.733 | 1.000 | 0.827 | 1027 ms | 1147 ms | 4151 ms |
| 2 | 30/30 | 0 | 0.667 | 1.000 | 0.765 | 904 ms | 1018 ms | 3631 ms |
| 3 | 30/30 | 0 | 0.700 | 1.000 | 0.790 | 923 ms | 1028 ms | 3253 ms |
| 4 | 30/30 | 0 | 0.633 | 1.000 | 0.740 | 1069 ms | 1202 ms | 2660 ms |
| 5 | 30/30 | 0 | 0.667 | 1.000 | 0.765 | 997 ms | 1067 ms | 3025 ms |

### Aggregate baseline

- Reliability: **150/150 non-zero**, 0 zero-result attempts, 0 request/API errors
- Stable query-runs: **50/50**
- Hit@1: **0.680 (102/150)**
- Hit@5: **1.000 (150/150)**
- Mean MRR: **0.777**
- Hit@1 run range: **0.633–0.733**
- MRR run range: **0.740–0.827**
- P50 run range: **904–1069 ms**; mean **984 ms**
- P90 run range: **1018–1202 ms**; mean **1092 ms**
- Maximum observed request latency: **4151 ms**
- Slow attempts (>= 7000 ms): **0**

## Interpretation

5H is highly stable on availability and top-five recall: all 150 attempts returned results, every query-run was stable-nonzero, and every precision attempt had at least one accepted source in the top five.

Top-result ordering is materially noisier. Hit@1 moved by 0.100 absolute across unchanged runs (0.633–0.733), while MRR moved by 0.087 (0.740–0.827). A small single-run increase in Hit@1 or MRR is therefore not sufficient evidence that a retrieval change improves ranking.

This also strengthens the rejection of Slice 5L. Vector-only retrieval produced Hit@1 0.700, which sits inside the observed 5H range, and MRR 0.833, only 0.006 above the best observed 5H run, while 5L regressed reliability to 29/30 in two independent runs and pushed P90 above 5 seconds.

## Selection guardrail for future experiments

Future retrieval/ranking candidates should use the same five-run protocol with the frozen 5K judgments. Reliability remains a hard constraint: each run should remain 30/30 non-zero with zero request/API errors, and Hit@5 should remain 1.000.

For precision, changes that remain inside the observed 5H ranges should be treated as inconclusive rather than improvements. A candidate should show a repeated shift beyond ordinary 5H variation across the five-run aggregate and keep representative Q01–Q10 rankings plausible before it is considered for production.

The observed 5H ranges are a noise floor, not permanent product targets. They should be re-characterized if the corpus, relevance judgments, or underlying AI Search service materially changes.

## Deliberately unchanged

- production Worker and 5H `keyword_match_mode: "or"`
- AI Search index/sync/corpus/path filters
- embedding model, vector threshold, hybrid fusion, reranking, query rewriting
- public result count and source-deduplication behavior
- Q01–Q10 query corpus
- 5K relevance judgments
- UI and response schema

**No deployment and no AI Search sync are required.**
