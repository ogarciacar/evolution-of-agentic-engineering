import assert from "node:assert/strict";
import worker from "./index.js";

function request(path, init = {}) {
  return new Request(`https://agenticengineering.science${path}`, init);
}

function fakeEnv(searchImpl = async () => ({ chunks: [] })) {
  const calls = [];
  const gets = [];
  return {
    calls,
    gets,
    env: {
      AI_SEARCH: {
        get(instanceName) {
          gets.push(instanceName);
          return {
            async search(options) {
              calls.push(options);
              return searchImpl(options);
            },
          };
        },
      },
    },
  };
}

async function body(response) {
  return response.json();
}

{
  const { env } = fakeEnv();
  const response = await worker.fetch(request("/api/search"), env);
  assert.equal(response.status, 400);
}

{
  const { env } = fakeEnv();
  const response = await worker.fetch(request("/api/search?q="), env);
  assert.equal(response.status, 400);
}

{
  const { env } = fakeEnv();
  const response = await worker.fetch(request("/api/search?q=%20%20%20"), env);
  assert.equal(response.status, 400);
}

{
  const { env } = fakeEnv();
  const response = await worker.fetch(request(`/api/search?q=${"x".repeat(501)}`), env);
  assert.equal(response.status, 400);
}

{
  const { env } = fakeEnv();
  const response = await worker.fetch(request("/api/search?q=Spotify", { method: "POST" }), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
}

{
  const { env } = fakeEnv();
  const response = await worker.fetch(request("/api/search/debug?q=Spotify"), env);
  assert.equal(response.status, 404);
}

{
  const { env, calls, gets } = fakeEnv(async () => ({
    chunks: [
      {
        id: "internal-chunk-id",
        type: "text",
        score: 0.82,
        text: "  Spotify supplies repository and organizational context to coding agents.  ",
        item: {
          key: "https://agenticengineering.science/signals/2026-06-03-spotify-code-with-claude/",
          metadata: { title: "Spotify — Code with Claude", internal: "hidden" },
        },
        scoring_details: { vector_score: 0.91, keyword_score: 0.61, keyword_rank: 1 },
      },
      {
        id: "same-source-lower-ranked-chunk",
        score: 0.78,
        text: "A second matching chunk from the same Spotify evidence page.",
        item: {
          key: "https://agenticengineering.science/signals/2026-06-03-spotify-code-with-claude/",
          metadata: { title: "Spotify — Code with Claude" },
        },
      },
      {
        id: "relative-source",
        score: 0.74,
        text: "Repository context is assembled before execution.",
        item: { key: "/signals/2025-11-06-spotify-honk-part-1/", metadata: {} },
      },
      {
        id: "off-site",
        score: 0.99,
        text: "This must not be exposed as a corpus source.",
        item: { key: "https://example.com/not-the-corpus", metadata: { title: "External" } },
      },
    ],
  }));

  const response = await worker.fetch(request("/api/search?q=%20Spotify%20"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");

  assert.deepEqual(gets, ["agentic-engineering-search"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    query: "Spotify",
    ai_search_options: {
      retrieval: { max_num_results: 5, context_expansion: 0 },
      query_rewrite: { enabled: false },
      reranking: { enabled: false },
    },
  });

  const data = await body(response);
  assert.equal(data.query, "Spotify");
  assert.equal(data.results.length, 2);
  assert.deepEqual(data.results[0], {
    title: "Spotify — Code with Claude",
    url: "https://agenticengineering.science/signals/2026-06-03-spotify-code-with-claude/",
    excerpt: "Spotify supplies repository and organizational context to coding agents.",
    score: 0.82,
  });
  assert.deepEqual(data.results[1], {
    title: null,
    url: "https://agenticengineering.science/signals/2025-11-06-spotify-honk-part-1/",
    excerpt: "Repository context is assembled before execution.",
    score: 0.74,
  });
  assert.doesNotMatch(JSON.stringify(data), /same-source-lower-ranked-chunk|second matching chunk|internal-chunk-id|scoring_details|vector_score|keyword_score|keyword_rank/);
}

{
  const uglyTableChunk = "| Company | Specific use case being solved | Problem encountered | Reported practice | Selection condition |";
  const { env } = fakeEnv(async () => ({
    chunks: [
      {
        score: 0.93,
        text: uglyTableChunk,
        item: {
          key: "https://agenticengineering.science/practices",
          metadata: {},
        },
      },
    ],
  }));

  const response = await worker.fetch(request("/api/search?q=code%20search"), env);
  const data = await body(response);
  assert.equal(data.results.length, 1);
  assert.deepEqual(data.results[0], {
    title: "Practice Observations",
    url: "https://agenticengineering.science/practices",
    excerpt: "Observations of specific engineering use cases, encountered problems, and reported practices extracted from the evidence corpus.",
    score: 0.93,
  });
  assert.doesNotMatch(JSON.stringify(data), /Specific use case being solved|Reported practice/);
}

{
  const description = "Context-engineering practices were developed for background migrations across thousands of repositories; Spotify reports Claude Code as its top-performing agent across about 50 migrations.";
  const parserChunk = `---\ndescription: ${description}\ntitle: Spotify shows context engineering as a selection condition for background coding agents\n---\nEvidence record ## Source → Observed → Interpretation → Model implication **SOURCE**`;
  const { env } = fakeEnv(async () => ({
    chunks: [
      {
        score: 0.91,
        text: parserChunk,
        item: {
          key: "https://agenticengineering.science/signals/2025-11-24-spotify-honk-part-2/",
          metadata: { title: "Spotify shows context engineering as a selection condition for background coding agents" },
        },
      },
    ],
  }));

  const response = await worker.fetch(request("/api/search?q=code%20search"), env);
  const data = await body(response);
  assert.equal(data.results.length, 1);
  assert.equal(data.results[0].excerpt, description);
  assert.doesNotMatch(data.results[0].excerpt, /description:|title:|Evidence record|SOURCE/);
}

{
  const { env } = fakeEnv(async () => { throw new Error("secret Cloudflare failure detail"); });
  const response = await worker.fetch(request("/api/search?q=Spotify"), env);
  assert.equal(response.status, 503);
  const data = await body(response);
  assert.deepEqual(data, { error: "Search is temporarily unavailable" });
  assert.doesNotMatch(JSON.stringify(data), /secret Cloudflare failure detail/);
}

console.log("AI Search endpoint contract is stable");
