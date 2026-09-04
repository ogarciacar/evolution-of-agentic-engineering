# Evidence projection contract

The canonical evidence corpus lives in `evidence/*.yaml`. The D1 representation is a query projection of that corpus, not a second evidence store.

## Invariants

1. **GitHub/YAML is canonical.** Evidence is authored and reviewed only through the YAML records in this repository.
2. **D1 is rebuildable.** Deleting the projection and rebuilding it from `main` must not lose research information.
3. **No D1-only knowledge.** Every projected value is derived deterministically from a canonical YAML record or its repository path.
4. **No direct D1 authoring.** Changes flow YAML → validation → projection.
5. **Stable identity comes from the artifact.** `evidence_id` is the YAML filename without `.yaml`; `github_path` is its repository-relative path.

## Mapping

| Canonical YAML / repository value | Projection |
| --- | --- |
| filename without `.yaml` | `evidence.evidence_id` |
| repository-relative path | `evidence.github_path` |
| `source.title` | `evidence.source_title` |
| `source.date` | `evidence.source_date` |
| `source.producer` | `evidence.producer` |
| `source.producer_type` | `evidence.producer_type` |
| `source.type` | `evidence.source_type` |
| `source.provenance` | `evidence.provenance` |
| `source.url` | `evidence.source_url` |
| `presentation.headline` | `evidence.headline` |
| `presentation.summary` | `evidence.summary` |
| `observed` | `evidence.observed_json` |
| `scale.label` | `evidence.scale_label` |
| `scale.summary` | `evidence.scale_summary` |
| `mapping.transition.from` | `evidence.transition_from` |
| `mapping.transition.to` | `evidence.transition_to` |
| `mapping.transition.adjacent_stage` | `evidence.adjacent_stage` |
| `mapping.stages[]` | rows in `evidence_stages` |
| `mapping.conditions[]` | rows in `evidence_conditions` |
| `interpretation` | `evidence.interpretation` |
| `model_implication.verdict` | `evidence.verdict` |
| `model_implication.explanation` | `evidence.verdict_explanation` |
| `what_this_does_not_establish` | `evidence.limitations_json` |
| `open_question` | `evidence.open_question` |
| `assessment.assisted_by_ai` | `evidence.assisted_by_ai` (`0`/`1`) |

Arrays that already have demonstrated cross-corpus query value—stages and Selection conditions—are relational. Narrative arrays are retained losslessly as JSON text until a cross-corpus query requires further normalization.

## Intended queries

The projection should make it inexpensive to ask questions such as:

- Which evidence supports, refines, contradicts, or leaves the model inconclusive?
- Which Selection conditions recur most often?
- Which producers have evidence mapped to Cooperation?
- How do mapped stages, conditions, and verdicts change over time?
- Which conditions co-occur in the corpus?

The indexes in `migrations/0001_evidence_projection.sql` are limited to these demonstrated query dimensions: date, producer, verdict, stage, and condition.

## Rebuild test

A correct implementation can drop the entire D1 database, apply the migrations, project every YAML record from `main`, and recreate the same queryable state. D1 must never be required to reconstruct a YAML evidence record.

## Not part of this slice

S2 defines the representation only. It does not create a Cloudflare D1 database, implement the YAML importer, synchronize from CI, expose an API, add R2, or change the website. Population and deterministic rebuild behavior belong to the next slice.
