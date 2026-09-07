# Contributing evidence

Evolution of Agentic Engineering is a working model. Contributions are welcome when they bring public evidence that may support, refine, contradict, or leave the model inconclusive.

**Anyone can propose evidence. Acceptance is reviewed.** A merged evidence contribution means the source and assessment have been accepted into the evidence record; it does not mean the model has been proven.

## Start with the assessment

Before opening a pull request, evaluate the source using `https://agenticengineering.science/apply.html`.

Assess the source against the active model and the current generated research frontier in `research-frontier.json`. For every frontier item the source materially bears on, report:

- claim and stage
- current evaluation state
- which specific evidence-needed items the source supplies, partially supplies, contradicts, or does not supply
- what uncertainty the source reduces
- what remains unresolved after considering the source

Distinguish source evidence from model-relative interpretation. Do not claim that a research gap is resolved merely because the source describes the relevant topic, architecture, or mechanism. A gap advances only when the source provides evidence called for by the frontier, narrows the question, establishes a boundary, or challenges its premise.

Conclude with one frontier-impact verdict for each materially affected claim: `ADVANCES`, `CHALLENGES`, or `DOES_NOT_ADVANCE`. These are assessment labels only; they are not stored evidence verdicts and do not replace `SUPPORTS`, `REFINES`, `CONTRADICTS`, or `INCONCLUSIVE` in the canonical evidence model.

Do not force a contribution merely because the source concerns coding agents or agentic engineering. If it does not materially affect the model or research frontier, say so.

Before creating any YAML, branch, commit, or pull request, verify that every claim intended for publication is supported solely by publicly accessible sources. If any claim depends on private, internal, confidential, credential-gated, or otherwise restricted information, stop and do not prepare or push a contribution.

The generated `research-frontier.json` is the assessment input for what the model currently needs to learn. Its canonical inputs remain the active claim evaluation and `model/research-gaps.yaml`; do not hand-edit the generated frontier to fit a source.

The research frontier is a prioritization surface, not an admission gate. Evidence that challenges the model, reveals a missing claim, or materially changes an existing interpretation remains valuable even when it does not answer a currently listed gap.

## Public evidence safety gate

**No public source, no contribution.** Every factual observation intended for publication must be supported by material publicly accessible without company credentials, VPN, private repository access, internal documents, private Slack or email, or other restricted access. Internal or confidential information must not supplement a public source. If publication safety is uncertain, stop before creating or pushing a contribution.

## What belongs in the evidence base

Useful contributions contain observations about software engineering involving AI or coding agents, agentic engineering systems, or the engineering environments that support them. Prefer primary public engineering reports, papers, repositories, technical documentation, or other original sources with concrete observations. Useful analogy from another domain is not evidence for this model.

A source is especially useful when it reduces uncertainty around an active research gap: for example, by supplying a comparison the model currently lacks, establishing a boundary, or showing that a proposed mechanism does not hold. Research-gap relevance should be stated in the assessment, but it does not change the evidence record's source-grounding requirements.

## Atomic contribution contract

For an ordinary evidence contribution, **one new or updated `evidence/*.yaml` file is the complete authored change**.

The evidence record contains the source-grounded observations, model mapping, explicit claim relationships, interpretation, verdict, epistemic boundaries, and open question. CI validates that canonical input and derives the projections used by evaluation, synthesis checks, D1 synchronization, and publication.

A contributor should not edit bookkeeping or derived state to make an evidence PR pass. In particular, an ordinary evidence contribution does not require edits to:

- `model/evidence-claims.yaml`
- `model/synthesis-state.json`
- `research-frontier.json`
- generated evaluation/synthesis HTML
- `sitemap.xml`
- runtime publication pages or routes

`model/evidence-claims.yaml` remains a compatibility source for evidence records that have not yet migrated their claim relationships into their own YAML. New evidence must declare `claims` in the evidence record.

If CI reports `SYNTHESIS_REVIEW_REQUIRED`, that is an editorial boundary rather than contributor bookkeeping. A maintainer reviews the affected canonical synthesis finding. Do not refresh `model/synthesis-state.json` merely to silence the check.

## Contribution boundaries

- **Contributor surface — `evidence/*.yaml`**: ordinary evidence proposals are authored here.
- **Maintainer surface**: schema, generators, workflows, protocols, model contracts, research gaps, synthesis findings, migration ledgers, runtime functions, and editorial pages.
- **CI-derived static/model artifacts**: `research-frontier.json`, `evaluate.html`, `synthesis.html`, and `sitemap.xml`.
- **Runtime evidence surfaces**: `/api/evidence`, `/signals/<signal-id>/`, and the homepage Evidence Landscape. These read from the D1 projection through the shared runtime evidence read model.
- **Authored/static publication pages**: `index.html`, `evidence.html`, `apply.html`, and `contribute.html`.

Contributors author canonical evidence records, not derived model bookkeeping, D1 projections, or publication surfaces.

