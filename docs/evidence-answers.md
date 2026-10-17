# Evidence-grounded answers — first implementation

An engineer should learn something that changes what they investigate next, with enough evidence to assess that interpretation before committing engineering attention. This slice provides a direct answer, attributed observations, interpretations, uncertainty and one proposed experiment with a measurement and decision rule. It does not establish that the proposed experiment will work.

## Interaction and acceptance contract

```mermaid
stateDiagram-v2
    [*] --> Editing
    Editing --> Finding: Investigate
    Finding --> Preparing: Records retrieved
    Finding --> NoMatch: No matches
    Finding --> RetrievalFailed: Retrieval error
    Preparing --> Reading: Answer passes checks
    Preparing --> Limited: Insufficient evidence
    Preparing --> AnswerFailed: Generation or validation error
    Preparing --> Editing: Stop
    Finding --> Editing: Stop
    AnswerFailed --> Preparing: Retry answer
    Reading --> Inspecting: Select citation
    Inspecting --> Reading: Close or Escape
    Reading --> Editing: Refine
    Limited --> Editing: Refine
    NoMatch --> Editing: Refine
    RetrievalFailed --> Finding: Retry question
```

| Transition | Acceptance behavior | Backing tests |
|---|---|---|
| Finding → Preparing (T03) | Evidence remains visible; input locked; Stop available | `answer-ui.unit`, `answer.spec` |
| Preparing → Reading (T04) | Direct answer, cited claims, uncertainty and one measurable proposed next step | `answer.worker`, `answer-contract.unit`, `answer.spec` |
| Preparing → Limited (T05) | Explain missing evidence; do not invent a recommendation; retain evidence | Same suites plus `answer-ui.unit` |
| Preparing → AnswerFailed (T06) | Invalid citations, wrong quotes, missing measurement, timeout and provider errors never render as an answer or “no evidence” | `answer.worker`, `answer.spec` |
| Preparing → Editing (T07) | Stop immediately; retain question; ignore late success/failure | `answer-ui.unit`, `answer.spec` |
| AnswerFailed → Preparing (T08) | Explicit retry; no repeat retrieval; duplicate submissions prevented | `answer-ui.unit`, `answer.spec` |
| Reading/Limited → Editing (T10/T13) | Keep question for refinement | `answer-ui.unit`, `answer.spec` |
| Reading ↔ Inspecting (T11/T12) | Citation opens its canonical passage and original attribution; Escape restores focus | `answer.spec` |
| Reading → Copied (T14) | Copy retains question, sources, snapshot IDs, caveats and proposed measurement | `answer-ui.unit`, `answer.spec` |

Existing retrieval and indexed-passage inspection contracts remain available, including when answer generation is disabled. Desktop and mobile run the same acceptance scenarios.

## Architecture and evidence boundaries

1. Existing `GET /api/search?q=…&passages=1` retrieves indexed EAE pages. When the required answer bindings and switch are enabled it additionally returns `answer_available: true`.
2. Browser submits `POST /api/search/answer` with only `{query, record_ids}`: at most five validated IDs. It cannot supply evidence text, provenance or model instructions. Selection IDs are untrusted; they can select any public canonical record, but cannot change its contents. Collection-only results produce a limited answer without inference.
3. Worker loads those IDs from existing D1 `main`, through the shared read model. Preview projection headers are intentionally ignored. This avoids presenting indexed EAE text as a fresh original-source quotation. The selection may still reflect an older search index; this is not exhaustive retrieval or a freshness guarantee about the original report.
4. Whole canonical records, including observations, interpretations, source lineage, limitations and open questions, become the model context. Records over 10,000 UTF-8 bytes, missing records or records without observations/limitations are omitted as a whole and counted. We never trim away caveats to fit the budget. Database failures are technical errors, not evidence insufficiency.
5. One Workers AI call (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) requests JSON mode. The Worker validates the output independently and returns a complete answer only after validation. No raw token streaming or auto-repair calls.
6. Each source and passage has a stable SHA-256 identity. Each source includes a digest of its canonical snapshot, original attribution, and field labels. `loaded_at` says when D1 was read; it is not a publication date or original-source verification timestamp. D1 is the current projection, which can lag a Git merge.
7. UI presents the answer as **AI interpretation**, differentiates reported observations, and exposes cited excerpts, entire canonical fields and limitations in the existing inspector. Indexed retrieval cards retain their own inspector, clearly separated from canonical answer citations.

