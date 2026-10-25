import { Container, getContainer } from "@cloudflare/containers";

// Stable singleton: one loaded CPU model instead of one cold start per request.
export class KronkContainer extends Container {
  defaultPort = 11435;
  sleepAfter = "30m";
}

const ALLOWED = new Set([
  "GET /v1/liveness",
  "GET /v1/models",
  "POST /v1/chat/completions",
  "POST /v1/responses",
  "POST /v1/embeddings",
]);

function jsonError(status, message) {
  return Response.json({ error: message }, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    if (!env.INFERENCE_API_TOKEN) {
      return jsonError(503, "Inference API is not configured");
    }

    const authorization = request.headers.get("authorization") || "";
    if (authorization !== `Bearer ${env.INFERENCE_API_TOKEN}`) {
      return jsonError(401, "Unauthorized");
    }

    const url = new URL(request.url);
    if (!ALLOWED.has(`${request.method} ${url.pathname}`)) {
      return jsonError(404, "Not found");
    }

    // Avoid forwarding the public bearer token to Kronk. Kronk's administrative
    // endpoints remain unreachable through this narrowly scoped gateway.
    const headers = new Headers(request.headers);
    headers.delete("authorization");
    headers.delete("cookie");
    headers.delete("host");

    const forwarded = new Request(request, { headers });
    const container = getContainer(env.KRONK, "primary");
    try {
      return await container.fetch(forwarded);
    } catch (error) {
      console.error("Kronk container request failed", error);
      return jsonError(503, "Inference temporarily unavailable");
    }
  },
};
