# PR quality gate

This is the merge contract for `main`.

A pull request is acceptable when the repository integrity check passes and, when the change can affect the deployed publication, the exact PR commit has also passed D1 projection, deployed HTTP, and real-browser acceptance.

## Required checks

Configure `main` to require these four GitHub Actions job checks before merge:

| Required check | Responsibility |
|---|---|
| `Evidence integrity` | Canonical evidence/model validation, projection contracts, generated-artifact checks, and test helpers. |
| `Sync preview evidence to D1` | Materialize canonical `main` plus the PR SHA-12 evidence projection and verify both counts. |
| `Preview smoke` | Verify the exact atomic Pages deployment, projected API/signal runtime, publication routes, and default-main isolation. |
| `Preview browser E2E` | Run the projected reader journey in Chromium and verify projection propagation, D1 rendering, main isolation, and first-party browser health. |

The job names are intentionally stable because GitHub branch protection identifies required status checks by their check context.

## Applicability

`Evidence integrity` always performs its full validation.

The three deployed-preview workflows also trigger on every pull request so a required check can never be left permanently pending because a workflow-level `paths:` filter prevented it from being created. They use `pipeline/preview/change_scope.py` inside the job instead:

- **relevant change** — run the full D1 / deployed-preview / browser acceptance path;
- **unrelated change** — complete successfully with an explicit `not applicable` step.

The deployed-preview scope includes evidence/model state, schemas and migrations, Pages Functions, publication HTML/CSS/JavaScript, projection/build machinery, and the preview/browser acceptance implementation itself. Documentation-only changes do not pay the deployed-preview cost.

## Acceptance chain

```text
source/model integrity
        ↓
PR SHA-12 D1 projection
        ↓
exact Pages deployment
        ↓
HTTP/runtime acceptance
        ↓
Chromium reader acceptance
        ↓
merge allowed
```

For a publication-relevant pull request, all four layers are substantive. For an unrelated pull request, `Evidence integrity` remains substantive and the three deployed checks report that deployed acceptance is not applicable.

## Repository enforcement

The workflows encode the check contract, but the actual merge block is a GitHub repository setting. After this contract is present on `main`, enable branch protection or a repository ruleset for `main` that requires the four check contexts above before merging.

Do not add workflow-level `pull_request.paths` or `paths-ignore` filters to a required workflow. Keep cost control inside the job through `pipeline/preview/change_scope.py`; otherwise GitHub can wait forever for a required check that was never created.