No new database, queue, durable object, workflow, vector index or agent loop. The existing Worker gets Workers AI, the existing evidence D1 binding, and a rate-limit binding. The Pages `/api/search/answer` bridge reuses `SEARCH_API`. Preview Pages use the deployed production Worker and main evidence, not candidate Worker code or preview evidence. Candidate integration is tested locally and in CI with actual handlers and deterministic bindings.

The current answer schema lives in `workers/ai-search/answer.js`. An answered result requires cited summary, 1–4 cited claims, 1–4 uncertainties, and one proposed next step (`action`, `measure`, `decision_rule`, citations). A limited result has no claims and explains what is missing. It may include a cited proposed experiment when relevant evidence motivates one; unrelated questions and unsupported proposals retain a null next step. Unknown fields, invalid references, quotes not occurring exactly in the cited passage, observation claims citing interpretation fields, and missing required fields are rejected.

**Mechanical validation establishes traceability, not entailment.** A genuine quote can still be misinterpreted. Neither primary provenance nor multiple EAE records establishes independent corroboration. Those boundaries are in the prompt and interface; their semantic preservation must be evaluated using real model outputs. The model does not browse or verify the original source.

## Bounds and operations

- Question ≤500 UTF-16 code units; body ≤4,096 bytes; ≤5 records of ≤10,000 UTF-8 bytes each.
- One call, ≤1,800 output tokens; 25-second deadline covering rate-limit admission, database loading and inference. No automatic retries.
- Six answer attempts per client IP per minute per Cloudflare location. Shared/unknown IPs share a bucket. The platform limiter is approximate and per location; it is not a global spend cap. Namespace `2026100501` is reserved for this feature in this repository; confirm it is unused by other Workers in this account before rollout.
- Stop cancels the browser request and suppresses late results. Neither Stop nor the deadline guarantees cancellation/refund of inference already started. No persistence of questions/answers is added.
- Logs contain model, outcome, record count, omissions, duration and token usage when supplied. They exclude questions, passages, answers and client IPs. Invalid outputs return 502; provider/database/deadline failures 503; rate limit 429 with Retry-After.

Production deployment uses the existing production environment variables `EVIDENCE_DB_NAME` and `EVIDENCE_DB_ID` already used by evidence synchronization. `configure-deploy.mjs` creates an ignored Wrangler configuration with that binding. The checked-in config adds Workers AI and a rate limiter; no new API secret is required by the code. The deploy token/account must permit those bindings. Never create a replacement database to satisfy deployment.

`EAE_ANSWER_ENABLED` is an optional production environment variable (`false` by default; enabling requires an explicit `true`). Set it to `false` and redeploy to disable generation and hide the answer capability while preserving search. This is an initial experimental release; review the live evaluation before promoting it as reliable advice. New Worker capabilities become available only after the Worker deploy, independently of Pages.

