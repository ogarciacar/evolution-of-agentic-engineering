# Slice 5A — Reliability characterization

Date: 2026-09-09

## Question

Are the intermittent zero-result responses observed during Slice 4 reproducible for unchanged queries, and are they correlated with slow retrieval or request/API failures?

## Scope

Observation only. Do not change the production Worker, AI Search index, ranking, chunking, result count, source deduplication, query rewriting, reranking, or visitor retry behavior.

The existing 10-query corpus was executed in three independent rounds against the production `/api/search` endpoint. These are measurement attempts, not visitor retries.

## Production results

Across 30 production attempts:

- 26/30 attempts returned one or more results.
- 4/30 attempts returned zero results.
- 0/30 attempts returned an HTTP/API error.
- 6/10 queries were `stable-nonzero`.
- 4/10 queries were `transient-zero`.
- 0/10 queries were `persistent-zero`.
- 0/10 queries were transient or persistent API errors.
- 8/30 attempts took at least 7 seconds.
- latency P50 was 4,144 ms.
- latency P90 was 8,324 ms.
- maximum observed latency was 10,230 ms.
- duplicate-source attempts remained 0.
- off-site source URLs remained 0.
- missing titles remained 0.

Transient-zero queries were Q01, Q02, Q03, and Q05. Each returned zero results in exactly one round and useful non-zero results in the other two rounds.

## Interpretation

The observed failure mode is transient retrieval inconsistency rather than a persistent corpus or query failure.

This matters because the next experiment should target reliability rather than semantic retrieval quality:

- changing corpus coverage, ranking, chunking, embeddings, query rewriting, or reranking is not justified by these measurements;
- a narrow retry/fallback experiment is justified because the same unchanged query can recover on a subsequent independent attempt;
- any retry must be evaluated as a reliability intervention rather than treated as a relevance improvement;
- latency must be part of the acceptance criteria because a retry can improve successful-response rate while worsening visitor latency.

The measurements do not establish the root cause inside Cloudflare AI Search. They establish only the observable production behavior at the `/api/search` boundary.

## Next experiment

Slice 5B should test one Worker-side reliability intervention only: a bounded retry when AI Search returns zero chunks, with no retrieval/ranking configuration changes.

Candidate acceptance criteria:

- materially reduce visitor-visible zero-result responses;
- do not retry non-zero responses;
- preserve result ranking and source deduplication;
- cap retry count at one;
- record whether the response recovered on retry;
- establish an explicit latency budget before keeping the intervention;
- keep HTTP/API errors distinct from zero-result recovery.

Slice 5B requires a Worker deployment and should be performed when deployment access is available.
