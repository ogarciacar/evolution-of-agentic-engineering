# AI Search retrieval evaluation

Slice 3 evaluates the production `/api/search` retrieval surface before any tuning.

## Run

```bash
node experiments/ai-search/evaluate.mjs
```

To write a Markdown report:

```bash
node experiments/ai-search/evaluate.mjs \
  --output .artifacts/ai-search-evaluation.md
```

The runner uses `evaluation-queries.json` and defaults to:

```text
https://agenticengineering.science/api/search
```

It records returned titles, source URLs, excerpts, scores, latency, and mechanical diagnostics. It deliberately does not assign automated semantic-relevance labels.

## Baseline — 2026-09-09

The first production run used the ten checked-in queries with the Slice 1 retrieval configuration unchanged.

Mechanical results:

- 10/10 queries returned results
- 0 request/API errors
- 0 off-site source URLs
- 7/10 queries contained duplicate source pages in the top five
- 3 returned results had no useful source title; these were `evidence.html` results
- observed per-query latency ranged from ~0.96 s to ~10.97 s

### What worked well

**Scale retrieval is strong.** Q04 (`coding agents operating at scale`) returned five distinct evidence pages spanning OpenAI, Anthropic, Spotify and Bun-related infrastructure evidence. The excerpts frequently surfaced epistemic-boundary text, which is valuable for an evidence-based site.

**Verification retrieval is useful.** Q05 put Spotify's verification-feedback evidence first and also surfaced related Spotify context, fleet-scale and orchestration evidence.

**Spotify discovery is useful.** Q06 returned the major Spotify evidence records across verification, context engineering, fleet-scale maintenance and the `Coding stops being the constraint` signal.

**Autonomy-boundary retrieval is useful.** Q10 surfaced multiple `What this does not establish` / human-steering limitations from different evidence records rather than inventing a synthesized contradiction.

**Provenance is intact.** Every returned source URL stayed on `agenticengineering.science`.

### Failure modes observed

#### 1. Duplicate chunks consume result slots

Seven of ten queries returned more than one chunk from the same source page.

Examples:

- Q01 used 3 of 5 slots for `2026-06-03-spotify-code-with-claude`
- Q02 used 3 of 5 slots for `2026-02-12-gloaguen-et-al-context-files-evaluation`
- Q08 used 3 of 5 slots for `2026-06-16-anthropic-agentic-coding-persistent-returns-to-expertise`

This reduces evidence diversity even when the repeated page is relevant.

#### 2. Dependency-lineage retrieval is poor

Q03 (`Which companies use dependency lineage?`) did not retrieve the explicit dependency-lineage practice evidence expected from the corpus. Its top results were largely unrelated or only loosely related, and `evidence.html` appeared second.

A likely corpus-surface explanation is already known: the current Sitemap-based AI Search index contains signal pages, while `/practices` is not currently listed in the sitemap. The Practice Observations surface contains explicit company/use-case/problem/practice relationships such as dependency-lineage practices.

This is an observation, not yet a decision to change the sitemap.

#### 3. Code-search retrieval is weak

Q07 (`What practices relate to code search?`) ranked `evidence.html` first and did not clearly surface the expected explicit cross-repository code-search practice evidence. This has the same likely corpus-surface relationship as Q03: practice observations are not guaranteed to be indexed in Sitemap mode.

#### 4. Human-review bottleneck retrieval misses important evidence

Q08 (`human review becoming a bottleneck`) did not surface `Coding stops being the constraint`, even though that evidence record reports increased pull-request review pressure. Instead, the top five were dominated by an evals record, the generic Evidence page and three chunks from the Anthropic human-expertise record.

This is a missing-important-evidence failure, not a zero-result failure.

#### 5. Generic Evidence page contaminates some queries

`https://agenticengineering.science/evidence.html` appeared for Q03, Q07 and Q08 with title `Untitled result` and generic `Interrogate the corpus` text.

This is low-value retrieval compared with an underlying evidence record and is a candidate for later crawl-surface tuning.

#### 6. Chunk boundaries are sometimes more useful than others

