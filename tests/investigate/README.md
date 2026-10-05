# Investigate interaction: first delivery slice

Scope: submit a question, show honest retrieval progress, prevent duplicate
submission, stop, and ignore late responses. Existing result cards and the
production retrieval endpoint stay in use. There is no generated answer yet.

## Run locally or in CI

From the repository root, with Node 24 and Python 3:

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
```

The same `npm run check` runs in `.github/workflows/investigate-interaction.yml`.
No Cloudflare credentials, live AI calls, D1 or deployment are required.

```sh
npm run test:unit
npm run test:worker
npm run test:acceptance -- --project=desktop
npm run test:acceptance -- --project=mobile
```

Vitest tests the lifecycle and request adapter. Cloudflare's
`@cloudflare/vitest-plugin` executes the actual search Worker with fixture
retrieval bindings. Its test-only Wrangler configuration deliberately has no
remote bindings. Playwright runs the real homepage against a localhost static
server and intercepts API responses with deterministic fixtures. Existing
endpoint, preview bridge and rendering contracts run unchanged.

The local server is managed by Playwright and binds only to 127.0.0.1:4173.
Use a free port 4173. A preinstalled Chromium can optionally be supplied through
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; CI uses Playwright's pinned browser.
Browser traces/screenshots are retained on failure and uploaded by CI.

## Transition acceptance criteria

| Transition | Browser acceptance | Supporting unit tests |
| --- | --- | --- |
| T00: open → editing | Labelled question, Investigate, no Stop until a request starts | Initial lifecycle state |
| T01: invalid submit → editing | Empty, whitespace and over-limit input show an associated error; no network request | Trim; 500 UTF-16 code-unit boundary matching HTML and Worker; invalid input never calls adapter |
| T02: editing → finding | One request; retained question; “Finding relevant evidence…”; Stop available | Synchronous finding state; duplicate guard; encoded query |
| T07: finding → editing | Keyboard Stop restores editing and focus; keeps question | Abort propagation; late successes/failures ignored even after a new request starts |
| Existing completion/error behavior | Evidence cards still render; failures keep input and permit resubmission | Adapter response handling; failure releases request guard |

Progress labels describe retrieval only. Stop returns control immediately;
upstream work may already have started. Request identity protects the UI even
when an adapter does not honor abort. Cancellation is propagated to both search
and evidence-card enrichment.

For the next slice, add an acceptance scenario first, write the underlying
behavioral unit tests, observe the failure, implement, and run `npm run check`.
Keep live retrieval/model evaluation separate: deterministic fixtures test the
interaction contract, not evidence or answer quality.

Framework reference:
https://developers.cloudflare.com/workers/testing/vitest-integration/

## Slice 2: inspectable evidence

| Transition / rule | Acceptance | Supporting tests |
| --- | --- | --- |
| T11/T12: results → inspect → results | Exact full passages, separate original provenance, Escape restores focus, no horizontal overflow | Package normalization; escaped rendering and URL validation; stable IDs and exact text in Workers runtime |
| T05/T10: search → limited → editing | Corpus-scoped no-match message; Refine retains question and sends no request | Explicit limited/refine lifecycle; empty/invalid/off-site chunks |
| Metadata unavailable | Passages and EAE link remain, no invented original-source attribution | Validated source metadata; unsafe link rejection |
| Retrieval failure | Failure never renders the no-match panel | Malformed provider output; all candidates exceeding bounds |

`evidence.spec.mjs` routes browser requests through the actual candidate Worker
handler with fixed AI Search bindings, so its response fixtures use the same
package-building code that will be deployed. These tests do not call live AI.
Package unit tests run inside Cloudflare's runtime, including SHA-256 identity,
source/fragment deduplication, bounded output and exact practices passages.

## Answer generation (slice 3)

See [answer design, transitions and rollout](../../docs/evidence-answers.md). `answer.spec.mjs` exercises T03–T08, T10–T14 on desktop/mobile using the actual Worker handler. `answer.worker.test.mjs` tests output rejection, abstention, rate limiting and timeout in workerd. `answer-d1.worker.test.mjs` applies the real migrations and checks main/preview isolation using local D1. `answer-contract.unit.test.mjs` and `answer-ui.unit.test.mjs` cover identities, limits, lifecycle races and copy provenance. These are deterministic contract tests; use the explicit live evaluation runner and human rubric before claiming answer quality.
