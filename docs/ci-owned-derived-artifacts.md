# CI-owned derived artifacts

Evidence contributions author canonical research state in `evidence/*.yaml`. Evidence integrity CI validates that state and derives the static/model artifacts that are deterministic projections of it.

## Pull requests

Pull-request validation is read-only with respect to the contribution branch. CI runs the validators and `scripts/build-derived-artifacts.py`, then exposes generated outputs as workflow artifacts where useful for inspection. It does not commit generated files back to the PR branch.

This makes one evidence YAML the ordinary contribution unit: contributors do not need to regenerate repository-owned artifacts before opening a pull request.

## Main

After canonical changes reach `main`, Evidence integrity CI regenerates and may commit the known derived static/model artifacts:

- `research-frontier.json`
- `evaluate.html`
- `synthesis.html`
- `sitemap.xml`

The second run must regenerate no diff.

## Runtime publication

Evidence publication that depends on the corpus is served from the D1 projection through the shared runtime read model. Runtime surfaces include the evidence API, Scale Signal routes, and the homepage Evidence Landscape.

The root `evidence.html` and `index.html` are authored/static pages. They are not CI-generated evidence projections.

## Ownership model

```text
evidence/*.yaml
      ↓
CI validation
      ├── derived static/model artifacts
      │     research-frontier.json
      │     evaluate.html
      │     synthesis.html
      │     sitemap.xml
      │
      └── D1 synchronization
              ↓
         runtime read model
              ↓
         API / Scale Signals / homepage Evidence Landscape
```

Git remains canonical. D1 and generated artifacts are rebuildable projections.