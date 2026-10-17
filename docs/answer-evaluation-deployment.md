# Isolated live answer evaluation

Production deployment remains owned by Cloudflare Workers Builds. Keep the GitHub production deployment workflow disabled and the production build variable `EAE_ANSWER_ENABLED=false`.

This evaluation Worker uses the same search/answer handlers, AI Search instance and canonical D1 evidence as production. It has a distinct name, no production routes, a separate rate-limit namespace and a required bearer secret. It is an API-only deployment, not a second website. The D1 binding is shared and technically writable; these handlers only read evidence. Inference consumes the same Cloudflare account budget. The six-case evaluation can invoke up to six model calls; no retries are automatic.

## Create the evaluation Worker with Workers Builds

After merging this change, connect another Worker to the same GitHub repository with these settings:

| Setting | Value |
| --- | --- |
| Worker name | `agentic-engineering-search-evaluation` |
| Production branch for this separate Worker | `main` |
| Root directory | repository root |
| Preview builds | disabled |
| Build command | `npm ci && npm run test:unit && npm run test:worker && npm run test:contracts && node workers/ai-search/configure-evaluation.mjs` |
| Deploy command | `npx --no-install wrangler deploy --config workers/ai-search/wrangler.evaluation.json` |
| Build variable `NODE_VERSION` | `24` |
| Build variable `EVIDENCE_DB_NAME` | existing canonical database name |
| Build variable `EVIDENCE_DB_ID` | existing canonical database UUID |

Use a dedicated build API token with the permissions required by Cloudflare's build setup. The generator sets synthesis to true only in this separate generated configuration, enables its workers.dev endpoint and removes all production routes. It does not use `EAE_ANSWER_ENABLED` and never rewrites the production configuration. The generated file is ignored by Git.

Before the evaluation secret exists, every request returns 503 `evaluation_not_configured`; neither search nor inference runs. Once the Worker exists, add a runtime **Secret** named `EVALUATION_TOKEN` in that Worker's Settings → Variables and Secrets. Generate a random value locally, for example `openssl rand -hex 32`, and save it in your password manager. Use 32–1024 non-whitespace characters. Do not put it in build variables, source control, screenshots or chat. Save/deploy the secret change.

Copy the separate Worker's URL from Cloudflare. It will have this form:

`https://agentic-engineering-search-evaluation.<your-account-subdomain>.workers.dev`

A request without the token should now return 401 `unauthorized`. Keep the token even though the URL is not linked from the public site.

## Run the six live cases

Update your local checkout to merged `main`, then run in **Bash** from the repository root:

```bash
npm ci
read -r -s -p 'Evaluation token: ' EAE_EVALUATION_TOKEN
export EAE_EVALUATION_TOKEN
npm run eval:answer -- --evaluation \
  --base-url https://agentic-engineering-search-evaluation.YOUR-SUBDOMAIN.workers.dev \
  --output .artifacts/answer-evaluation.json
unset EAE_EVALUATION_TOKEN
```

Replace `YOUR-SUBDOMAIN` with the value Cloudflare displays. `--evaluation` requires the separate Worker hostname and HTTPS, sends the token only to that origin, and rejects redirects. Tokens are not saved in the report. The script continues after individual failures to collect all six results and returns exit 1 if a contract or expected-abstention check fails.

Inspect `code`, `stage`, `request_id` and timing for failures; correlate the request ID with Worker logs. Do not interpret technical failures as insufficient evidence. A 502 `invalid_model_output` means the response was rejected by the deterministic schema/citation/observation/decision checks; it is not a provider availability error.

Complete human review for every successful case: claim support (including summary and interpretations), source attribution and caveats, justified abstention, and whether the next step actually defines an informative measurement and a decision. Exact observation copies and valid citations alone do not establish semantic support or reliability. Keep production synthesis disabled until the evaluation and review support an explicit release decision.

## Development gates

