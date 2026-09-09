(() => {
  const SITE_ORIGIN = "https://agenticengineering.science";
  const MAX_EXCERPT_CHARS = 620;

  function esc(value, quote = false) {
    let out = String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    if (quote) out = out.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    return out;
  }

  function shortExcerpt(value) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text.length <= MAX_EXCERPT_CHARS) return text;
    const slice = text.slice(0, MAX_EXCERPT_CHARS);
    const boundary = slice.lastIndexOf(" ");
    const end = boundary >= 460 ? boundary : MAX_EXCERPT_CHARS;
    return `${slice.slice(0, end).trim()}…`;
  }

  function safeSourceUrl(value) {
    try {
      const url = new URL(String(value ?? ""), SITE_ORIGIN);
      if (url.origin !== SITE_ORIGIN) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function normalizedPath(value) {
    try {
      const url = new URL(String(value ?? ""), SITE_ORIGIN);
      if (url.origin !== SITE_ORIGIN) return null;
      return url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    } catch {
      return null;
    }
  }

  function isPracticesUrl(value) {
    return normalizedPath(value) === "/practices";
  }

  function signalIdFromUrl(value) {
    const path = normalizedPath(value);
    const match = path?.match(/^\/signals\/([^/]+)$/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }

  function transitionLabel(mapping) {
    const transition = mapping?.transition;
    if (transition?.from && transition?.to) {
      return `${transition.from} → ${transition.to}${transition.adjacent_stage ? ` / ${transition.adjacent_stage}` : ""}`;
    }
    return (mapping?.stages || []).join(" · ");
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return "";
    return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function matchedPassage(value) {
    let text = String(value ?? "").trim();
    let label = "MATCHED EVIDENCE";

    if (/^#{1,6}\s*What this does not establish\b/i.test(text)) {
      label = "WHAT THIS DOES NOT ESTABLISH";
      text = text.replace(/^#{1,6}\s*What this does not establish\s*/i, "");
    } else if (/^#{1,6}\s*Source\s*→\s*Observed\s*→\s*Interpretation\s*→\s*Model implication\b/i.test(text)) {
      text = text.replace(/^#{1,6}\s*Source\s*→\s*Observed\s*→\s*Interpretation\s*→\s*Model implication\s*/i, "");
    }

    text = text
      .replace(/\*\*(SOURCE|OBSERVED|INTERPRETATION|MODEL IMPLICATION)\*\*/gi, "$1 ·")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/(^|\s)[*+-]\s+/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return { label, text: shortExcerpt(text) };
  }

  function normalizeResult(result) {
    const url = safeSourceUrl(result?.url);
    if (!url) return null;
    return {
      title: String(result?.title ?? "").trim() || "Evidence result",
      url,
      excerpt: shortExcerpt(result?.excerpt),
    };
  }

  function normalizeResults(results) {
    if (!Array.isArray(results)) return [];
    return results.map(normalizeResult).filter(Boolean);
  }

  function normalizeEvidence(record, expectedId) {
    if (!record || record.id !== expectedId) return null;
    return {
      id: record.id,
      source: {
        date: String(record.source?.date ?? ""),
        producer: String(record.source?.producer ?? ""),
      },
      presentation: {
        headline: String(record.presentation?.headline ?? ""),
      },
      mapping: {
        stages: Array.isArray(record.mapping?.stages) ? record.mapping.stages.map(String) : [],
        conditions: Array.isArray(record.mapping?.conditions) ? record.mapping.conditions.map(String) : [],
        transition: record.mapping?.transition || null,
      },
      verdict: String(record.model_implication?.verdict ?? ""),
    };
  }

  async function enrichResult(result, fetchImpl) {
    const id = signalIdFromUrl(result.url);
    if (!id) return result;

    try {
      const response = await fetchImpl(`/api/evidence/${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return result;
      const evidence = normalizeEvidence(await response.json(), id);
      return evidence ? { ...result, evidence } : result;
    } catch {
      return result;
    }
  }

  async function enrichResults(results, fetchImpl) {
    return Promise.all(results.map((result) => enrichResult(result, fetchImpl)));
  }

  function renderPracticesResult(result) {
    return `<article class="ask-result ask-result-collection"><h3>${esc(result.title)}</h3>${result.excerpt ? `<p>${esc(result.excerpt)}</p>` : ""}<div class="ask-result-foot"><a class="source" href="${esc(result.url, true)}">Explore practices →</a></div></article>`;
  }

  function renderSignalResult(result) {
    const evidence = result.evidence;
    const date = formatDate(evidence.source.date);
    const producer = evidence.source.producer;
    const chips = [transitionLabel(evidence.mapping), ...(evidence.mapping.conditions || [])].filter(Boolean);
    const passage = matchedPassage(result.excerpt);
    const headline = evidence.presentation.headline || result.title;
    const provenance = [date, producer].filter(Boolean).join(" · ");

    return `<article class="ask-result ask-result-signal">${provenance ? `<div class="date">${esc(provenance)}</div>` : ""}<h3>${esc(headline)}</h3>${chips.length ? `<div class="meta">${chips.map((chip, index) => `<span class="chip${index === 0 ? " transition" : ""}">${esc(chip)}</span>`).join("")}</div>` : ""}${passage.text ? `<div class="ask-match"><b>${esc(passage.label)}</b><p>${esc(passage.text)}</p></div>` : ""}<div class="ask-result-foot">${evidence.verdict ? `<strong>${esc(evidence.verdict)}</strong>` : "<span></span>"}<a class="source" href="${esc(result.url, true)}">Read Scale Signal →</a></div></article>`;
  }

  function renderResult(result) {
    if (isPracticesUrl(result.url)) return renderPracticesResult(result);
    if (result.evidence) return renderSignalResult(result);
    return `<article class="ask-result"><h3>${esc(result.title)}</h3>${result.excerpt ? `<p>${esc(result.excerpt)}</p>` : ""}<div class="ask-result-foot"><a class="source" href="${esc(result.url, true)}">Read evidence →</a></div></article>`;
  }

  function init(doc = globalThis.document, fetchImpl = globalThis.fetch) {
    if (!doc || typeof fetchImpl !== "function") return;
    const form = doc.getElementById("ask-evidence-form");
    const input = doc.getElementById("ask-evidence-input");
    const button = doc.getElementById("ask-evidence-submit");
    const count = doc.getElementById("ask-evidence-count");
    const status = doc.getElementById("ask-evidence-status");
    const results = doc.getElementById("ask-evidence-results");
    if (!form || !input || !button || !count || !status || !results) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (button.disabled) return;

      const query = input.value.trim();
      if (!query) {
        count.textContent = "";
        status.textContent = "Enter a question to search the evidence.";
        input.focus();
        return;
      }

      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      count.textContent = "";
      status.textContent = "Searching evidence…";
      results.innerHTML = "";

      try {
        const response = await fetchImpl(`/api/search?q=${encodeURIComponent(query)}`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const normalized = normalizeResults(data.results);
        const enriched = await enrichResults(normalized, fetchImpl);
        count.textContent = enriched.length ? `${enriched.length} ${enriched.length === 1 ? "result" : "results"}` : "";
        status.textContent = enriched.length ? "" : "No evidence matched this question.";
        results.innerHTML = enriched.map(renderResult).join("");
      } catch {
        count.textContent = "";
        status.textContent = "Search is temporarily unavailable. You can still use the structured evidence filters below.";
      } finally {
        button.disabled = false;
        form.removeAttribute("aria-busy");
      }
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      shortExcerpt,
      safeSourceUrl,
      isPracticesUrl,
      signalIdFromUrl,
      matchedPassage,
      normalizeResults,
      enrichResults,
      renderResult,
    };
  }

  if (typeof document !== "undefined") init();
})();
