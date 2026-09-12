# Deterministic publication artifacts

Evidence contributions author canonical research state in `evidence/*.yaml`. The publication pipeline validates that state and derives static/model artifacts that are deterministic projections of it.

The generated publication artifacts are:

- `research-frontier.json`
- `evaluate.html`
- `synthesis.html`
- `sitemap.xml`

## Pull requests

Pull-request validation is read-only with respect to the contribution branch. CI runs the validators and `pipeline/build-publication.py`, then exposes generated outputs as workflow artifacts where useful for inspection.

The intended contributor contract remains one canonical evidence YAML for an ordinary evidence contribution. Contributors do not author generated publication state.

## Protected main

The S3 quality gate requires changes to `main` to arrive through a pull request. CI therefore does not create or push a follow-up commit after merge.

During the current migration, the four generated artifacts are still tracked in Git and CI requires regeneration to match their checked-in contents before merge. This is a temporary compatibility state while Cloudflare Pages is switched to execute the same publication build at deploy time.

## Cloudflare Pages build contract

The Pages Git integration must execute the publication builder before uploading the repository-root site:

```bash
pip install -r pipeline/requirements.txt && python pipeline/build-publication.py
```

This migration changes the Pages **build command only**. Keep the existing root directory and build output directory that currently publish the repository-root static site.

`pipeline/build-publication.py` emits `publication-manifest.json` after generating the four derived surfaces. The manifest is intentionally ignored by Git and therefore can exist in a deployed preview only when the Pages build actually ran. It contains SHA-256 and byte-size evidence for each generated publication artifact.

Required Preview Smoke verifies:

1. `/publication-manifest.json` exists and names `pipeline/build-publication.py` as its generator;
2. all four expected generated artifacts are represented;
3. every deployed artifact's bytes and SHA-256 match the build manifest.

This turns the Pages cutover into an observable acceptance condition rather than a dashboard configuration assumption. After changing the Pages build setting, validate it with a fresh commit deployment so the preview proves the new configuration rather than reusing an older deployment.

## Target publication model

After the Pages build is verified in preview and production, the generated artifacts will stop being tracked in Git. Pages will materialize them from canonical research state during deployment, while CI will verify that the publication build succeeds and is deterministic.

```text
canonical Git state
  evidence/*.yaml
  model/*
       │
       ├── CI validation
       │      └── publication build verification
       │
       ├── D1 projection
       │      └── API / Scale Signals / Evidence Landscape
       │
       └── Pages publication build
              ├── research-frontier.json
              ├── evaluate.html
              ├── synthesis.html
              ├── sitemap.xml
              └── publication-manifest.json (build-only proof)
```

Git remains canonical. D1 and generated publication artifacts are rebuildable projections.
