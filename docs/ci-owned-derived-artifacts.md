# Deterministic publication outputs

Evidence and model files are canonical research state. Publication outputs are rebuildable projections and are not tracked in Git.

The generated outputs are:

- `research-frontier.json`
- `evaluate.html`
- `synthesis.html`
- `sitemap.xml`
- `publication-manifest.json` (build-only provenance proof)

## Pull requests

Pull-request validation is read-only with respect to the contribution branch. CI builds the publication twice from canonical state and requires identical hashes for the four deterministic outputs. It then uploads those generated files as workflow artifacts for inspection.

For an ordinary evidence contribution, the authored change remains one canonical `evidence/*.yaml` file. Contributors do not author generated publication state.

## Protected main

The S3 quality gate requires all changes to `main` to arrive through a pull request. CI never creates or pushes a follow-up generated-artifact commit after merge.

Because generated publication outputs are ignored by Git, `main` contains only canonical research state and authored/runtime source. A merge therefore leaves `main` complete without any post-merge mutation.

## Cloudflare Pages build contract

The Pages Git integration executes the publication builder before uploading the repository-root site:

```bash
pip install -r pipeline/requirements.txt && python pipeline/build-publication.py
```

Keep the repository root as the Pages build output directory.

`pipeline/build-publication.py` generates all four deterministic outputs and then emits `publication-manifest.json`. The manifest is ignored by Git and contains the exact `CF_PAGES_COMMIT_SHA` plus SHA-256 and byte-size evidence for every generated output.

`research-frontier.json` is build/assessment data. The public Pages surfaces produced from the same canonical state are `evaluate.html`, `synthesis.html`, and `sitemap.xml`.

Required Preview Smoke verifies:

1. `/publication-manifest.json` exists and names `pipeline/build-publication.py` as its generator;
2. the manifest's `source_commit` is the exact PR head being deployed;
3. all four expected generated outputs are represented with valid hashes and byte sizes;
4. the three public publication surfaces are reachable;
5. `sitemap.xml` matches its build bytes and SHA-256 exactly;
6. generated HTML surfaces remain healthy after Pages middleware processing.

HTML is not compared byte-for-byte at the HTTP boundary because `functions/_middleware.js` reconstructs HTML responses to own runtime navigation/projection behavior. Build provenance comes from the build-only manifest bound to the exact Pages commit, while deployed HTML is checked semantically as a healthy surface.

## Local inspection

To materialize the current publication locally:

```bash
pip install -r pipeline/requirements.txt
python pipeline/build-publication.py
```

The generated files remain ignored by Git. Delete them at any time and rebuild them from canonical state.

## Publication model

```text
canonical Git state
  evidence/*.yaml
  model/*
  schema/*
       │
       ├── CI validation
       │      ├── deterministic publication rebuild
       │      └── generated workflow artifacts
       │
       ├── D1 projection
       │      └── API / Scale Signals / Evidence Landscape
       │
       └── Pages publication build
              ├── research-frontier.json (build/assessment data)
              ├── evaluate.html           (public)
              ├── synthesis.html          (public)
              ├── sitemap.xml             (public)
              └── publication-manifest.json (build-only proof)
```

Git remains canonical. D1 and publication outputs are rebuildable projections.
