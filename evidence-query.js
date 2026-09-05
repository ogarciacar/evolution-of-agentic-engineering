(() => {
  const form = document.getElementById("evidence-query");
  const results = document.getElementById("query-results");
  const count = document.getElementById("query-count");
  const status = document.getElementById("query-status");
  const reset = document.getElementById("query-reset");
  if (!form || !results || !count || !status || !reset) return;

  const queryKeys = ["stage", "condition", "verdict"];
  const stages = ["Apparition", "Mutation", "Selection", "Cooperation", "Specialization"];
  const conditions = ["Context", "Execution", "Verification", "Coordination", "Observability", "Economics", "Learning"];
  const verdicts = ["SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE"];
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

  function countsFor(records, values, readValues) {
    return values.map((value) => ({ value, count: records.filter((record) => readValues(record).includes(value)).length }));
  }

  function strongest(items) {
    return [...items].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))[0];
  }

  function weakest(items) {
    return [...items].sort((a, b) => a.count - b.count || a.value.localeCompare(b.value))[0];
  }

  function synthesis(records) {
    if (!records.length) return "";
    const stageCounts = countsFor(records, stages, (record) => record.mapping?.stages || []);
    const conditionCounts = countsFor(records, conditions, (record) => record.mapping?.conditions || []);
    const verdictCounts = countsFor(records, verdicts, (record) => [record.model_implication?.verdict].filter(Boolean));
    const leadStage = strongest(stageCounts);
    const leadCondition = strongest(conditionCounts);
    const weakCondition = weakest(conditionCounts);
    const support = verdictCounts.find(({ value }) => value === "SUPPORTS")?.count || 0;
    const refine = verdictCounts.find(({ value }) => value === "REFINES")?.count || 0;
    const contradict = verdictCounts.find(({ value }) => value === "CONTRADICTS")?.count || 0;
    const inconclusive = verdictCounts.find(({ value }) => value === "INCONCLUSIVE")?.count || 0;

    const verdictStatement = contradict
      ? `${contradict} ${contradict === 1 ? "signal challenges" : "signals challenge"} the current model.`
      : refine
        ? `${refine} ${refine === 1 ? "signal refines" : "signals refine"} the model without directly contradicting it.`
        : support
          ? `${support} ${support === 1 ? "signal supports" : "signals support"} the model and none directly contradict it.`
          : `${inconclusive} ${inconclusive === 1 ? "signal is" : "signals are"} inconclusive.`;

    return `<aside class="query-result" aria-labelledby="synthesis-title">
      <div class="date">Evidence synthesis · computed from this query</div>
      <h3 id="synthesis-title">What this evidence currently says</h3>
      <p>The strongest concentration is <strong>${esc(leadStage.value)}</strong> (${leadStage.count}) and <strong>${esc(leadCondition.value)}</strong> (${leadCondition.count}). ${esc(verdictStatement)}</p>
      <p><strong>${esc(weakCondition.value)}</strong> is the least represented condition (${weakCondition.count}), making it the clearest evidence gap in this result set.</p>
      <div class="meta">${verdictCounts.filter(({ count: n }) => n).map(({ value, count: n }) => `<span class="chip">${esc(value)} ${n}</span>`).join("")}</div>
    </aside>`;
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
      results.innerHTML = `${synthesis(data.evidence)}${data.evidence.map(render).join("")}`;
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
