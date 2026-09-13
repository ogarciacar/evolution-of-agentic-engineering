import assert from "node:assert/strict";
import { onRequest } from "../../functions/api/search.js";

function request(path = "/api/search?q=Spotify", init = {}) {
  return new Request(`https://preview.example.pages.dev${path}`, init);
}

{
  const req = request();
  const calls = [];
  const expected = Response.json({ query: "Spotify", results: [] }, { status: 200 });
  const response = await onRequest({
    request: req,
    env: {
      SEARCH_API: {
        async fetch(forwarded) {
          calls.push(forwarded);
          return expected;
        },
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], req);
  assert.equal(response, expected);
}

{
  const response = await onRequest({ request: request(), env: {} });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Search is unavailable in this environment" });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
}

{
  const req = request("/api/search?q=Spotify", { method: "POST" });
  let forwardedMethod = null;
  const response = await onRequest({
    request: req,
    env: {
      SEARCH_API: {
        async fetch(forwarded) {
          forwardedMethod = forwarded.method;
          return new Response(null, { status: 405, headers: { Allow: "GET" } });
        },
      },
    },
  });

  assert.equal(forwardedMethod, "POST");
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
}

console.log("AI Search preview bridge contract OK");
