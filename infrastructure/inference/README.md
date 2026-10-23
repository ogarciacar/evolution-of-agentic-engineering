# EAE inference (Cloudflare Containers + Kronk)

Separate, opt-in Cloudflare Worker deployment for `inference.agenticengineering.science`. Does not change the Pages site or the existing AI Search Worker.

## Architecture

Authenticated HTTPS client → Worker (allowlisted inference paths) → one Cloudflare Container running the upstream Kronk CPU image on port 11435.

This is a **deployment scaffold**, not yet a verified inference service. Containers require a Cloudflare plan/account with Containers enabled. A Docker daemon is needed for the Dockerfile image build. CPU inference, cold starts, ephemeral container storage, downloaded model files, and response latency must be evaluated before production use.

## Deploy manually

1. Install Docker, Node.js and Wrangler tooling. In this directory run `npm install` (commit the resulting lockfile before enabling CI deployment).
2. Authenticate with `npx wrangler login` or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` with permissions for Workers, Containers, and custom domains.
3. Generate a strong random service token; store it as a Worker secret with `npx wrangler secret put INFERENCE_API_TOKEN --config wrangler.jsonc`. Never commit the token.
4. Run `npm run deploy` from this directory. This deploys the separate Worker and attaches the custom domain (ensure Cloudflare manages the zone).
5. Check `curl -i -H "Authorization: Bearer $INFERENCE_API_TOKEN" https://inference.agenticengineering.science/v1/liveness`.
6. Provision a **small quantized model** through a separate, secured operator workflow before testing `/v1/chat/completions`. This PR deliberately does not expose model-admin or model-download routes publicly.

The gateway allows only GET `/v1/liveness`, GET `/v1/models`, POST `/v1/chat/completions`, POST `/v1/responses`, and POST `/v1/embeddings`. Every request requires a bearer token. The public token is removed before forwarding. All other paths, including model management and debug endpoints, are blocked.

## Before enabling production traffic

- Pin a specific tested Kronk CPU image release/digest rather than floating `latest-cpu`.
- Choose a model fitting the container memory/CPU budget, provision its artifacts and native libraries, and test restart behavior. Container filesystem changes are ephemeral; do not assume model persistence after replacement.
- Decide on safe administrative model provisioning and model persistence/caching. Do not expose Kronk's administrative APIs through the public gateway.
- Validate Cloudflare container instance sizing, cold starts, streaming responses, concurrency and per-request cost. Set account-level usage and spend limits where available.
- Consider Cloudflare Access/service tokens, request size limits and more granular authorization before allowing third-party callers.

## References

- https://github.com/ardanlabs/kronk
- https://developers.cloudflare.com/containers/get-started/
- https://developers.cloudflare.com/containers/configuration/wrangler/
- https://developers.cloudflare.com/containers/api/container-class/