Some results begin at front matter or `What this does not establish` sections rather than the most directly responsive observed evidence. This is occasionally valuable, particularly for Q10, but can also make otherwise relevant results feel indirect.

### Candidate questions for Slice 4

Do not apply these automatically. Test one intervention at a time against this baseline:

- should top results be deduplicated by source URL?
- should `/practices` become an indexed public research surface, likely by adding it to the sitemap?
- should `evidence.html` be excluded from the AI Search crawl surface?
- after corpus-surface fixes, do chunk size or result-count changes still appear necessary?
- does Q08 need retrieval/query behavior changes after duplicate and corpus-surface issues are addressed?

The baseline argues for fixing corpus coverage and result diversity before changing semantic ranking behavior.

## Slice 4 tuning log

### Intervention A — Practice Observations corpus coverage

Change one dimension only: add the existing public `/practices` runtime route to `sitemap.xml` so the Sitemap-mode AI Search crawler can index the Practice Observations surface.

Why this intervention came first:

- Q03 dependency-lineage retrieval was weak.
- Q07 code-search retrieval was weak.
- both concepts are represented explicitly on `/practices` as company/use-case/problem/practice relationships.
- the existing index was otherwise strong enough that changing semantic ranking before fixing missing corpus coverage would confound the experiment.

After the production sitemap change and a completed AI Search sync:

- Q03 surfaced `/practices` at rank 2.
- Q07 surfaced `/practices` at rank 1.
- duplicate-source queries improved from 7/10 in the original baseline to 5/10 in the repeated post-sync run.
- provenance remained on-site.

This supports keeping `/practices` in the searchable corpus.

### Intervention B — Remove generic evidence landing surfaces from AI Search

Change the AI Search path filters only. Remove:

```text
**/evidence
**/evidence.html
```

Keep:

```text
**/signals/**
**/practices
```

The public website and public sitemap are unchanged; only the AI Search corpus excludes the two generic evidence navigation/query surfaces.

After sync and a repeated evaluation:

- `/evidence` and `/evidence.html` no longer appeared in any returned result.
- Q07 kept `/practices` at rank 1 and the substantive Spotify context-engineering signal moved up to rank 2.
- missing-title results dropped from 4 in the post-A run to 2; the remaining missing titles are `/practices`.
- duplicate-source queries remained 5/10 on the repeated run, so corpus hygiene did not solve result diversity.
- a single zero-result query continued to move between evaluation runs, indicating a separate latency/runtime instability rather than a corpus-specific regression.

This supports keeping the AI Search corpus restricted to signal pages and Practice Observations.

### Intervention C — Source diversity at the API boundary

Change one dimension only: return at most one result per source page while preserving the original AI Search retrieval workload.

Implementation:

- request the same top 5 ranked chunks from AI Search as before;
- preserve AI Search order;
- keep only the highest-ranked chunk for each source URL;
- return the remaining 1–5 unique source pages without backfilling from a larger candidate pool;
- keep the same public result shape.

This does not change embeddings, chunk size, overlap, score threshold, hybrid search, query rewriting, reranking, or the visitor UI.

An initial version requested 10 candidates in order to refill the response to five unique sources. That version produced 0 duplicate-source queries but also 4/10 zero-result queries in the first post-deploy run, so it changed retrieval workload and source diversity at the same time and was rejected as a clean experiment.

The revised version restored `max_num_results: 5` and deduplicates only those original five candidates. Two production runs showed:

- duplicate-source queries: 0/10 in both runs, down from 5/10 after Intervention B;
- off-site provenance: 0 results;
- the repeat run returned results for 9/10 queries, matching the previously observed intermittent single-zero-result pattern;
- the zero-result query moved to Q07 on the repeat, supporting the existing upstream instability hypothesis rather than a deduplication-specific failure;
- Q03 continued to surface `/practices` at rank 2;
- scale, verification, Spotify, human-review, organizational-context and autonomy queries retained substantive evidence results;
- result counts can intentionally be below five when multiple top-five chunks came from the same source.

This supports keeping source-URL deduplication at the API boundary while treating intermittent zero-result behavior as a separate reliability issue.