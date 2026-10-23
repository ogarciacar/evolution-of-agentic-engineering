# EAE inference: Cloudflare Containers + Kronk CPU

**Target:** `inference.agenticengineering.science`  
**Stage:** draft / not deployed. Independent of the existing Pages and AI Search deployments.

## Model choice

Start with `unsloth/Qwen3-0.6B-Q8_0`, recommended by Kronk for memory-constrained CPU environments. The Dockerfile downloads this GGUF plus compatible native inference libraries during image build. This removes the need for an unauthenticated model administration route and avoids re-downloading on normal container replacement. Confirm the exact OCI tag exists before deployment, then pin its digest.

Kronk's model IDs are provider-qualified; use the exact model name returned from `GET /v1/models`. This model is a **functional CPU smoke-test candidate**, not a quality target for production answer generation.

## Environment and deployment prerequisites

1. Check Cloudflare account eligibility for Containers and available CPU/memory/disk quota. The first deployment requires a supported paid Workers plan.
2. Install Node.js 22+, Docker, and an authenticated Wrangler CLI. In `infrastructure/inference`, run `npm install` (commit a generated lockfile before production deployment).
3. Check the base image exists: `docker manifest inspect docker.io/ardanlabs/kronk:v1.32.2-cpu`. Then build locally: `docker build --platform linux/amd64 -t eae-kronk:smoke .`. A build must prove the Kronk `libs --local` and `model pull --local` steps work.
4. Run locally: `docker run --rm -p 11435:11435 eae-kronk:smoke`. Check `curl -fsS http://127.0.0.1:11435/v1/liveness`. Confirm the model list and inference from your chosen model ID.
5. Generate a random API token. Save it **only** as a Cloudflare Worker secret: `npx wrangler secret put INFERENCE_API_TOKEN --config wrangler.jsonc`.
6. Deploy manually from `infrastructure/inference` via `npm run deploy`. Requires Cloudflare credentials with Workers, Containers, custom-domain and registry permissions; Cloudflare must control the domain's DNS zone.
7. Set `INFERENCE_URL=https://inference.agenticengineering.science` and `INFERENCE_API_TOKEN` in your shell, then run `bash scripts/smoke.sh`. Do not add the bearer token to command-line arguments or git.

The Worker only allows authenticated GET `/v1/liveness`, GET `/v1/models`, POST `/v1/chat/completions`, POST `/v1/responses`, and POST `/v1/embeddings`. All model-management and debug paths are rejected. The public bearer token is removed before proxying to Kronk.

## Operational concerns to verify

- `wrangler deploy` builds an amd64 container image. Confirm the CPU image/tag and model download at build time, including actual image size.
- Verify RAM use, inference latency (first token / completion), cold-start latency, streaming, and concurrent requests at the configured `standard-2` size.
- Container writes at runtime are ephemeral. The baked model removes a startup download dependency, but a fresh image build still requires upstream model availability.
- Confirm that a Kronk model load or cache write does not exceed the container disk limit.
- Do not enable public inference without limiting abuse/cost and reviewing Cloudflare usage limits.
- The current token check is suitable for a private pilot only; for multiple consumers, prefer separately scoped tokens, request limits, and observability.

## Definition of done

- [ ] Dependencies installed and lockfile committed
- [ ] `docker build --platform linux/amd64` completes and liveness works locally
- [ ] Model appears in `/v1/models` and a small chat completion succeeds
- [ ] Worker deploys successfully to an eligible Cloudflare account
- [ ] Missing/wrong bearer token returns 401; admin routes return 404
- [ ] Authenticated chat completion returns a real model response
- [ ] Cold starts, token throughput and approximate operating cost documented

References: [Kronk installation](https://github.com/ardanlabs/kronk/blob/main/.manual/chapter-02-installation.md), [model server](https://github.com/ardanlabs/kronk/blob/main/.manual/chapter-08-model-server.md), [Cloudflare Containers](https://developers.cloudflare.com/containers/get-started/).
