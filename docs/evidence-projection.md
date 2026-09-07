# Evidence projection contract

The canonical evidence corpus lives in `evidence/*.yaml`. D1 is a deterministic, query-oriented projection of that corpus for runtime publication; it is not a second evidence store.

## Invariants

1. **Git/YAML is canonical.** Evidence is authored and reviewed through the YAML records in this repository.
2. **D1 is rebuildable.** Deleting a projection and rebuilding it from its Git source must not lose research information.
3. **No D1-only knowledge.** Every projected value is derived deterministically from canonical repository state.
4. **No direct D1 authoring.** Changes flow through Git → validation → projection.
5. **Stable evidence identity comes from the artifact.** `evidence_id` is the YAML filename without `.yaml`; `github_path` is its repository-relative path.
6. **Projection identity is explicit.** Logical evidence identity in D1 is `(projection_id, evidence_id)`.

## Projection scopes

Production D1 uses only:

```text
main
```

Preview D1 contains:

```text
main
+ one 12-character lowercase head-SHA projection for each active PR preview
```

Preview `main` is rebuilt from canonical `origin/main`, independently from the current PR checkout. PR projections are ephemeral: they are deleted when the PR closes and a scheduled reconciliation sweep removes any orphan a lifecycle event missed.

## Runtime selection

Runtime evidence surfaces resolve a projection using this precedence:

```text
X-Evidence-Projection header
        ↓ if absent
?projection_id=
        ↓ if absent
main
```

Accepted selectors are `main` or exactly 12 lowercase hexadecimal characters. The header is the canonical selector and takes precedence over the browser-friendly query parameter.

Responses expose the selected projection through `X-Evidence-Projection` and vary on the selector header.

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
| evidence claim relationships | rows in `evidence_claims` |
| `interpretation` | `evidence.interpretation` |
| `model_implication.verdict` | `evidence.verdict` |
| `model_implication.explanation` | `evidence.verdict_explanation` |
| `what_this_does_not_establish` | `evidence.limitations_json` |
| `open_question` | `evidence.open_question` |
| `assessment.assisted_by_ai` | `evidence.assisted_by_ai` (`0`/`1`) |

Stages, Selection conditions, and claim relationships are relational because they have demonstrated cross-corpus query value. Narrative arrays remain lossless JSON text until a query requires further normalization.

## Runtime read model

Runtime evidence publication shares one D1 read model in `functions/_lib/evidence-read-model.js`. It supplies evidence to the API, Scale Signal routes, and the homepage Evidence Landscape rather than maintaining separate query semantics for each surface.

The publication path is:

```text
evidence/*.yaml
      ↓
CI validation
      ↓
D1 projection
      ↓
shared runtime evidence read model
      ↓
├── /api/evidence
├── /signals/:id
└── / → Evidence Landscape
```

## Intended queries

The projection makes it inexpensive to ask questions such as:

- Which evidence supports, refines, contradicts, or leaves the model inconclusive?
- Which Selection conditions recur most often?
- Which producers have evidence mapped to Cooperation?
- How do mapped stages, conditions, verdicts, and claim relationships change over time?
- Which conditions co-occur in the corpus?

Indexes should remain limited to demonstrated query dimensions rather than mirroring every YAML field relationally.

## Integrity and rebuild

A correct implementation can recreate a projection by applying the migrations and projecting the corresponding Git corpus. D1 must never be required to reconstruct canonical YAML evidence.

Projection synchronization is idempotent. Child rows belong to the same projection scope as their evidence row. Preview cleanup is restricted to preview D1 and must never delete `projection_id = 'main'`.

## Security boundary

Projection selection changes which already-projected evidence corpus is read; it does not grant write authority or bypass evidence validation. Production publication remains sourced from validated `main`. Preview selectors are bounded to `main` or a validated short SHA and operate against the preview database only.

## Ownership

- `evidence/*.yaml` — canonical research input.
- CI — semantic, safety, and projection validation.
- D1 — rebuildable query/read projection.
- `functions/_lib/evidence-read-model.js` — shared runtime evidence access.
- runtime routes — publication surfaces.

Historical implementation decisions remain available in Git history; this document is the maintained projection contract.