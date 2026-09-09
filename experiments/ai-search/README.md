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

Why this intervention comes first:

- Q03 dependency-lineage retrieval is weak.
- Q07 code-search retrieval is weak.
- both concepts are represented explicitly on `/practices` as company/use-case/problem/practice relationships.
- the current index is otherwise strong enough that changing semantic ranking before fixing missing corpus coverage would confound the experiment.

The intervention deliberately does **not**:

- remove `evidence.html`
- deduplicate source URLs
- change chunk size or overlap
- change result count or score threshold
- enable query rewriting or reranking
- modify the Worker or visitor UI

After this change reaches production, trigger an AI Search sitemap sync and rerun the exact ten baseline queries. Compare Q03 and Q07 first, then check whether any previously strong queries regress. Only after that comparison should Intervention B be selected.