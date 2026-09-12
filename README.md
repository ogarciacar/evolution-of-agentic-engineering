# Evolution of Agentic Engineering

A working model by Orlando Garcia for reasoning about how agentic software engineering may evolve as agent autonomy and concurrency increase.

**Apparition → Selection → Cooperation → Specialization**

Variation/mutation is a mechanism rather than an independent stage: once agentic engineering actors appear, different configurations provide the variants upon which engineering environments can exert selection pressure.

The model uses 1K-agent scale as a forcing function for examining the engineering conditions that may become limiting as agent populations grow: Context, Execution, Verification, Coordination, Observability, Economics, and Learning.

## Site

The site combines authored model pages with runtime evidence views backed by the validated D1 projection:

- `index.html` — the authored model shell; the bounded Evidence Landscape is rendered at runtime from D1 and shows up to the newest 24 accepted Scale Signals.
- `evidence.html` — the living evidence record used to test, refine, and potentially contradict the model.
- `evaluate.html` — deterministic evaluation of the active model claims against the mapped corpus, generated at deploy time.
- `/signals/<signal-id>/` — permanent Scale Signal routes rendered at runtime from D1.
- `apply.html` — the protocol for evaluating a new source against the model.

The evidence record separates **Observed**, **Interpretation**, and **Model implication** so that published facts remain distinct from conclusions drawn through the model.

## Repository architecture

The repository is organized around the research and publication flow:

```text
evidence/ + model/ + schema/
          │
          ▼
pipeline/
          │
          ├── validation
          ├── deterministic publication build
          └── deterministic D1 projection
                  │
                  ▼
functions/ + Cloudflare Pages
```

- `evidence/`, `model/`, and `schema/` hold canonical research state and contracts.
- `pipeline/` contains repository infrastructure for validation, evaluation, publication generation, and D1 projection; it is not a user-facing Python application or CLI.
- `migrations/` records D1 projection schema evolution.
- `functions/` contains the Cloudflare runtime read model and dynamic publication routes.
- authored root HTML, CSS, and JavaScript are tracked in Git; deterministic evaluation, synthesis, frontier, and sitemap outputs are materialized at build time and are not canonical Git state.
- `.github/workflows/` orchestrates validation and the D1 lifecycle.

See [`pipeline/README.md`](pipeline/README.md) and [`docs/README.md`](docs/README.md) for the maintained architecture documentation.

## Contributing evidence

The evidence base is open to proposals from other engineers and their AI agents.

Start by asking:

```text
Where does this fit?
[ARTICLE URL]
Use agenticengineering.science.
```

If the source contains meaningful evidence, the assessment can be proposed through a pull request. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution format and review standard.

**Anyone can propose evidence. Acceptance is reviewed.** A merged contribution means the evidence has been accepted into the evidence record; it does not mean the model has been proven.

## Publishing

Cloudflare Pages deploys the repository root and materializes deterministic publication outputs first with:

```bash
pip install -r pipeline/requirements.txt && python pipeline/build-publication.py
```

Authored research pages are then served alongside generated evaluation/synthesis surfaces, runtime evidence views, and the read-only evidence API backed by the D1 projection. The generated publication outputs are ignored by Git and can always be rebuilt from canonical repository state.

## Evidence workflow

New evidence should be evaluated before it changes the model:

1. Add meaningful first-party or otherwise credible evidence to the evidence record.
2. Classify the signal against the relevant stage/transition and engineering conditions.
3. Keep observation separate from interpretation and model implication.
4. Let the runtime homepage Evidence Landscape show up to the newest 24 accepted signals.
5. Change the model itself only when accumulated evidence warrants it.

Evidence is intended to accumulate; the complete corpus remains queryable through the Evidence page while the homepage stays bounded to the newest 24 accepted signals.

## Origins

The model was developed using Daniel San Martín's *Clarity* model as a thinking lens. In v0.2, its evolutionary structure is interpreted as **Apparition → Selection → Cooperation → Specialization**. Variation/mutation supplies versions of the object on which Selection can operate; it is not treated as an independent stage. The application of this structure to agentic software engineering, including the interpretations and hypotheses presented here, is Orlando Garcia's own.
