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

## Contribution format

Create one YAML file under `evidence/` using a descriptive slug, for example:

`evidence/openai-symphony.yaml`

Use this structure:

```yaml
source:
  title: ""
  organization: ""
  date: "YYYY-MM-DD"
  url: ""
  source_type: "first-party"

observed:
  - ""

mapping:
  stages: []
  conditions: []

interpretation: >
  

model_implication: "SUPPORTS"

what_this_does_not_establish:
  - ""

open_question: ""

assessment:
  assisted_by_ai: true
```

`model_implication` must be exactly one of `SUPPORTS`, `REFINES`, `CONTRADICTS`, or `INCONCLUSIVE`.

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

Accepted evidence may be incorporated into `evidence.html`. Homepage promotion is a separate editorial decision: `index.html` remains a small, curated view of the strongest current signals.

**Evidence should accumulate. Attention should not.**

The evidence format and publication workflow are intentionally simple for now. They can evolve as the evidence base and contributor community grow.
