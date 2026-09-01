# Contributing evidence

Evolution of Agentic Engineering is a working model. Contributions are welcome when they bring evidence that may support, refine, contradict, or leave the model inconclusive.

**Anyone can propose evidence. Publication is curated.**

A merged evidence contribution means that the source and assessment have been accepted into the evidence record. It does not mean that the model has been proven, or that the evidence will be promoted to the homepage.

## Start with the assessment

Before opening a pull request, evaluate the source using the application protocol at `https://agenticengineering.science/apply.html`.

A minimal instruction for an AI agent is:

```text
Where does this fit?
[ARTICLE URL]
Use agenticengineering.science.

If the source contains meaningful evidence for the model, ask me whether I want to contribute the assessment. If I agree, follow the contribution protocol in ogarciacar/evolution-of-agentic-engineering and prepare a pull request. Do not assume the contribution will be accepted.
```

## What belongs in the evidence base

A useful contribution contains observations about software engineering involving AI or coding agents, agentic engineering systems, or the engineering environments that support them.

Prefer first-party engineering reports, papers, technical documentation, or other sources with concrete observations. Secondary reporting can be useful, but should be identified as secondary.

Useful analogy from another domain is not evidence for this model.

## Contribution boundaries

The repository has three distinct surfaces:

- **Contributor surface — `evidence/*.yaml`**: evidence proposals are authored here.
- **Maintainer surface — schema, generator, templates, workflows, protocols, and editorial pages**: changes to the evidence system itself are maintained separately from evidence contributions.
- **Generated surface — `evidence.html`**: generated from the YAML evidence base and never authored directly.

These ownership boundaries are also expressed in `.github/CODEOWNERS`. CODEOWNERS identifies the maintainer review required for these surfaces; repository merge rules determine whether that review is mandatory.

## Contribution format

**Contributors only author YAML evidence records. Do not edit `evidence.html` directly.**

Create one YAML file under `evidence/` using the source publication date, organization, and a descriptive source slug:

`evidence/YYYY-MM-DD-<organization>-<source-slug>.yaml`

For example:

`evidence/2026-08-27-uber-efficient-software-factory.yaml`

Use the source publication date, not the contribution date. Keep the date in `source.date` as canonical structured metadata; the filename convention exists to make evidence easier to scan and discover in the repository.

The YAML record is the canonical source for evidence-specific content displayed in `evidence.html`. CI validates evidence records against `schema/evidence.schema.json`, regenerates `evidence.html`, and verifies that the committed generated view matches the YAML evidence base. Manual changes to generated evidence content in `evidence.html` will therefore fail the integrity check unless they are produced from the canonical YAML records.

Presentation fields preserve editorial labels that should not be inferred by the generator; scale captures a documented scale signal or an important evidence boundary; transitions are explicit when the evidence speaks to movement between stages; and the model implication stores both the verdict and the explanation.

Use this structure:

```yaml
source:
  title: ""
  organization: ""
  date: "YYYY-MM-DD"
  url: ""
  source_type: "first-party"

presentation:
  headline: ""

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

interpretation: >
  

model_implication:
  verdict: "SUPPORTS"
  explanation: >
    

what_this_does_not_establish:
  - ""

open_question: ""

assessment:
  assisted_by_ai: true
```

`mapping.transition` is optional. Include it only when the evidence meaningfully informs a transition between stages. Additional transition metadata should be used sparingly and only when it preserves an evidence-specific distinction that the generated view needs to represent.

`model_implication.verdict` must be exactly one of `SUPPORTS`, `REFINES`, `CONTRADICTS`, or `INCONCLUSIVE`.

Use only the minimum stage and condition mapping supported by the observation. The available stages are Apparition, Mutation, Selection, Cooperation, and Specialization. The Selection conditions are Context, Execution, Verification, Coordination, Observability, Economics, and Learning.

## Review standard

A contribution should make it possible to inspect four things independently:

1. **Source** — can the underlying publication be inspected?
2. **Observed** — does this say only what the source actually reports?
3. **Interpretation** — is model language clearly separated from observation?
4. **Model implication** — is the primary verdict justified without overstating what the evidence establishes?

During review, expect questions such as:

- Is the observation actually supported by the source?
- Is this the minimum sufficient stage and condition mapping?
- Are product capabilities being mistaken for demonstrated operation or organizational scale?
- Does the evidence support, refine, contradict, or leave the model inconclusive?
- What does this source explicitly not establish?

Contradictory evidence is as welcome as supporting evidence.

## Publication

Accepted YAML evidence is automatically represented in the generated `evidence.html` view. Contributors should not edit that page to publish or modify an evidence record; change the corresponding YAML record instead and let the generator produce the view.

Every evidence-specific statement displayed in `evidence.html` should come directly from its YAML record or from deterministic formatting of structured fields. The generator does not invent interpretations or evidence claims.

Homepage promotion is a separate editorial decision: `index.html` remains a small, curated view of the strongest current signals.

**Evidence should accumulate. Attention should not.**

The evidence format and publication workflow are intentionally simple for now. They can evolve as the evidence base and contributor community grow.
