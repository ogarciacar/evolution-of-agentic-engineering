# Deployed preview smoke tests

This directory contains the deployed acceptance-smoke layer for Cloudflare Pages PR previews plus fast unit tests for the smoke-test machinery itself.

There are two interfaces over the same implementation:

```bash
# Operational/deployed acceptance runner
python pipeline/preview/run_preview_smoke.py

# Normal Python test runner
python -m unittest pipeline.preview.test_preview_smoke
```

The smoke test verifies that the deployed preview for a commit can serve its SHA-12 evidence projection through the runtime, while requests without a projection selector still resolve to canonical `main`.

## What it checks

For the PR/head projection it verifies:

- the Cloudflare Pages preview deployment exists for the exact commit SHA;
- `/api/evidence` reports `X-Evidence-Projection: <SHA-12>` and the expected corpus count;
- a concrete evidence record is available through the projected API;
- the corresponding `/signals/<evidence-id>/` page is rendered from D1;
- `/`, `/evidence.html`, and `/evaluate.html` become healthy HTML responses;
- `/api/evidence` without a selector resolves to `main`;
- when the branch adds a new evidence file, that evidence is absent from default `main`.

The runner polls both D1 projection readiness and the publication routes because Cloudflare can expose the deployment before every static route is consistently available at the edge.

Projection selection in this smoke layer intentionally uses the `X-Evidence-Projection` header. Browser navigation with `?projection_id=<SHA-12>` belongs to the browser E2E layer.

## Files

- `run_preview_smoke.py` — CLI/CI entrypoint and reusable context resolver. Resolves Git context, derives SHA-12, counts the local evidence corpus, chooses a signal target, optionally discovers the Cloudflare Pages deployment, and invokes the shared assertions.
- `preview_smoke.py` — reusable HTTP, Cloudflare deployment discovery, projection-readiness, publication-readiness, and assertion functions.
- `test_preview_smoke.py` — standard-library `unittest` coverage for context resolution and smoke primitives, plus an opt-in real deployed acceptance test.

No smoke-test Python is embedded in the GitHub Actions workflow; CI invokes these repository files directly.

## Run the normal Python tests

The ordinary test suite is fast and offline. It mocks Cloudflare/HTTP and verifies context derivation, deployment selection, projection readiness, publication readiness, canonical `main`, and composition of the acceptance checks.

Run it through Python's standard test runner:

```bash
python -m unittest pipeline.preview.test_preview_smoke
```

The test file can also be executed directly:

```bash
python pipeline/preview/test_preview_smoke.py
```

The real deployed test is skipped by default, so normal unit-test discovery never makes external Cloudflare calls.

`Evidence integrity` runs these tests in CI on every PR and on `main`.

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

The runner waits for the atomic Pages deployment, matching D1 projection, and publication routes, so it is safe to start immediately after pushing a commit.

## Run locally with a known preview URL

If you already have the atomic Cloudflare Pages preview URL, you can skip Cloudflare API discovery and do not need the account ID or API token:

```bash
python pipeline/preview/run_preview_smoke.py \
  --preview-url 'https://<deployment>.evolution-of-agentic-engineering.pages.dev'
```

The runner still derives the projection from local `HEAD` and waits for that SHA-12 projection to become ready.

## Run the real deployed smoke through unittest

The same deployed acceptance check is also exposed as a Python test. It is intentionally opt-in.

With a known preview URL:

```bash
RUN_DEPLOYED_PREVIEW_SMOKE=1 \
PREVIEW_URL='https://<deployment>.evolution-of-agentic-engineering.pages.dev' \
python -m unittest pipeline.preview.test_preview_smoke.DeployedPreviewSmokeTest
```

With automatic Cloudflare Pages discovery:

```bash
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export CLOUDFLARE_API_TOKEN='<api-token>'
RUN_DEPLOYED_PREVIEW_SMOKE=1 \
python -m unittest pipeline.preview.test_preview_smoke.DeployedPreviewSmokeTest
```

The deployed unittest calls the same `run_from_context()` path used by the CLI, so the test and operational interfaces do not duplicate the smoke semantics.

## Test a specific PR commit or evidence record

You can override the inferred context through the CLI:

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
--timeout        Seconds to wait for deployment/projection/publication readiness.
```

Equivalent deployed-unittest overrides use environment variables such as `PR_HEAD_SHA`, `PR_BASE_SHA`, `PREVIEW_URL`, `EVIDENCE_ID`, and `PREVIEW_SMOKE_TIMEOUT_SECONDS`.

## CI

`.github/workflows/preview-smoke.yml` supplies `PR_HEAD_SHA` and `PR_BASE_SHA` from the pull request event and calls:

```bash
python pipeline/preview/run_preview_smoke.py
```

`.github/workflows/evidence.yml` runs the fast/offline tests:

```bash
python -m unittest pipeline.preview.test_preview_smoke
```

This keeps local, unit-test, and CI smoke semantics centered on the same implementation.
