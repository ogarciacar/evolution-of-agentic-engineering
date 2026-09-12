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

## Target publication model

After the Pages build is verified, the generated artifacts will stop being tracked in Git. Pages will materialize them from canonical research state during deployment, while CI will verify that the publication build succeeds and is deterministic.

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
              └── sitemap.xml
```

Git remains canonical. D1 and generated publication artifacts are rebuildable projections.
