const SITE_ORIGIN = "https://agenticengineering.science";
const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 5;

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function sourceUrl(key) {
  if (typeof key !== "string" || !key.trim()) return null;
  try {
    const url = new URL(key.trim(), SITE_ORIGIN);
    return url.origin === SITE_ORIGIN ? url.href : null;
  } catch {
    return null;
  }
}

function sourceTitle(metadata) {
  const title = metadata && typeof metadata.title === "string" ? metadata.title.trim() : "";
  return title || null;
}

function normalizeChunk(chunk) {
  const url = sourceUrl(chunk?.item?.key);
  if (!url) return null;
  return {
    title: sourceTitle(chunk?.item?.metadata),
    url,
    excerpt: String(chunk?.text ?? "").trim(),
    score: Number.isFinite(chunk?.score) ? chunk.score : null,
  };
}

function uniqueResults(chunks) {
  const results = [];
  const seenUrls = new Set();

  for (const chunk of chunks || []) {
    const result = normalizeChunk(chunk);
    if (!result || seenUrls.has(result.url)) continue;

    seenUrls.add(result.url);
    results.push(result);
    if (results.length === MAX_RESULTS) break;
  }

  return results;
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/search") return json({ error: "Not found" }, 404);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });

  const rawQuery = url.searchParams.get("q");
  if (rawQuery == null || !rawQuery.trim()) return json({ error: "Query parameter 'q' is required" }, 400);

  const query = rawQuery.trim();
  if (query.length > MAX_QUERY_LENGTH) {
    return json({ error: `Query must be ${MAX_QUERY_LENGTH} characters or fewer` }, 400);
  }

  const startedAt = Date.now();
  try {
    const search = await env.AI_SEARCH.search({
      query,
      ai_search_options: {
        retrieval: {
          max_num_results: MAX_RESULTS,
          context_expansion: 0,
        },
        query_rewrite: { enabled: false },
        reranking: { enabled: false },
      },
    });

    const candidates = search?.chunks || [];
    const results = uniqueResults(candidates);
    const latencyMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      event: "ai_search",
      result_count: results.length,
      candidate_count: candidates.length,
      duplicate_chunks_dropped: Math.max(0, candidates.length - results.length),
      latency_ms: latencyMs,
      zero_results: results.length === 0,
    }));

    return json({ query, results });
  } catch {
    const latencyMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      event: "ai_search_error",
      result_count: 0,
      latency_ms: latencyMs,
      zero_results: true,
    }));
    return json({ error: "Search is temporarily unavailable" }, 503);
  }
}

export default {
  fetch: handleRequest,
};
