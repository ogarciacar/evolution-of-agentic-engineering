# Slice 5A — Reliability characterization

## Question

Are the intermittent zero-result responses observed during Slice 4 reproducible for unchanged queries, and are they correlated with slow retrieval or request/API failures?

## Scope

Observation only. Do not change the production Worker, AI Search index, ranking, chunking, result count, source deduplication, query rewriting, reranking, or visitor retry behavior.

Run the existing 10-query evaluation corpus repeatedly against the production `/api/search` endpoint.

## Measurement

CI runs three rounds of the same 10 questions. Each query is classified as:

- `stable-nonzero` — every attempt returns at least one result;
- `transient-zero` — at least one attempt returns zero results and another returns results;
- `persistent-zero` — every attempt returns zero results without an HTTP/API error;
- `transient-error` — at least one attempt has an HTTP/API error while another does not;
- `persistent-error` — every attempt has an HTTP/API error.

The report also records:

- per-attempt result count;
- unique source count;
- latency;
- attempts at or above 7 seconds;
- HTTP/API errors;
- duplicate-source diagnostics;
- off-site provenance and missing-title diagnostics;
- latency P50, P90 and maximum.

Attempts are run as rounds over the whole corpus rather than immediate per-query retries. The measurement does not hide an initial zero result by automatically retrying a visitor request.

## Acceptance

Slice 5A is complete when a production report gives enough repeated evidence to distinguish a stable semantic zero from intermittent retrieval behavior.

Possible follow-ups belong in later slices:

- Worker-side retry/fallback behavior;
- timeout changes;
- Cloudflare AI Search configuration changes;
- service-level monitoring or alerting.

Those are deliberately out of scope here and may require a Worker deployment.