## Contribution format

Create one YAML file under `evidence/` using `evidence/YYYY-MM-DD-<producer-slug>-<source-slug>.yaml`. The YAML record is canonical for evidence-specific content, including its explicit relationships to model claims.

```yaml
source:
  title: ""
  producer: ""
  producer_type: organization
  date: "YYYY-MM-DD"
  url: ""
  type: engineering-blog
  provenance: primary

presentation:
  headline: ""
  summary: ""

observed:
  - ""

scale:
  label: "Scale signal"
  summary: ""

mapping:
  stages: []
  transition:
    from: Selection
    to: Cooperation
  conditions: []

claims:
  - id: C02
    relationship: REFINES

interpretation: >

model_implication:
  verdict: SUPPORTS
  explanation: >

what_this_does_not_establish:
  - ""

open_question: ""

assessment:
  assisted_by_ai: true
```

`mapping.transition` is optional. Each `claims` entry names one active model claim and exactly one relationship: `SUPPORTS`, `REFINES`, `CONTRADICTS`, or `INCONCLUSIVE`. The `claims` field is required for new evidence contributions. Existing evidence records may still resolve claim relationships through the legacy `model/evidence-claims.yaml` ledger during migration. `model_implication.verdict` remains the primary evidence-level verdict and uses the same four values.

Use only the minimum stage and condition mapping supported by the observation. The active v0.2 stages are **Apparition, Selection, Cooperation, and Specialization**. **Variation/mutation is a mechanism, not a stage**, so describe relevant variation in interpretation rather than adding it to `mapping.stages`. The Selection conditions are Context, Execution, Verification, Coordination, Observability, Economics, and Learning.

## Research semantics

Keep source-grounded observation separate from model-relative interpretation. Source records provenance; Observed contains only source-supported statements; Scale records documented scale or a boundary; Mapping classifies against the active model; Claims records explicit relationships to active model claims; Interpretation explains the observation through the model; Model implication gives the primary verdict; limitations state what is not established; Open question identifies the next useful observation.

An evidence YAML is a living assessment of a fixed public source. Source-grounded observations change only to correct or improve extraction. Mapping, claim relationships, interpretation, model implication, boundaries and open questions may evolve as the model evolves; Git history preserves earlier assessments.

The canonical research gaps live separately in `model/research-gaps.yaml`. Do not copy a research-gap question into an evidence record as though the source established it. Instead, assess what the source actually establishes, record its explicit claim relationships in the evidence YAML, and use research-gap evaluation to determine how that evidence changes the model's frontier.

## What CI owns

For an evidence PR, CI is responsible for checking and deriving the rest of the pipeline:

```text
evidence/*.yaml
      │
      ▼
public-source + schema validation
      │
      ▼
claim relationships + model evaluation
      │
      ▼
semantic synthesis-drift check
      │
      ▼
projection/export validation
      │
      ├── research frontier + static/model artifacts
      │
      └── D1 synchronization
```

Pull-request validation does not mutate the contribution branch. Generated outputs may be uploaded as workflow artifacts for inspection. After canonical changes reach `main`, the workflow regenerates and may commit the known CI-owned static/model artifacts there. D1 synchronization projects the accepted corpus for runtime publication.

The expected outcome for an ordinary compatible evidence contribution is therefore: **one evidence YAML in, green validation and derived outputs out**.

## Derived artifacts

Generated artifacts must not be hand-edited. The current CI-owned generated paths are:

- `research-frontier.json`
- `evaluate.html`
- `synthesis.html`
- `sitemap.xml`

For local inspection, maintainers may run `python scripts/build-derived-artifacts.py`, but contributors do not need to commit its output before opening a pull request.

`evidence.html` and `index.html` are authored/static pages. Evidence-dependent runtime content is read from D1 rather than materialized into those files by CI.

## Review standard

Review asks whether every claim is publicly derivable, the observation is source-grounded, interpretation is separated, the mapping is minimal, scale is not inferred, claim relationships are justified, and the primary verdict is justified. Contradictory evidence is as welcome as supporting evidence.

For research-directed contributions, review also asks whether the stated frontier relevance is real: does the source provide evidence the frontier calls for, narrow the question, expose a boundary, or challenge the premise? Topic similarity alone is not sufficient. The assessment should state what remains unresolved so that a relevant source is not mistaken for a resolved research gap.

A synthesis review is maintainer work. When CI identifies semantic synthesis drift, review the affected finding against the new evidence and update the canonical synthesis only when the finding itself needs to change. Deterministic state should follow that editorial decision rather than substitute for it.

## Publication

Accepted YAML evidence is projected into D1 after validation. The shared runtime evidence read model supplies the evidence API, Scale Signal routes, and the homepage Evidence Landscape. The homepage remains a bounded view of the corpus, while the evidence API and Scale Signal routes expose individual and queryable evidence for inspection.

**Evidence should accumulate. The homepage should remain legible.**
