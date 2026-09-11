# Preview browser E2E

This directory contains the browser acceptance layer for Cloudflare Pages pull-request previews.

S1 (`pipeline/preview/`) proves the deployed runtime and SHA-scoped D1 projection are healthy at the HTTP level. S2 proves that a reader can move through the deployed publication in a real Chromium browser without losing that projection.

## Acceptance journey

The browser starts with the URL contract:

```text
/?projection_id=<PR-head-SHA-12>
```

It then follows real links through:

```text
Model → Evidence → Scale Signal → Evidence → Evaluation
```

The test verifies:

- the projected homepage is rendered from D1;
- internal navigation preserves `projection_id` in the URL;
- the Evidence page queries `/api/evidence` using the same projection;
- the projected corpus count matches the PR corpus;
- a concrete Scale Signal link preserves the selector;
- the Scale Signal is rendered from D1 and exposes Observed, Interpretation, Model implication, and source;
- navigation back to Evidence and onward to Evaluation keeps the selector;
- requests without a selector still resolve to canonical `main`;
- newly contributed evidence, when present, does not leak into the default homepage;
- first-party console errors, uncaught page errors, failed document/script/fetch/XHR requests, and HTTP errors fail the browser test.

No global `X-Evidence-Projection` header is injected by Playwright. The URL query is deliberately the browser contract so broken projection propagation cannot be hidden by test infrastructure.

## Files

- `run_preview_e2e.py` — one-command local runner: resolves the deployed preview context and launches the same Playwright journey used in CI.
- `resolve_preview_context.py` — discovers the exact atomic Pages deployment for the PR head, waits for its SHA-12 D1 projection and publication routes, and returns/exports the browser context.
- `playwright.config.mjs` — Chromium, reporters, timeout, and retained failure diagnostics.
- `preview-e2e.spec.mjs` — projected reader journey, default-main isolation, browser diagnostics, readable console output, and GitHub Job Summary.

## Run locally

Use Python 3.12+ and Node 24+. Run from the repository root.

Fetch the base branch once so the runner can identify newly added evidence:

```bash
git fetch origin main
```

### First run

If Playwright is not installed yet, the wrapper can install the pinned test package and Chromium before running:

```bash
python pipeline/browser/run_preview_e2e.py \
  --install \
  --preview-url 'https://<deployment>.evolution-of-agentic-engineering.pages.dev'
```

### Subsequent runs

After Playwright is installed, the local acceptance journey is a single command:

```bash
python pipeline/browser/run_preview_e2e.py \
  --preview-url 'https://<deployment>.evolution-of-agentic-engineering.pages.dev'
```

The wrapper resolves `PREVIEW_URL`, `PROJECTION_ID`, `EVIDENCE_ID`, `EVIDENCE_IS_NEW`, and `EXPECTED_EVIDENCE_COUNT` internally and passes them directly to Playwright. No shell exports are required.

To watch the journey in a visible Chromium window:

```bash
python pipeline/browser/run_preview_e2e.py \
  --headed \
  --preview-url 'https://<deployment>.evolution-of-agentic-engineering.pages.dev'
```

For automatic preview discovery, export `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, then omit `--preview-url`:

```bash
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export CLOUDFLARE_API_TOKEN='<api-token>'
python pipeline/browser/run_preview_e2e.py
```

The token needs Pages Read (or Pages Write).

The lower-level resolver remains available independently when needed:

```bash
python pipeline/browser/resolve_preview_context.py \
  --preview-url 'https://<deployment>.evolution-of-agentic-engineering.pages.dev'
```

## CI

`.github/workflows/preview-e2e.yml` installs pinned Playwright `1.62.1`, installs Chromium, resolves the exact atomic preview for the full PR head SHA, waits for the projection, and executes the browser journey.

On failure, GitHub retains:

- Playwright trace;
- screenshot;
- video;
- HTML report;
- first-party browser error attachment when present.

The test also writes the completed browser checks and result to `GITHUB_STEP_SUMMARY`.
