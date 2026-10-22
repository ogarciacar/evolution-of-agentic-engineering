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
records known poor answers that passed the then-current structural validation; it does not
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

### Model comparison after the pinned v3 baseline

The 2026-10-17 10:20 UTC pinned run passed 5/6 contracts, with human review rejected for missing summary citations. Its cycle-time conclusion changed to an unsupported positive association despite identical evidence and prompt version; other responses still proposed irrelevant or undefined experiments. These findings motivate a model comparison rather than further schema expansion.

Use `npm run eval:compare` as documented in the evaluation deployment guide. Review `llama.json` and `gpt-oss.json` separately with this rubric. Confirm `same_input` and `models_confirmed` for each pair before comparing responses; count technical failures as failures, not absent observations. Authentic citations and filled experiment fields still do not establish semantic quality. The candidate is a hypothesis, not a proven upgrade. The serving deadline and generation ceiling remain fixed, so budget exhaustion must be considered when interpreting results. Do not promote either model solely because it passes more contracts.

## Question-aligned v4 acceptance review

The 2026-10-21 pinned model comparison confirmed identical generation inputs for
all six pairs. Llama passed 5/6 contracts (human-review lacked summary citations);
GPT-OSS passed 2/6 and hit the 25-second deadline four times. Neither passed the
semantic release gate. Keep the Llama evaluation baseline and production disabled.

`question_aligned_v4` keeps the public v1 answer shape, model, 1,800-token budget,
and 25-second deadline. It separates an insufficient answer with an experiment
(cited summary required) from abstention without one. This closes a permissive
schema branch; it does not prove why the live model omitted citations. Unknown
model text from rejected responses was not retained. No automatic citation repair
or inference retry is introduced.

Before promoting, evaluate these cases using the same pinned sources. Review the
actual cited passages, not just schema success. Rubric `eae_semantic_v2` adds the
following explicit next-step criteria; older reviews require a fresh assessment.

| Case | Reject | Accept |
| --- | --- | --- |
| Context | Context is dominant because an interface saved time; deny all comparisons despite the Atlassian comparison | Attribute the local task-time/token result, preserve bundled-change limits, state that dominance needs comparable stage timing |
| Many agents | Recommend AGENTS.md instead of investigating concurrency | Compare a bounded sample at one versus several agents, keep model/task class/checks fixed, measure accepted work and coordination/review cost |
| Human review | An investigation with an uncited summary; equate Git write contention with review work | Cite the missing review evidence or relevant observation; measure queue wait and reviewer effort per accepted change before selecting an intervention |
| Infrastructure | Prescribe a multi-agent coordinator with an unnamed baseline and vague review quality | Identify a local need, name the existing workflow, define observable quality checks, make continuation depend on those checks |
| Cycle time | Six-month generic rollout with speed-only expansion threshold | Bounded comparable task sample, explicit start/end events and quality/review checks; distinguish task time from delivery cycle time |
| Weather | Forecast or engineering experiment | Explain corpus mismatch, no claims and no next step |

Automated tests enforce schema branch constraints, reject exact known comparison
and guardrail placeholders, and verify the endpoint fails closed with diagnostic
reasons. They do **not** classify entailment, detect every vague paraphrase, prove
question relevance, or establish that a suggested threshold is appropriate.
Prompt guidance and manual acceptance review handle those semantic obligations.

First run `eval:answer -- --evaluation ... --case human-review` with the existing
six-case snapshot report and a fresh output filename. Then evaluate the six Llama
cases with the same snapshot report (omit `--case`). Do not spend another twelve
calls comparing models until this focused reasoning increment has been reviewed.

## Evidence-role v5 acceptance review

The fresh v4 human-review run (request `41012e0b-2e52-4c77-a93a-ae6e48e51694`)
passed contracts but promoted GitHub's open question about binding constraints
into a finding about human review. Its proposed comparison was undefined and its
30-minute threshold did not establish which stage dominated. Assistant assessment
rejected the answer; formal human review remains pending.

`evidence_roles_v5` applies the same role checks to generated answers and the
public validator used by evaluations and review. Public v1 fields are unchanged.

| Citation use | Enforced requirement |
| --- | --- |
| Answered summary or interpretation claim | At least one observed passage; no open-question citations, including mixtures with observations |
| Observation claim | Complete verbatim observed passage, as before |
| Insufficient summary | May cite limitations or an open question to describe the evidence gap |
| Proposed investigation | At least one observed passage; an additional open question may identify the uncertainty |

Violations return HTTP 502 without an answer, using
`finding_cites_open_question` or `observed_evidence_missing`. No automatic citation
removal, reclassification into insufficient, or retry hides a rejected answer.
The preserved live payload in `tests/investigate/fixtures/answer-human-review-v4.json`
is a minimal cited-source subset with the original report hash, not a retrieval
snapshot. Unit tests reproduce its previous acceptance and current rejection;
Cloudflare Worker tests cover rejected mixtures and permitted explicit gaps.
Three older calibration cases now fail role checks; their historical payloads
are retained unchanged. Other semantically poor answers still pass these checks.

An observed citation is necessary, not sufficient: the model can still make an
unsupported assertion using an authentic observation. Likewise an insufficient
label cannot make affirmative unsupported prose valid. Manual review must check
each sentence. Prompt guidance requires a bounded sample of the same changes,
comparison of delivery stages under the current workflow, explicit treatment of
overlapping waits, and a decision based on relative measurements and quality
checks. These semantic properties are not claimed as deterministic test coverage.

After the evaluation build deploys, rerun the pinned human-review case to a fresh
file and check both revision markers are `evidence_roles_v5`. Accept only if the
answer preserves the unknown bottleneck and proposes a concrete same-workload
investigation (or justifiably omits one). A 502 is a successful safety rejection,
but remains a failed live evaluation. Only proceed to the six-case run after
reviewing the focused result. Production remains disabled.

### Locate evidence-role failures before changing generation

The fresh v5 human-review run (request `625f511b-8f97-4b41-828d-d17106426b0e`)
confirmed both `evidence_roles_v5` revision markers and returned HTTP 502 with
`observed_evidence_missing`. No answer was returned, so its quality and the
specific failing component could not be reviewed.

Evidence-role rejections now include `validation_path` in the HTTP error, Worker
log and evaluation report. Values are `summary`, `claims[0]` through `claims[3]`
(zero-based), or `next_step`. The field identifies the first failing component
for `observed_evidence_missing` and `finding_cites_open_question`; other rejection
types may omit it. It contains no generated text, quotes or source identifiers.
The evaluation reader accepts only those exact locations and remains compatible
with older responses that omit the field.

This diagnostics-only change retains the v5 contract/prompt markers and identical
generation input. Confirm the new deployment by its build commit; the markers
alone cannot distinguish it from the preceding v5 build. Update the local runner
too, then rerun only the pinned human-review case to a fresh output file. A
missing path on another rejection reason is expected. A 502 remains a failed
evaluation, and identifying its location does not establish semantic quality.
