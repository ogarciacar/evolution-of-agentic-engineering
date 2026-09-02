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

If the source contains meaningful evidence for the model, ask me whether I want to contribute the assessment. If I agree, follow the contribution protocol in ogarciacar/evolution-of-agentic-engineering. Before creating any YAML, branch, commit, or pull request, verify that every claim intended for publication is supported solely by publicly accessible sources. If any claim depends on private, internal, confidential, credential-gated, or otherwise restricted information, stop and do not prepare or push a contribution. Do not reproduce the sensitive information when explaining why you stopped.
```

## Public evidence safety gate

**No public source, no contribution.**

This repository is public. Before creating an evidence YAML file, branch, commit, or pull request, verify that every factual observation intended for the contribution is supported by a source that is publicly accessible without company credentials, VPN access, private repository access, internal documents, private Slack or email, or any other restricted access.

Internal, confidential, proprietary, or otherwise non-public information must never be used to supplement a public source, even when it would make the assessment more accurate or complete. Information available to the agent from another conversation, connected system, private repository, internal document, memory, or tool is not publishable evidence unless the same claim is independently supported by the cited public source.

If any proposed claim depends on non-public information, **STOP**. Do not create the YAML file. Do not create, commit, or push a branch. Do not open a pull request. Tell the user that the contribution cannot proceed because it depends on non-public information, without reproducing or summarizing that information.

If it is uncertain whether information is public, treat it as non-public and stop the contribution workflow.

A private assessment may still be useful to the person performing it. **Private assessment is not permission to create public evidence.**

### Pre-publish safety check

Immediately before any push or pull request, inspect the complete proposed diff, including filenames, URLs, metadata, observations, interpretations, comments, and generated content. Confirm that every evidence-specific claim can be derived solely from the cited public source or sources.

If that check cannot be completed confidently, **STOP before push**.

## What belongs in the evidence base

A useful contribution contains observations about software engineering involving AI or coding agents, agentic engineering systems, or the engineering environments that support them.

Evidence contributions require publicly accessible sources. Prefer first-party public engineering reports, papers, technical documentation, or other public sources with concrete observations. Secondary public reporting can be useful, but should be identified as secondary.

Internal company information is out of scope for this public evidence repository regardless of how relevant it is to the model.

Useful analogy from another domain is not evidence for this model.

## Contribution boundaries

The repository has three distinct surfaces:

- **Contributor surface — `evidence/*.yaml`**: evidence proposals are authored here.
- **Maintainer surface — schema, generator, templates, workflows, protocols, editorial pages, and `curation/`**: changes to the evidence system and allocation of homepage attention are maintained separately from evidence contributions.
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

A contribution should make it possible to inspect five things independently:

1. **Public provenance** — is every published claim supported solely by publicly accessible source material?
2. **Source** — can the underlying publication be inspected without restricted access?
3. **Observed** — does this say only what the source actually reports?
4. **Interpretation** — is model language clearly separated from observation?
5. **Model implication** — is the primary verdict justified without overstating what the evidence establishes?

During review, expect questions such as:

- Is every claim derivable solely from the cited public source?
- Has any internal or restricted context leaked into the contribution?
- Is the observation actually supported by the source?
- Is this the minimum sufficient stage and condition mapping?
- Are product capabilities being mistaken for demonstrated operation or organizational scale?
- Does the evidence support, refine, contradict, or leave the model inconclusive?
- What does this source explicitly not establish?

Contradictory evidence is as welcome as supporting evidence.

## Publication

Accepted YAML evidence is automatically represented in the generated `evidence.html` view. Contributors should not edit that page to publish or modify an evidence record; change the corresponding YAML record instead and let the generator produce the view.

Every evidence-specific statement displayed in `evidence.html` should come directly from its YAML record or from deterministic formatting of structured fields. The generator does not invent interpretations or evidence claims.

Homepage promotion is a separate editorial decision. The selected accepted evidence is recorded in `curation/homepage.yaml`; evidence contributors should not modify that manifest as part of an evidence proposal. Promotion does not change whether a record remains accepted evidence.

**Evidence should accumulate. Attention should not.**

The evidence format and publication workflow are intentionally simple for now. They can evolve as the evidence base and contributor community grow.
