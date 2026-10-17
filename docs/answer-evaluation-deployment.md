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
