# Research publication pipeline

This directory contains the deterministic tooling that validates canonical research state, derives publication outputs, and projects evidence into the D1 read model. It is repository infrastructure, not a user-facing Python application or CLI.

- `build-publication.py` — stable publication entrypoint shared by CI and the Cloudflare Pages build. It materializes all deterministic static/model publication outputs from canonical research state.
- `build-derived-artifacts.py` — lower-level generator orchestration used by `build-publication.py`.
- `build/` — generators for the research frontier, sitemap-backed evidence routes, model evaluation, and synthesis.
- `validation/` — canonical research integrity, publication determinism, and publication-safety checks.
- `projection/` — D1 projection, synchronization export, deterministic rebuild, and runtime read-model contract checks.
- `preview/` — deployed Cloudflare Pages HTTP verification against SHA-scoped D1 projections; see [`preview/README.md`](preview/README.md) for local and CI usage.
- `browser/` — Chromium acceptance of the projected reader journey; see [`browser/README.md`](browser/README.md) for the URL-projection contract, local execution, CI, and diagnostics.
- `quality/` — the required pull-request merge contract and stable GitHub check contexts for `main`; see [`quality/README.md`](quality/README.md).
- `evaluate-model-claims.py`, `evidence_claims.py`, `synthesis-state.py` — shared research helpers used across pipeline responsibilities.
- `templates/` — templates consumed by pipeline generators.
- `requirements.txt` — Python dependencies for the pipeline.

GitHub Actions orchestrates these tools, but their semantics belong to the research publication pipeline rather than to GitHub Actions itself.

## Publication model

Canonical research state is committed to Git; deterministic publication outputs are not. CI builds the publication twice and requires stable output hashes, while Cloudflare Pages runs the same `build-publication.py` entrypoint at deploy time.

```text
canonical Git state
      │
      ├── CI: validate + rebuild twice + compare
      │
      ├── D1: deterministic evidence projection
      │
      └── Pages: build-publication.py + deploy
```

The build-time outputs are `research-frontier.json`, `evaluate.html`, `synthesis.html`, `sitemap.xml`, and the build-only `publication-manifest.json`. They are ignored by Git and can always be recreated from canonical state.
