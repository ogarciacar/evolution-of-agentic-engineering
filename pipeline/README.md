# Research publication pipeline

This directory contains the deterministic tooling that validates canonical research state, derives committed artifacts, and projects evidence into the D1 read model. It is repository infrastructure, not a user-facing Python application or CLI.

- `build-derived-artifacts.py` — stable local/CI entrypoint for committed derived artifacts.
- `build/` — generators for the research frontier, sitemap-backed evidence routes, model evaluation, and synthesis.
- `validation/` — canonical research integrity and publication-safety checks.
- `projection/` — D1 projection, synchronization export, deterministic rebuild, and runtime read-model contract checks.
- `preview/` — deployed Cloudflare Pages HTTP verification against SHA-scoped D1 projections; see [`preview/README.md`](preview/README.md) for local and CI usage.
- `browser/` — Chromium acceptance of the projected reader journey; see [`browser/README.md`](browser/README.md) for the URL-projection contract, local execution, CI, and diagnostics.
- `evaluate-model-claims.py`, `evidence_claims.py`, `synthesis-state.py` — shared research helpers used across pipeline responsibilities.
- `templates/` — templates consumed by pipeline generators.
- `requirements.txt` — Python dependencies for the pipeline.

GitHub Actions orchestrates these tools, but their semantics belong to the research publication pipeline rather than to GitHub Actions itself.
