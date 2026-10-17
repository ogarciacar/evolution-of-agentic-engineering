# Semantic answer review

Contract success means the answer has the expected structure and valid quote
references. It does not establish that a quote supports a statement, that the
answer addresses the question, or that a proposed experiment is useful.

The 17 October 08:52 UTC evaluation passed all six contracts, but assistant review
identified substantive quality failures in all five engineering answers. Weather
abstention was appropriate. Production answers remain disabled.

## Review criteria

Review every summary, claim, uncertainty and next step against the supplied
evidence. Use the exact source snapshots in the report, not current website text.
Read the source's surrounding observations and limitations, not only its quote.

| Criterion | Pass requirement | Reject example from this run |
| --- | --- | --- |
| Support | The cited passage supports the specific statement; attribution is retained | Access-control passage cited for adoption and cycle-time limitations |
| Boundaries | Preserve scope, qualifications and contradictory evidence | Saying no context approaches were compared despite Atlassian's comparison |
| Responsiveness | Address the question at its requested level; abstain only with a justified gap | Marking a supported description of infrastructure insufficient because causal effects are unknown |
| Next step | A relevant, small reversible test with an operational measure, comparison and local decision; no experiment for unrelated questions | “Measure agent performance,” followed by organization-wide adoption |

All four criteria require an explicit pass and evidence-based rationale for each
case. No average score can compensate for an unsupported statement. A human can
reject an answer even if all automated contract checks pass.

Case-specific expectations are in workers/ai-search/answer-rubric.mjs, shared by
the evaluation runner and review template. They are review guidance, not prompts,
exact reference answers, or an automated semantic judge. If retrieval changes,
assess the evidence actually present; do not require a missing named source.
Record retrieval gaps separately from synthesis failures.

## Calibration examples

- **Context:** A bounded answer can report that Atlassian compared context
  delivery configurations with the same agent/model and reported task time
  falling from 352 to 325 seconds and tokens from 218,000 to 201,000 while quality
  was maintained. Cite its observed passages. Explain that these are first-party,
  task-specific results with several changes bundled together and no published
  benchmark size or uncertainty; they do not prove context is universally the
  dominant bottleneck.
- **Infrastructure:** Describe Cloudflare's reported platform, knowledge and
  enforcement layers with the matching observation. The question asks what
  infrastructure appears, not whether each layer causes higher productivity.
- **Human review:** Git write contention is not evidence that human review is
  the bottleneck. A useful proposal could observe one team's next ten comparable
  PRs, recording ready-for-review to first-review wait, active review effort,
  rework and CI wait. Investigate review capacity only if review waiting
  repeatedly dominates; otherwise investigate the measured dominant stage.
  This is a proposed diagnostic exercise, not a finding from the cited record.
- **Cycle time:** A local trial should define task start/end, comparable task
  categories, quality checks and reviewer effort. A proposed sample or threshold
  must be labelled as a trial choice. One small trial cannot justify adopting
  or rejecting coding agents across an organization.

The curated fixture tests/investigate/fixtures/answer-semantic-baseline.json
preserves verbatim answers, cited passages and selected counterevidence from the
uploaded run. It includes the original file hash and assistant assessments. It
is not a full retrieval snapshot or human release approval. Its regression test
demonstrates that the known poor answers pass structural validation; it does not
claim to detect arbitrary future semantic errors.

## Run and review

After a new evaluation (or using an existing report), create a separate checklist:

    npm run review:answer -- --input .artifacts/answer-evaluation.json --output .artifacts/answer-review.json

No inference or network calls occur. The original report is unchanged. The
command refuses to overwrite an existing review file. The output directory must
exist, as it does after the evaluation command.

Read each full answer and its source snapshots. Fill in your reviewer name,
ISO date/time, each rating's boolean pass and rationale, and each case's
decision (pass or fail). The rationale should identify the relevant
statement and record/passage or explain why a criterion is not applicable
(for example, no experiment for weather). Do not put a human name on an
assistant-only assessment.

Then check:

    npm run review:answer -- --input .artifacts/answer-evaluation.json --review .artifacts/answer-review.json

Exit 1 means blocked: pending/rejected review, incomplete rationale, missing or
duplicate cases, technical failure, invalid answer, obsolete generation marker,
incorrect weather abstention, or a review for a different report. Exit 0 means
the six cases have explicit passing assessments and valid current contracts.
It does not verify reviewer identity, assess rationale quality automatically,
prove broad reliability, or enable deployment.

Reviews bind to a SHA-256 digest of the complete report with canonical object
key ordering. Any changed answer, source, diagnostic or evaluation metadata
requires a new review. Reformatting JSON alone does not invalidate it.

The live evaluator's exit code remains about contracts and expected abstention.
It writes semantic_status: unreviewed. CI tests the review mechanism and
calibration fixtures without calling a live model or rubber-stamping answers.
Before public release, retain both the report and completed human review;
production enablement remains a separate explicit decision.

## First generation iteration against this baseline

Prompt revision bounded_evidence_v1 moves generation guidance into
workers/ai-search/answer-prompt.js. It explicitly distinguishes descriptive,
evidence-seeking and causal questions; requires checking all supplied records
before declaring evidence absent; separates nearby concepts; and asks for a
bounded proposal with operational measurements and local decision branches.

The model, generation schema, evidence selection, timeout and public API remain
unchanged. This isolates a prompt iteration rather than combining it with a model
or retrieval change. No case-specific expected answer, organization name or
benchmark result from the rubric is injected into the prompt.

Hand-authored context and infrastructure calibration examples verify that a
bounded answered response is compatible with the existing contract. These tests
do not establish that the model will generate such an answer. Re-run all six live
cases after deployment and review them with the same rubric. Check
data.diagnostics.prompt_revision on success or diagnostic.prompt_revision on
failure for bounded_evidence_v1. Compare retrieval/source snapshots as well as
answers: changes in retrieved evidence or model variability can affect results.

Success means supported bounded answers, accurate limits and useful local
proposals, not merely more answers labelled answered. Retain correct weather
abstention. Do not enable production from contract results alone.

The next generation iteration uses `passage_refs_v2` / `compact_evidence_v2`. Canonical observation text and citations are assembled in code from model-selected passage references. This removes copying work, not the need to judge relevance or entailment. Compare live runs with `--snapshot-report` as documented in the evaluation deployment guide. The previous bounded prompt run passed only the weather case; no semantic improvement has yet been demonstrated. Historical baseline fixtures remain unchanged as regression review material.

The 2026-10-17 09:47 UTC compact-generation evaluation passed 5/6 contracts with no timeout, using live retrieval. It still failed release quality: human-review reasoning conflated Git writes with review capacity and directed effort toward writes when review was constrained; uncertainties leaked passage refs; experiments lacked operational definitions; decision rendering repeated `If` and embedded actions. The context case failed `citation_invalid`, so its response could not be reviewed. Infrastructure description was grounded, but its proposed whole-stack trial was too broad. Weather abstention was correct.

`experiment_fields_v3` addresses reference leakage, decision formatting and missing experiment components with deterministic checks. These checks deliberately do not claim to detect a wrong causal inference, an irrelevant but authentic citation, an arbitrary threshold or an inappropriate intervention. Review those against support, boundaries, responsiveness and next-step usefulness after a pinned live run. Production remains disabled pending that review.
