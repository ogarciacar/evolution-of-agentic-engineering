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

  function renderResult(result) {
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
        count.textContent = normalized.length ? `${normalized.length} ${normalized.length === 1 ? "result" : "results"}` : "";
        status.textContent = normalized.length ? "" : "No evidence matched this question.";
        results.innerHTML = normalized.map(renderResult).join("");
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
    module.exports = { shortExcerpt, safeSourceUrl, normalizeResults, renderResult };
  }

  if (typeof document !== "undefined") init();
})();
