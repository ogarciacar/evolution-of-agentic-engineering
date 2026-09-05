(() => {
  const form = document.getElementById("evidence-query");
  const results = document.getElementById("query-results");
  const count = document.getElementById("query-count");
  const status = document.getElementById("query-status");
  const reset = document.getElementById("query-reset");
  if (!form || !results || !count || !status || !reset) return;

  const queryKeys = ["stage", "condition", "verdict"];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function transitionLabel(mapping) {
    const transition = mapping?.transition;
    if (transition?.from && transition?.to) {
      return `${transition.from} → ${transition.to}${transition.adjacent_stage ? ` / ${transition.adjacent_stage}` : ""}`;
    }
    return (mapping?.stages || []).join(" · ");
  }

  function render(record) {
    const chips = [transitionLabel(record.mapping), ...(record.mapping?.conditions || [])].filter(Boolean);
    const date = new Date(`${record.source.date}T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
    return `<article class="query-result">
      <div class="date">${esc(date)} · ${esc(record.source.producer)}</div>
      <h3>${esc(record.presentation.headline)}</h3>
      <div class="meta">${chips.map((chip, index) => `<span class="chip${index === 0 ? " transition" : ""}">${esc(chip)}</span>`).join("")}</div>
      <p>${esc(record.presentation.summary)}</p>
      <div class="query-result-foot"><strong>${esc(record.model_implication.verdict)}</strong><a class="source" href="/signals/${encodeURIComponent(record.id)}/">Read Scale Signal →</a></div>
    </article>`;
  }

  function formParams() {
    const params = new URLSearchParams(new FormData(form));
    for (const [key, value] of [...params]) if (!value || !queryKeys.includes(key)) params.delete(key);
    return params;
  }

  function restoreQueryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    for (const key of queryKeys) {
      const field = form.elements.namedItem(key);
      const value = params.get(key);
      if (field && value && [...field.options].some((option) => option.value === value)) field.value = value;
    }
  }

  function syncUrl(params) {
    const url = new URL(window.location.href);
    for (const key of queryKeys) url.searchParams.delete(key);
    for (const [key, value] of params) url.searchParams.set(key, value);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function runQuery({ updateUrl = true } = {}) {
    const params = formParams();
    const query = params.toString();
    if (updateUrl) syncUrl(params);
    status.textContent = "Querying evidence…";
    results.innerHTML = "";
    count.textContent = "";

    try {
      const response = await fetch(`/api/evidence${query ? `?${query}` : ""}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      count.textContent = `${data.count} ${data.count === 1 ? "signal" : "signals"}`;
      status.textContent = data.count ? "" : "No evidence matches this query.";
      results.innerHTML = data.evidence.map(render).join("");
    } catch (_) {
      count.textContent = "";
      status.textContent = "The evidence query is temporarily unavailable. The complete static evidence record remains below.";
    }
  }

  form.addEventListener("change", () => runQuery());
  form.addEventListener("submit", (event) => { event.preventDefault(); runQuery(); });
  reset.addEventListener("click", () => { form.reset(); runQuery(); });
  window.addEventListener("popstate", () => { form.reset(); restoreQueryFromUrl(); runQuery({ updateUrl: false }); });

  restoreQueryFromUrl();
  runQuery({ updateUrl: false });
})();
