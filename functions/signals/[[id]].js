const SITE_ORIGIN = "https://agenticengineering.science";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseJson(value) {
  return value ? JSON.parse(value) : value;
}

function transitionLabel(row) {
  if (!row.transition_from && !row.transition_to && !row.adjacent_stage) return null;
  let label = `${row.transition_from} → ${row.transition_to}`;
  if (row.adjacent_stage) label += ` / ${row.adjacent_stage}`;
  return label;
}

function renderChips(row) {
  const transition = transitionLabel(row);
  const stages = parseJson(row.stages_json) || [];
  const conditions = parseJson(row.conditions_json) || [];
  const stageChips = transition
    ? [`<span class="chip transition">${esc(transition)}</span>`]
    : stages.map((stage) => `<span class="chip transition">${esc(stage)}</span>`);
  return [
    ...stageChips,
    ...conditions.map((condition) => `<span class="chip">${esc(condition)}</span>`),
  ].join("");
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function renderSignal(row) {
  const canonicalUrl = `${SITE_ORIGIN}/signals/${encodeURIComponent(row.evidence_id)}/`;
  const observed = (parseJson(row.observed_json) || [])
    .map((item) => `<p>${esc(String(item).trim())}</p>`)
    .join("");
  const boundaries = (parseJson(row.limitations_json) || [])
    .map((item) => `<li>${esc(String(item).trim())}</li>`)
    .join("");
  const description = String(row.scale_summary || "").replace(/\s+/g, " ").trim();
  const published = formatDate(row.source_date);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(`${row.headline} · Scale Signal`)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonicalUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(row.headline)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonicalUrl)}" />
<meta property="og:site_name" content="Evolution of Agentic Engineering" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${esc(row.headline)}" />
<meta name="twitter:description" content="${esc(description)}" />
<style>
:root{--bg:#f7f7f5;--ink:#171719;--muted:#66666f;--line:#d9d9dc;--card:#fff;--accent:#6c4cff;--soft:#eeeaff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.45}a{color:inherit}main{max-width:960px;margin:auto;padding:56px 28px 96px}.eyebrow{font-size:13px;font-weight:750;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(40px,6vw,68px);line-height:1;letter-spacing:-.05em;margin:18px 0 24px}h2{font-size:clamp(28px,4vw,42px);line-height:1.04;letter-spacing:-.04em;margin:12px 0 24px}.topnav{display:flex;justify-content:space-between;gap:20px;padding-bottom:38px}.back,.source{font-size:13px;font-weight:750;text-decoration:none;border-bottom:1px solid #aaa}.hero,section{padding-bottom:58px;border-bottom:1px solid var(--line)}section{padding-top:58px}.date{font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}.meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.chip{font-size:10px;font-weight:800;padding:6px 9px;border-radius:999px;background:#eeeef0;color:#686870}.transition{background:var(--soft);color:var(--accent)}.scale{margin-top:28px;padding:16px 18px;background:#f2f2f0;border-radius:10px;font:600 13px/1.5 ui-monospace,monospace}.evidence{margin-top:28px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:28px}.layer+.layer{margin-top:26px;padding-top:26px;border-top:1px solid var(--line)}.layer b,.source-detail b{display:block;font-size:11px;letter-spacing:.1em;color:var(--accent);margin-bottom:8px}.layer p{color:#4f5057}.observed p{margin:0;padding:0 0 16px}.observed p+p{padding-top:16px;border-top:1px solid #ececef}.boundaries ul{padding-left:20px;color:#4f5057}.boundaries li+li{margin-top:10px}.source-detail{padding:22px;background:#fff;border:1px solid var(--line);border-radius:14px}.source-detail p{margin:0 0 18px}.links{display:flex;gap:24px;flex-wrap:wrap;padding-top:28px}footer{padding-top:36px;color:var(--muted);font-size:13px}@media(max-width:600px){main{padding:32px 20px 72px}.topnav{align-items:flex-start;flex-direction:column}.evidence{padding:22px}}
</style>
</head>
<body><main>
<nav class="topnav"><span class="eyebrow">Evolution of Agentic Engineering</span><a class="back" href="/">View the model →</a></nav>
<header class="hero"><div class="eyebrow">Scale Signal</div><h1>${esc(row.headline)}</h1><div class="date">${esc(published)} · ${esc(row.producer)}</div><div class="meta">${renderChips(row)}</div><div class="scale"><strong>${esc(row.scale_label)}:</strong> ${esc(row.scale_summary)}</div></header>
<section><div class="eyebrow">Evidence record</div><h2>Source → Observed → Interpretation → Model implication</h2><div class="source-detail"><b>SOURCE</b><p>${esc(row.source_title)}</p><a class="source" href="${esc(row.source_url)}">View source →</a></div><div class="evidence"><div class="layer observed"><b>OBSERVED</b>${observed}</div><div class="layer"><b>INTERPRETATION</b><p>${esc(row.interpretation)}</p></div><div class="layer"><b>MODEL IMPLICATION</b><p><strong>${esc(row.verdict)}.</strong> ${esc(row.verdict_explanation)}</p></div></div></section>
<section class="boundaries"><div class="eyebrow">Epistemic boundaries</div><h2>What this does not establish</h2><ul>${boundaries}</ul><div class="layer"><b>OPEN QUESTION</b><p>${esc(row.open_question)}</p></div></section>
<section><div class="links"><a class="source" href="/evidence.html#${esc(row.evidence_id)}">Explore the living evidence record →</a></div></section>
<footer>Evolution of Agentic Engineering · Scale Signal</footer>
</main></body></html>`;
}

const SELECT = `
SELECT e.*,
  (SELECT json_group_array(stage) FROM (SELECT stage FROM evidence_stages s WHERE s.evidence_id = e.evidence_id ORDER BY stage)) AS stages_json,
  (SELECT json_group_array(condition) FROM (SELECT condition FROM evidence_conditions c WHERE c.evidence_id = e.evidence_id ORDER BY condition)) AS conditions_json
FROM evidence e
WHERE e.evidence_id = ?`;

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
    });
  }

  const rawId = Array.isArray(params.id) ? params.id.join("/") : params.id;
  if (!rawId || rawId.includes("/")) return context.next();

  let id;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return context.next();
  }

  if (!env.EVIDENCE_DB) return context.next();

  const row = await env.EVIDENCE_DB.prepare(SELECT).bind(id).first();
  if (!row) return context.next();

  const html = renderSignal(row);
  return new Response(request.method === "HEAD" ? null : html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "X-Evidence-Render-Source": "d1",
    },
  });
}
