function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function onRequest(context) {
  const searchApi = context.env.SEARCH_API;
  if (!searchApi || typeof searchApi.fetch !== "function") {
    return json({ error: "Search is unavailable in this environment" }, 503);
  }

  return searchApi.fetch(context.request);
}
