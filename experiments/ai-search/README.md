# AI Search retrieval evaluation

This directory contains the stable evaluation contract for the production `GET /api/search` retrieval surface.

The evaluation answers two separate questions:

1. **Reliability:** does an unchanged query consistently return usable on-site results?
2. **Precision:** does accepted relevant evidence appear early in the returned ranking?

It does not generate answers, retry visitor requests, or use an LLM to judge relevance.

## Production baseline

The current production retrieval baseline is **5H**:

```text
Cloudflare AI Search
  hybrid retrieval / instance defaults
  + per-request keyword_match_mode = "or"
        ↓
first returned candidates
        ↓
source-URL normalization + deduplication
        ↓
at most five unique on-site source pages
```

There is no application-side reranker, query rewriting, or visitor retry.

## Frozen benchmark corpus

`evaluation-queries.json` contains ten fixed production questions, Q01–Q10.

`precision-judgments.json` contains explicit, human-reviewable accepted source paths for those questions. The judgments are intentionally small seed relevance sets rather than exhaustive truth.

Changing the judgments changes the benchmark itself and should be reviewed separately from retrieval changes.

## Reliability evaluator

Run:

```bash
node experiments/ai-search/evaluate.mjs --attempts 3 --slow-ms 7000
```

To write a report:

```bash
node experiments/ai-search/evaluate.mjs \
  --attempts 3 \
  --slow-ms 7000 \
  --output .artifacts/ai-search-reliability.md
```

The evaluator records non-zero, zero-result, request/API error, duplicate-source, off-site provenance, title, and latency diagnostics. It classifies repeated queries as stable or transient/persistent zero/error cases.

A failed or zero-result attempt is evidence of production unreliability; the evaluator does not hide it with automatic retry behavior.

## Precision evaluator

Run:

```bash
node experiments/ai-search/evaluate-precision.mjs --attempts 3
```

To write a report:

```bash
node experiments/ai-search/evaluate-precision.mjs \
  --attempts 3 \
  --output .artifacts/ai-search-precision.md
```

Metrics:

- **Hit@1:** the first result is in the accepted relevance set.
- **Hit@5:** at least one accepted source appears in the first five results.
- **MRR:** reciprocal rank of the first accepted relevant result.

Errors and zero-result attempts count as misses rather than being excluded.

## 5M baseline variance envelope

Slice 5M characterized unchanged 5H across **five independent runs / 150 query-attempts**.

Observed production envelope:

| Metric | 5H baseline |
| --- | ---: |
| Reliability | 150/150 non-zero |
| Zero-result attempts | 0 |
| Request/API errors | 0 |
| Hit@5 | 1.000 in every run |
| Aggregate Hit@1 | 0.680 |
| Hit@1 run range | 0.633–0.733 |
| Mean MRR | 0.777 |
| MRR run range | 0.740–0.827 |
| P50 latency run range | 904–1069 ms |
| P90 latency run range | 1018–1202 ms |

The key interpretation is that **availability is stable while ranking has meaningful natural variance**.

A future ranking experiment should therefore not be accepted for a small single-run gain. It should preserve full reliability and Hit@5 while producing a repeatable precision improvement clearly outside the 5H variance envelope.

## Experiment acceptance rule

For retrieval/ranking experiments evaluated with the same Q01–Q10 corpus:

- preserve 150/150 non-zero across five independent 3-attempt runs;
- preserve Hit@5 = 1.000 in every run;
- require Hit@1 to be clearly above the observed 5H upper range of 0.733;
- require MRR to be clearly above the observed 5H upper range of 0.827;
- reject material latency regression;
- inspect per-query rank movement to detect quality trades hidden by aggregates.

This rule is a comparison discipline for the current small benchmark, not a universal search-quality SLA.

## CI boundary

PR CI runs only deterministic repository contracts. It must not treat a live production benchmark as validation of undeployed PR Worker code.

The production benchmark is a separate manually triggered GitHub Actions workflow. This makes the thing being measured explicit: **the Worker currently deployed at `agenticengineering.science`**.

For a controlled production experiment:

1. prepare the branch and let deterministic PR contracts pass;
2. deploy only the intended experimental Worker change;
3. manually run `AI Search production benchmark` against that deployment;
4. repeat independent runs when the acceptance rule requires them;
5. accept and merge, or reject and restore `main`;
6. after restoration, run one production benchmark to confirm the 5H envelope is back.

Retrieval-request changes do not require an AI Search index sync. Corpus/indexing changes are a different class of experiment and may require synchronization.

## Current known ranking weakness

Under 5H, relevant evidence is consistently present in the top five, but some questions can rank it too low. The remaining weakness is concentrated rather than a general recall failure; Q09 and Q10 have been the clearest examples in recent runs.

Do not tune specifically to those two queries without checking the full frozen benchmark for regressions.

## History

The compact intervention history and accepted/rejected findings are maintained in [`EXPERIMENT-LOG.md`](EXPERIMENT-LOG.md). Detailed implementation history remains available in Git and the corresponding pull requests.