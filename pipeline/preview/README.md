# Deployed preview smoke tests

This directory contains the deployed acceptance-smoke layer for Cloudflare Pages PR previews.

The same Python entrypoint is used by GitHub Actions and local development:

```bash
python pipeline/preview/run_preview_smoke.py
```

The smoke test verifies that the deployed preview for a commit can serve its SHA-12 evidence projection through the runtime, while requests without a projection selector still resolve to canonical `main`.

## What it checks

For the PR/head projection it verifies:

- the Cloudflare Pages preview deployment exists for the exact commit SHA;
- `/api/evidence` reports `X-Evidence-Projection: <SHA-12>` and the expected corpus count;
- a concrete evidence record is available through the projected API;
- the corresponding `/signals/<evidence-id>/` page is rendered from D1;
- `/`, `/evidence.html`, and `/evaluate.html` return healthy HTML responses;
- `/api/evidence` without a selector resolves to `main`;
- when the branch adds a new evidence file, that evidence is absent from default `main`.

Projection selection in this smoke layer intentionally uses the `X-Evidence-Projection` header. Browser navigation with `?projection_id=<SHA-12>` belongs to the browser E2E layer.

## Files

- `run_preview_smoke.py` — CLI/CI entrypoint. Resolves Git context, derives SHA-12, counts the local evidence corpus, chooses a signal target, and optionally discovers the Cloudflare Pages deployment.
- `preview_smoke.py` — reusable HTTP, Cloudflare deployment discovery, projection-readiness, and assertion functions.

No smoke-test Python is embedded in the GitHub Actions workflow; CI invokes these files directly.

## Run locally with automatic preview discovery

Prerequisites:

1. Run from the repository root.
2. Push the commit you want to test so Cloudflare Pages can create its preview deployment.
3. Make sure `origin/main` is available locally:

```bash
git fetch origin main
```

4. Export Cloudflare credentials. The API token needs Pages Read (or Pages Write) permission:

```bash
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export CLOUDFLARE_API_TOKEN='<api-token>'
```

Then run:

```bash
python pipeline/preview/run_preview_smoke.py
```

By default the runner uses:

- head SHA: `PR_HEAD_SHA`, otherwise local `HEAD`;
- base ref: `PR_BASE_SHA`, otherwise `origin/main`;
- Pages project: `CLOUDFLARE_PAGES_PROJECT`, otherwise `evolution-of-agentic-engineering`;
- projection: first 12 characters of the head SHA;
- signal target: the first newly added `evidence/*.yaml`, otherwise the first evidence record in the corpus;
- readiness timeout: `PREVIEW_SMOKE_TIMEOUT_SECONDS`, otherwise 600 seconds.

The runner waits for both the atomic Pages deployment and the matching D1 projection, so it is safe to start immediately after pushing a commit.

## Run locally with a known preview URL

If you already have the atomic Cloudflare Pages preview URL, you can skip Cloudflare API discovery and do not need the account ID or API token:

```bash
python pipeline/preview/run_preview_smoke.py \
  --preview-url 'https://<deployment>.evolution-of-agentic-engineering.pages.dev'
```

The runner still derives the projection from local `HEAD` and waits for that SHA-12 projection to become ready.

## Test a specific PR commit or evidence record

You can override the inferred context:

```bash
python pipeline/preview/run_preview_smoke.py \
  --head-sha '<full-pr-head-sha>' \
  --base-ref origin/main \
  --evidence-id '2026-09-11-example' \
  --preview-url 'https://<deployment>.evolution-of-agentic-engineering.pages.dev'
```

Useful options:

```text
--head-sha       Commit whose first 12 characters identify the preview projection.
--base-ref       Base SHA/ref used to detect whether the target evidence is newly added.
--preview-url    Atomic Pages preview URL; bypasses Cloudflare deployment discovery.
--project        Cloudflare Pages project name.
--evidence-id    Evidence record to use for API and signal-page assertions.
--timeout        Seconds to wait for deployment/projection readiness.
```

## CI

`.github/workflows/preview-smoke.yml` supplies `PR_HEAD_SHA` and `PR_BASE_SHA` from the pull request event and calls the same command:

```bash
python pipeline/preview/run_preview_smoke.py
```

This keeps local and CI smoke semantics identical.
