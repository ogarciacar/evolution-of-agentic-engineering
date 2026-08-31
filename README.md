# Evolution of Agentic Engineering

A working model by Orlando Garcia for reasoning about how agentic software engineering may evolve as agent autonomy and concurrency increase.

**Apparition → Mutation → Selection → Cooperation → Specialization**

The model uses 1K-agent scale as a forcing function for examining the engineering conditions that may become limiting as agent populations grow: Context, Execution, Verification, Coordination, Observability, Economics, and Learning.

## Site

This repository intentionally stays small and static:

- `index.html` — the model and a curated snapshot of the strongest current evidence.
- `evidence.html` — the living evidence record used to test, refine, and potentially contradict the model.

The evidence record separates **Observed**, **Interpretation**, and **Model implication** so that published facts remain distinct from conclusions drawn through the model.

## Publishing

The site has no build step or external runtime dependencies. Deploy the repository root as a static site. For Cloudflare Pages, no framework preset or build command is required; the output directory is the repository root.

## Evidence workflow

New evidence should be evaluated before it changes the model:

1. Add meaningful first-party or otherwise credible evidence to the evidence record.
2. Classify the signal against the relevant stage/transition and engineering conditions.
3. Keep observation separate from interpretation and model implication.
4. Promote only the strongest current signals to `index.html`.
5. Change the model itself only when accumulated evidence warrants it.

Evidence is intended to accumulate; homepage attention remains curated.

## Origins

The model was developed using Daniel San Martín's *Clarity* model as a thinking lens, particularly its progression through Apparition, Mutation, Selection, Cooperation, and Specialization. The application of those ideas to agentic software engineering, including the interpretations and hypotheses presented here, is Orlando Garcia's own.