- E01: no valid evaluation secret → 503 before any evidence or inference work.
- E02: absent/incorrect credentials → 401 before any evidence or inference work.
- E03: valid credentials → shared answer pipeline and inspectable result.
- E04: valid credentials do not bypass `ANSWER_ENABLED=false`.
- Unit tests prove the configuration keeps production output unchanged, removes production routes, and separates the rate limiter; transport tests cover target validation, headers and redirect refusal.
- CI runs Cloudflare workerd tests and deployment dry runs for both configurations. No CI step deploys this evaluation Worker or calls a live model.

Cloudflare references: [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

The runner prints progress for each case. For failed answers, inspect
`diagnostic.validation_reason` and generation measurements; for successful
responses, inspect `data.diagnostics`. A correct unrelated-question abstention
must also have `next_step: null`. An in-domain insufficient answer can propose
a cited experiment without being counted as an established conclusion.

For zsh (the default macOS shell), enter the token without echoing it:

```zsh
read -r -s "EAE_EVALUATION_TOKEN?Evaluation token: "
echo
export EAE_EVALUATION_TOKEN
npm run eval:answer -- --evaluation \
  --base-url https://agentic-engineering-search-evaluation.orlando-garcia.workers.dev \
  --output .artifacts/answer-evaluation.json
unset EAE_EVALUATION_TOKEN
```

For the structured-decision rollout, confirm
`data.diagnostics.answer_contract` (success) or
`diagnostic.answer_contract` (failure) equals `structured_decision_v1`.
A model-backed result without this marker may be from an earlier deployment;
wait for the evaluation build to finish and rerun the full set. This marker
identifies the contract revision, not a unique deployment.

A green evaluation exit code is only a contract result. Follow
[Semantic answer review](answer-semantic-review.md) to generate a separate review
checklist with npm run review:answer, assess all six cases against their exact
source snapshots, and check that review. The review command does not deploy or
enable production answers.

For the reasoning prompt iteration, additionally verify
prompt_revision: bounded_evidence_v1 in success/failure diagnostics. The generation
contract stays structured_decision_v1. Re-run the six live cases only after the
evaluation Worker build succeeds, then apply the semantic review rubric.

### Compact generation and pinned evidence (passage_refs_v2)

The Worker now sends request-local passage references (`s1p1`, `s2p1`, etc.) to the model. Generated citations contain those references; observation claims contain only a passage reference. Code restores canonical source IDs, passage IDs, complete quotes and observation text, then applies the existing public answer validation. Unknown references, non-observed observation references, and extra observation text are rejected. The public v1 response and inspection/copy UI are unchanged. This reduces generated duplication; it does not prove citation entailment or improve measured latency until evaluated live.

Diagnostics identify missing components as `summary_citations_missing`, `claims_missing`, or `next_step_missing` (first failing requirement). The model contract is `passage_refs_v2`, prompt revision `compact_evidence_v2`. No rejected model text is logged. The model, 1,800-token ceiling and 25-second deadline are unchanged.

To isolate generation from retrieval, reuse a saved report containing all six complete canonical source snapshots (the earlier six-pass report qualifies; failed-case-only reports do not):

```sh
npm run eval:answer -- --evaluation \
  --base-url https://agentic-engineering-search-evaluation.orlando-garcia.workers.dev \
  --snapshot-report .artifacts/answer-evaluation-six-pass.json \
  --output .artifacts/answer-evaluation-compact-v2.json
```

Replace the snapshot-report path with your saved six-pass report. The CLI validates all cases before making requests, skips retrieval, and sends ordered record IDs and snapshot hashes. The Worker still loads canonical records from D1. It returns HTTP 409 `evidence_snapshot_changed` before inference if any record changed, disappeared or is omitted. It never uses evidence text from the report as model input. This pins evidence while that revision remains available; it cannot replay historical records after D1 changes. Use the same baseline report for comparisons. Each successful request still incurs a live model call; repeated runs can vary.

Without `--snapshot-report`, evaluation continues to use live retrieval. Reports identify `evidence_mode` and include the pinned identities when applicable. Human semantic review remains required. Keep production answers disabled until the release quality gate passes.