## Local and CI verification

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
```

Node Vitest tests pure validation and lifecycle code. Cloudflare's `@cloudflare/vitest-plugin` runs Worker tests inside workerd, including the existing SQL migrations and real local D1 reads, with deterministic AI binding responses. Playwright exercises the actual Worker handlers through fixture adapters on desktop and mobile. No Cloudflare account, remote inference or secrets are needed for this suite. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium locally; CI installs the lockfile-pinned Playwright browser.

For a build-only deployment check, set the two existing D1 environment variables, run `node workers/ai-search/configure-deploy.mjs`, then `npx wrangler deploy --dry-run --config workers/ai-search/wrangler.deploy.json`. Use the generated config for an explicitly requested live development session too; live AI calls consume account quota. Do not point test fixtures at production D1.

## Real-model evaluation before claiming reliability

Deterministic fixtures prove software behavior, not answer usefulness, groundedness or a measured user outcome. The fixture suite deliberately covers malformed outputs and boundary failures. A live runner captures six real question cases, latency, full canonical sources, answers, mechanical validation and an out-of-domain abstention case:

```sh
npm run eval:answer -- --base-url https://agenticengineering.science --output .artifacts/answer-evaluation.json
```

Run only after that endpoint has answer bindings deployed and enabled; this makes up to six paid inference calls. Leave the rate-limit window free or retry later. CI does not call a live model. Human review must fill every case's `human_review` fields:

- Every factual claim and summary conclusion follows from its cited evidence; reject unsupported extrapolation, false causality, false independence or lost attribution.
- Source limitations and relevant contradictory observations are preserved. Unsupported questions abstain with useful missing-evidence guidance.
- The answer addresses the actual engineering question, and its proposed experiment is reversible, specific and has an actionable measure/decision rule.
- Record latency and token usage; evaluate actual burden alongside usefulness. Do not treat a passing schema as a passing answer.

Any unsupported consequential claim or lost epistemic boundary blocks a reliability claim. One reviewed run remains a small sample, not a reliability estimate. Before widening use, repeat the corpus across model/prompt changes and gather whether engineers changed what they investigated or chose a concrete experiment. No real-model evaluation or outcome improvement is asserted by the fixture tests.

Official API references: [Workers AI JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/), [model](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/), [rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).


## Diagnostics and quality regression gates

The October 5 live evaluation failed: four of six requests returned 503, and a mechanically valid answer substituted “human review” for a source's broader “least automatable tasks.” This change does not establish the root cause of those historical 503s or model reliability.

Each failed answer now returns `code`, `stage`, `request_id`, and `latency_ms`; `X-Request-ID` matches the structured log. Codes distinguish disabled capability, missing configuration, rate rejection, rate-limiter failure, evidence failure, provider failure, deadline expiry, client abort and invalid model output. No upstream exception text, prompts, source text or client IPs are logged by this handler. The evaluation report retains failure timing, HTTP status and safe diagnostics, including non-JSON gateway and transport failures. Its latency is total retrieval-plus-answer elapsed time; server diagnostic latency covers the answer handler.

Reported observation claim text must equal a complete cited observed passage, with a full matching quote. This preserves the canonical record's attribution and qualifications; it does not independently verify that record. If a passage exceeds the claim/quote limits, the model must choose another passage or abstain. Interpretations and summaries can still be semantically unsupported despite valid citations. Do not treat this extractive guard as an entailment checker.

Decision rules must use `If [measured condition], [action]; otherwise [alternative action]`. This checks structure only. Human review must still assess whether the condition is measurable, the alternatives are meaningful, and any proposed thresholds are justified as experiment criteria.

Acceptance-to-unit coverage:

| Transition / behavior | Acceptance coverage | Supporting unit coverage |
| --- | --- | --- |
| Preparing → technical failure | Workerd handler cases distinguish configuration, provider, D1, limiter and deadline; browser T06/T08 retains evidence and permits retry | Evaluation cases retain diagnostics without private upstream bodies |
| Preparing → rejected answer | Workerd T04 rejects unsupported observation paraphrases with 502 | Exact live human-review paraphrase rejected despite an authentic quote; full original observation accepted |
| Preparing → answer with next step | Existing Workerd T03/T04 and browser T03/T04 | Comparison-only decision rule rejected; fixture exercises conditional alternatives |

Deployment defaults are disabled in Wrangler, the generated configuration, and the legacy GitHub deployment workflow. Keep the Cloudflare build variable `EAE_ANSWER_ENABLED=false` during review. Do not enable public synthesis merely because CI passes: run the explicit six-case evaluation on an intentionally enabled evaluation deployment and complete human claim-support, boundary and experiment-quality review first. This PR makes no live inference calls.

For the separate token-protected Worker and live-case command, see [Isolated live answer evaluation](answer-evaluation-deployment.md). Production remains deployed by Cloudflare Workers Builds with synthesis disabled.

### Follow-up to the 17 October live evaluation

The isolated run returned two model deadlines, two validation rejections and two
abstentions. It did not demonstrate a useful generated insight with next steps.
Production synthesis remains disabled.

Acceptance criteria for this iteration:

| Transition | Acceptance | Supporting tests |
| --- | --- | --- |
| Preparing → failed | Rejected output reports a stable validation reason and generation measurements without model content | Worker reason-code cases; evaluation report unit test |
| Preparing → failed | A model deadline includes elapsed model time and input size; unknown output/usage is omitted | Worker stalled-model test |
| Preparing → limited | Relevant but inconclusive evidence may support one cited, explicitly proposed experiment; the answer retains its evidence boundary | Worker T05, contract negative cases, UI unit test, desktop/mobile T05/T14 |
| Limited → inspect/copy | Engineers can inspect the motivating citation and copy the experiment with uncertainty and source lineage | Desktop/mobile T05/T14 |
| Preparing → limited (unrelated) | Plain abstention has no proposed experiment | Evaluation abstention tests |

An insufficient answer still requires empty claims. An optional experiment must
have citations, a measure, a conditional decision rule and a cited summary.
These structural checks cannot establish relevance or semantic claim support;
reviewers must judge whether the experiment would resolve the stated gap.

Validation reasons are `json_invalid`, `schema_invalid`, `citation_invalid`,
`observation_not_verbatim`, `decision_rule_invalid`, `answer_incomplete`,
`abstention_invalid`, and the fallback `validation_error`.
No rejected model text or arbitrary exception message is returned or logged.

Measurements are `model_input_bytes` (serialized inference arguments, including
messages and schema), `model_output_bytes` (returned response, not the HTTP
envelope), `model_latency_ms`, `max_output_tokens`, and provider-reported
`input_tokens`/`output_tokens` when present. Byte counts are not token estimates.
Success responses carry these in `diagnostics`; failures carry available
measurements alongside the reason code. Timeouts cannot report unseen output
or token usage. The model and 25-second deadline remain unchanged so the next
live run can inform a targeted change.

### Structured generation decisions

The model now receives `GENERATION_SCHEMA`, with separate `answered` and
`insufficient` branches. Answered requires cited summary, claims and a next step;
insufficient requires an empty claims list and permits a cited experiment or null.
The Worker still validates responses: Workers AI JSON mode does not guarantee
schema adherence.

The model produces `next_step.decision` with three required, nonblank fields:
`condition`, `if_true`, and `if_false` (at most 180 characters each).
`finalizeGeneratedAnswer` validates this structure and renders the existing
public `decision_rule` string. Whitespace is normalized for display; no missing
condition or action is invented. The public envelope remains version 1, so
independent frontend/Worker deployments retain the existing API shape.

Acceptance: a complete structured decision reaches the existing read/inspect/copy
flow without requiring the model to produce specific punctuation. Missing or blank
decision fields and insufficient answers containing claims remain failures.
The Worker T03/T04 and desktop/mobile T05/T14 exercise generation through rendering;
contract unit tests cover each missing field, whitespace and the outcome schemas.

Diagnostics include `answer_contract: structured_decision_v1` on model-backed
successes and failures, retained by the evaluation runner. This identifies the
generation contract, not the deployed Git SHA. Model, token cap, deadline and
production disablement remain unchanged. Citation validity and decision structure
do not prove semantic support, usefulness or improved live reliability.

### Compact evidence generation

`passage_refs_v2` separates the model's short passage references from public canonical citations. Code supplies complete observed text and quotes; the model supplies interpretations and the proposed learning step. Neither authentic reference resolution nor schema conformance establishes semantic support. Optional `snapshot_ids`, paired with `record_ids`, constrain canonical evidence loading and fail with HTTP 409 before inference on mismatch. No client evidence text is accepted.

Acceptance coverage in the Cloudflare Vitest Worker pool checks successful expansion into the existing public envelope, rejected invented references/text, individual missing-answer diagnostics, and pinned evidence mismatch before model invocation. Unit coverage checks cross-record reference mapping, calibration compatibility and evaluation pin validation. Existing browser acceptance tests cover inspect/copy and answer/abstention/error interactions against the unchanged public contract.
