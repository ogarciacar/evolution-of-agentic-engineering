# Slice 5B — Bounded zero-result retry

## Question

Can one bounded Worker retry reduce visitor-visible zero-result responses without making latency unacceptable?

## Evidence from Slice 5A

Across 30 production attempts:

- 26/30 returned one or more results;
- 4/30 returned zero results;
- 0/30 returned HTTP/API errors;
- 4/10 queries were `transient-zero`;
- 0/10 queries were `persistent-zero`;
- latency P50 was 4,144 ms;
- latency P90 was 8,324 ms;
- latency max was 10,230 ms.

The transient-zero queries each had at least one successful observation near or below five seconds:

- Q01: 1,837 ms;
- Q02: 1,608 ms;
- Q03: 1,253 ms;
- Q05: 4,884 ms.

This makes a five-second retry budget a reasonable first experiment: it gives a second request enough time to match an observed successful path while bounding the added visitor wait.

## Intervention

Change one production behavior only:

1. call AI Search once with the existing retrieval options;
2. if that call returns one or more chunks, return normally and do not retry;
3. if that call returns zero chunks, retry the exact same request once;
4. wait at most 5,000 ms for the retry;
5. if the retry returns chunks within the budget, use them;
6. if the retry returns zero chunks, errors, or exceeds the budget, preserve the original empty `200` response.

First-attempt AI Search errors are unchanged and continue to return `503`.

The retry is intentionally triggered by **zero AI Search chunks**, not by post-normalization result count.

## Telemetry

No raw query is logged. The Worker records:

- `first_candidate_count`;
- `retry_attempted`;
- `retry_candidate_count`;
- `retry_recovered`;
- `retry_error`;
- `retry_timed_out`;
- `retry_budget_ms`;
- `first_latency_ms`;
- `retry_latency_ms`;
- total `latency_ms`;
- final `zero_results`.

## Deliberately unchanged

- AI Search corpus and path filters;
- retrieval count (`max_num_results: 5`);
- source-URL deduplication;
- embeddings, chunk size and overlap;
- hybrid search and threshold;
- query rewriting and reranking;
- result normalization and UI presentation;
- public `/api/search` response schema.

## Production validation

Deploy this branch's Worker, then rerun the Slice 5A reliability harness against production with the same 10 questions and three rounds.

Compare directly with the Slice 5A baseline:

- visitor-visible zero-result attempts: baseline 4/30;
- request/API error attempts: baseline 0/30;
- latency P50: baseline 4,144 ms;
- latency P90: baseline 8,324 ms;
- latency max: baseline 10,230 ms;
- duplicate-source attempts: baseline 0;
- off-site URLs: baseline 0;
- missing titles: baseline 0.

## Keep / reject rule

Keep the retry only if the comparable production run shows a material reduction in visitor-visible zero-result attempts without introducing API errors or unacceptable tail latency.

Reject it if zeros do not improve, if retry behavior creates new request/API errors, or if the tail-latency cost outweighs the recovered searches.

Do not change ranking or retrieval configuration in response to this experiment; those are separate variables.
