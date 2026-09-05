# Contributing evidence

Evolution of Agentic Engineering is a working model. Contributions are welcome when they bring public evidence that may support, refine, contradict, or leave the model inconclusive.

**Anyone can propose evidence. Acceptance is reviewed.** A merged evidence contribution means the source and assessment have been accepted into the evidence record; it does not mean the model has been proven.

## Start with the assessment

Before opening a pull request, evaluate the source using `https://agenticengineering.science/apply.html`.

```text
Where does this fit?
[ARTICLE URL]
Use agenticengineering.science.

If the source contains meaningful evidence for the model, ask me whether I want to contribute the assessment. If I agree, follow the contribution protocol in ogarciacar/evolution-of-agentic-engineering. Before creating any YAML, branch, commit, or pull request, verify that every claim intended for publication is supported solely by publicly accessible sources. If any claim depends on private, internal, confidential, credential-gated, or otherwise restricted information, stop and do not prepare or push a contribution. Do not reproduce the sensitive information when explaining why you stopped.
```

## Public evidence safety gate

**No public source, no contribution.** Every factual observation intended for publication must be supported by material publicly accessible without company credentials, VPN, private repository access, internal documents, private Slack or email, or other restricted access. Internal or confidential information must not supplement a public source. If publication safety is uncertain, stop before creating or pushing a contribution.

## What belongs in the evidence base

Useful contributions contain observations about software engineering involving AI or coding agents, agentic engineering systems, or the engineering environments that support them. Prefer primary public engineering reports, papers, repositories, technical documentation, or other original sources with concrete observations. Useful analogy from another domain is not evidence for this model.

## Contribution boundaries

- **Contributor surface — `evidence/*.yaml`**: evidence proposals are authored here.
- **Maintainer surface**: schema, generators, templates, workflows, protocols, model contracts and editorial pages.
- **Generated surfaces**: `evidence.html`, `signals/<signal-id>/index.html`, and the bounded Evidence Landscape in `index.html`.

Contributors author YAML evidence records, not generated pages.

## Contribution format

Create one YAML file under `evidence/` using `evidence/YYYY-MM-DD-<producer-slug>-<source-slug>.yaml`. The YAML record is canonical for evidence-specific content.

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

`mapping.transition` is optional. `model_implication.verdict` is exactly one of `SUPPORTS`, `REFINES`, `CONTRADICTS`, or `INCONCLUSIVE`.

Use only the minimum stage and condition mapping supported by the observation. The active v0.2 stages are **Apparition, Selection, Cooperation, and Specialization**. **Variation/mutation is a mechanism, not a stage**, so describe relevant variation in interpretation rather than adding it to `mapping.stages`. The Selection conditions are Context, Execution, Verification, Coordination, Observability, Economics, and Learning.

## Research semantics

Keep source-grounded observation separate from model-relative interpretation. Source records provenance; Observed contains only source-supported statements; Scale records documented scale or a boundary; Mapping classifies against the active model; Interpretation explains the observation through the model; Model implication gives the primary verdict; limitations state what is not established; Open question identifies the next useful observation.

An evidence YAML is a living assessment of a fixed public source. Source-grounded observations change only to correct or improve extraction. Mapping, interpretation, model implication, boundaries and open questions may evolve as the model evolves; Git history preserves earlier assessments.

## Review standard

Review asks whether every claim is publicly derivable, the observation is source-grounded, interpretation is separated, the mapping is minimal, scale is not inferred, and the verdict is justified. Contradictory evidence is as welcome as supporting evidence.

## Publication

Accepted YAML evidence is automatically represented in generated evidence views. The homepage Evidence Landscape is a deterministic bounded view of up to the newest 24 accepted Scale Signals; the Evidence page and API expose the corpus for inspection.

**Evidence should accumulate. The homepage should remain legible.**
