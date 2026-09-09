# Slice 4E — Search result visual alignment

## Goal

Make `Ask the evidence` results use the same visual grammar as `Interrogate the corpus` without changing retrieval behavior.

AI Search remains responsible for:

- query matching
- result ranking
- the matched passage

The existing D1 evidence projection is used only to enrich `/signals/**` results for presentation.

## Flow

```text
AI Search
  ↓
ranked signal URL + matched passage
  ↓
/api/evidence/{signal-id}
  ↓
date / producer / mapping / verdict
  ↓
enriched search card
```

At most five evidence metadata requests are made, in parallel. If metadata enrichment fails for an individual result, that result falls back to the existing search-card presentation rather than failing the search.

`/practices` remains the collection result introduced in Slice 4D and is not looked up through the evidence API.

## Signal card

An enriched signal result shows:

- source date and producer
- canonical evidence headline
- transition/stage and selection-condition chips
- a labelled query-relevant matched passage
- model verdict
- `Read Scale Signal →`

Known evidence-section headings in crawler excerpts are presentation-normalized. In particular, an excerpt beginning with `What this does not establish` is labelled as that epistemic boundary rather than exposing raw Markdown syntax.

## Deliberately unchanged

- AI Search corpus and sync state
- retrieval count
- source-URL deduplication
- ranking order
- embeddings
- chunk size / overlap
- score threshold
- hybrid search
- query rewriting
- reranking
- Worker `/api/search` response schema

No AI Search sync or Worker deployment is required for this slice; the change is in the Pages-hosted search UI and uses the existing evidence API.
