(() => {
  const SITE_ORIGIN = "https://agenticengineering.science";
  const MAX_EXCERPT_CHARS = 620;
  const MAX_EPISTEMIC_CHARS = 300;
  const MAX_QUERY_LENGTH = 500;

  function validateQuestion(value) {
    const query = String(value ?? "").trim();
    const error = !query ? "Enter a question to search the evidence."
      : query.length > MAX_QUERY_LENGTH ? "Use 500 characters or fewer." : "";
    return { query, error };
  }

  // Request identity is independent of AbortSignal: an adapter may finish even
  // after cancellation. Only the current request may update the visible state.
  function createInvestigation({ request, generate, onState = () => {} }) {
    let state = { phase: "editing", query: "", error: "", results: [], stopped: false };
    let active = null;
    const publish = next => { state = next; onState(state); };
    async function prepare(current, query, results) {
      publish({ phase: "preparing", query, error: "", results, stopped: false });
      try {
        const answer = await generate(query, results, { signal: current.controller.signal });
        if (active !== current) return;
        active = null;
        publish({ phase: answer.answer.outcome === "insufficient" ? "answer_limited" : "complete", query, error: "", results, answer, stopped: false });
      } catch (error) {
        if (active !== current) return;
        active = null;
        publish({ phase: "answer_failed", query, error: "", results, rateLimited: error.status === 429, stopped: false });
      }
    }
    return {
      get state() { return state; },
      async submit(value) {
        if (active) return;
        const { query, error } = validateQuestion(value);
        if (error) { publish({ phase: "editing", query, error, results: [], stopped: false }); return; }
        const current = { controller: new AbortController() };
        active = current;
        publish({ phase: "finding", query, error: "", results: [], stopped: false });
        try {
          const results = await request(query, { signal: current.controller.signal });
          if (active !== current) return;
          if (results.length && results.canAnswer && generate) return await prepare(current, query, results);
          active = null;
          publish({ phase: results.length ? "complete" : "limited", query, error: "", results, stopped: false });
        } catch {
          if (active !== current) return;
          active = null;
          publish({ phase: "failed", query, error: "", results: [], stopped: false });
        }
      },
      async retryAnswer() {
        if (active || state.phase !== "answer_failed") return;
        const current = { controller: new AbortController() };
        active = current;
        return prepare(current, state.query, state.results);
      },
      refine() {
        if (active || !["limited", "answer_limited", "complete", "answer_failed"].includes(state.phase)) return;
        publish({ phase: "editing", query: state.query, error: "", results: [], stopped: false });
      },
      stop() {
        if (!active) return;
        const current = active;
        active = null;
        current.controller.abort();
        publish({ phase: "editing", query: state.query, error: "", results: [], stopped: true });
      },
    };
  }

  function esc(value, quote = false) {
    let out = String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    if (quote) out = out.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    return out;
  }

  function shortExcerpt(value, maxChars = MAX_EXCERPT_CHARS) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text.length <= maxChars) return text;
    const slice = text.slice(0, maxChars);
    const boundary = slice.lastIndexOf(" ");
    const minBoundary = Math.floor(maxChars * 0.74);
    const end = boundary >= minBoundary ? boundary : maxChars;
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

  function safeOriginalUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
    } catch { return null; }
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

  function isAllowedSearchUrl(value) {
    return isPracticesUrl(value) || signalIdFromUrl(value) !== null;
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
    let label = "WHY THIS MATCHES";

    if (/^#{1,6}\s*What this does not establish\b/i.test(text)) {
      label = "WHAT THIS DOES NOT ESTABLISH";
      text = text.replace(/^#{1,6}\s*What this does not establish\s*/i, "");
    } else if (/^#{1,6}\s*Source\s*→\s*Observed\s*→\s*Interpretation\s*→\s*Model implication\b/i.test(text)) {
      text = text.replace(/^#{1,6}\s*Source\s*→\s*Observed\s*→\s*Interpretation\s*→\s*Model implication\s*/i, "");
    }

    text = text
      .replace(/\*\*(SOURCE|OBSERVED|INTERPRETATION|MODEL IMPLICATION)\*\*/gi, "$1 ·")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/(^|\s)[*+-]\s+/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const maxChars = label === "WHAT THIS DOES NOT ESTABLISH" ? MAX_EPISTEMIC_CHARS : MAX_EXCERPT_CHARS;
    return { label, text: shortExcerpt(text, maxChars) };
  }

  function normalizeResult(result) {
    const url = safeSourceUrl(result?.url);
    if (!url || !isAllowedSearchUrl(url)) return null;
    return {
      title: String(result?.title ?? "").trim() || (isPracticesUrl(url) ? "Emerging Practices" : "Scale Signal"),
      url,
      excerpt: shortExcerpt(result?.excerpt),
    };
  }

  function normalizeResults(results) {
    if (!Array.isArray(results)) return [];
    return results.map(normalizeResult).filter(Boolean);
  }

  function normalizeEvidenceResults(data) {
    // Pages and the search Worker deploy separately. Older Workers continue
    // serving working cards until the opt-in passage contract is available.
    if (data.evidence === undefined) {
      if (!Array.isArray(data.results)) throw new Error("Invalid search response");
      return normalizeResults(data.results);
    }
    const evidence = data.evidence;
    if (evidence?.version !== 1 || evidence.provenance !== "indexed_eae_pages" || !Array.isArray(evidence.sources)) {
      throw new Error("Invalid evidence package");
    }
    if (evidence.outcome === "no_matching_evidence" && evidence.sources.length === 0) return [];
    if (evidence.outcome !== "evidence_found" || !evidence.sources.length || evidence.sources.length > 5) {
      throw new Error("Evidence passages unavailable");
    }
    return evidence.sources.map(source => {
      if (!/^source:[a-f0-9]{64}$/.test(source.id) || !safeSourceUrl(source.url) || !isAllowedSearchUrl(source.url)
        || !["eae_signal", "eae_collection"].includes(source.kind)
        || !Array.isArray(source.passages) || !source.passages.length || source.passages.length > 3
        || source.passages.some(p => !/^passage:[a-f0-9]{64}$/.test(p.id) || typeof p.text !== "string" || !p.text.trim()
          || new TextEncoder().encode(p.text).byteLength > 12000)) {
        throw new Error("Invalid evidence source");
      }
      const legacy = (data.results || []).find(result => normalizedPath(result.url) === normalizedPath(source.url));
      const result = normalizeResult({ title: source.title, url: source.url, excerpt: legacy?.excerpt || source.passages[0].text });
      return { ...result, retrieved: { ...source, truncated: Boolean(evidence.truncated) } };
    });
  }

  function normalizeEvidence(record, expectedId) {
    if (!record || record.id !== expectedId) return null;
    return {
      id: record.id,
      source: {
        title: String(record.source?.title ?? ""),
        url: safeOriginalUrl(record.source?.url),
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

  async function enrichResult(result, fetchImpl, signal) {
    const id = signalIdFromUrl(result.url);
    if (!id) return result;

    try {
      const response = await fetchImpl(`/api/evidence/${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) return result;
      const evidence = normalizeEvidence(await response.json(), id);
      return evidence ? { ...result, evidence } : result;
    } catch {
      return result;
    }
  }

  async function enrichResults(results, fetchImpl, signal) {
    return Promise.all(results.map((result) => enrichResult(result, fetchImpl, signal)));
  }

  function createSearchRequest(fetchImpl) {
    return async (query, { signal } = {}) => {
      signal?.throwIfAborted();
      const response = await fetchImpl(`/api/search?q=${encodeURIComponent(query)}&passages=1`, {
        headers: { Accept: "application/json" },
        signal,
      });
      signal?.throwIfAborted();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      signal?.throwIfAborted();
      const results = await enrichResults(normalizeEvidenceResults(data), fetchImpl, signal);
      signal?.throwIfAborted();
      if (data.answer_available === true) results.canAnswer = true;
      return results;
    };
  }

  function normalizeAnswer(data) {
    const a = data?.answer;
    if (data?.version !== 1 || data.provenance !== "canonical_eae_records" || !Array.isArray(data.sources) || data.sources.length > 5
      || !["answered", "insufficient"].includes(a?.outcome) || typeof a.summary?.text !== "string" || !Array.isArray(a.summary.citations)
      || !Array.isArray(a.claims) || !Array.isArray(a.uncertainties) || !a.uncertainties.length) throw new Error("Invalid answer");
    for (const source of data.sources) {
      if (!/^source:[a-f0-9]{64}$/.test(source.id) || !safeSourceUrl(source.url) || !signalIdFromUrl(source.url)
        || !Array.isArray(source.passages) || !source.passages.length || source.passages.some(p => !/^passage:[a-f0-9]{64}$/.test(p.id) || typeof p.text !== "string" || typeof p.field !== "string")) throw new Error("Invalid source");
    }
    const statements = [a.summary, ...a.claims, ...(a.next_step ? [a.next_step] : [])];
    for (const statement of statements) {
      if (!Array.isArray(statement.citations)) throw new Error("Missing citations");
      for (const cite of statement.citations) {
        const source = data.sources.find(s => s.id === cite.source_id);
        const passage = source?.passages.find(p => p.id === cite.passage_id);
        if (!passage || typeof cite.quote !== "string" || !cite.quote.trim() || !passage.text.includes(cite.quote)) throw new Error("Invalid citation");
      }
    }
    if (a.outcome === "answered" && (!a.summary.citations.length || !a.claims.length || !a.next_step?.action || !a.next_step.measure || !a.next_step.decision_rule)) throw new Error("Incomplete answer");
    return data;
  }

  function createAnswerRequest(fetchImpl = globalThis.fetch) {
    return async (query, results, { signal } = {}) => {
      const record_ids = [...new Set(results.map(r => r.retrieved?.record_id).filter(Boolean))].slice(0, 5);
      const response = await fetchImpl("/api/search/answer", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, record_ids }), signal });
      signal?.throwIfAborted();
      if (!response.ok) { const error = new Error("Answer unavailable"); error.status = response.status; throw error; }
      const data = normalizeAnswer(await response.json());
      signal?.throwIfAborted();
      return data;
    };
  }

  function renderAnswer(data) {
    const a = data.answer;
    const citations = items => items.map(c => {
      const index = data.sources.findIndex(s => s.id === c.source_id) + 1;
      return `<button type="button" class="answer-citation" data-citation-source="${esc(c.source_id, true)}" data-passage-id="${esc(c.passage_id, true)}" data-citation-quote="${esc(c.quote, true)}" aria-label="Inspect citation ${index}">[${index}]</button>`;
    }).join(" ");
    const limits = `<div class="answer-limits"><h4>What remains uncertain</h4><ul>${a.uncertainties.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
    if (a.outcome === "insufficient") return `<article class="answer-card"><span class="answer-eyebrow">Evidence boundary</span><h3>Not enough evidence to answer</h3><p>${esc(a.summary.text)} ${citations(a.summary.citations)}</p>${limits}<button type="button" class="evidence-inspect" data-answer-refine>Refine question</button></article>`;
    return `<article class="answer-card"><span class="answer-eyebrow">AI interpretation · check the evidence</span><h3>What the evidence suggests</h3><p class="answer-summary">${esc(a.summary.text)} ${citations(a.summary.citations)}</p><div class="answer-claims">${a.claims.map(c => `<div><b>${c.kind === "observation" ? "Reported observation" : "Interpretation"}</b><p>${esc(c.text)} ${citations(c.citations)}</p></div>`).join("")}</div>${limits}<section class="answer-next"><span class="answer-eyebrow">Proposed experiment</span><h3>One next step</h3><p>${esc(a.next_step.action)} ${citations(a.next_step.citations)}</p><dl><dt>Measure</dt><dd>${esc(a.next_step.measure)}</dd><dt>Decide</dt><dd>${esc(a.next_step.decision_rule)}</dd></dl></section><p class="ask-note">Based on ${data.sources.length} current EAE record${data.sources.length === 1 ? "" : "s"}. Reports may share an original source; this is not a count of independent confirmations.${data.omitted_records ? " Some retrieved records were unavailable or exceeded the evidence limit." : ""}</p><div class="answer-actions"><button type="button" class="evidence-inspect" data-answer-copy>Copy answer with sources</button><button type="button" class="evidence-inspect" data-answer-refine>Refine question</button><span class="ask-note" data-copy-status aria-live="polite"></span></div></article>`;
  }

  function answerText(data, query) {
    const a = data.answer;
    const refs = items => items.map(c => `[${data.sources.findIndex(s => s.id === c.source_id) + 1}]`).join(" ");
    return [`Question: ${query}`, "AI interpretation — check the evidence", `${a.summary.text} ${refs(a.summary.citations)}`,
      ...a.claims.map(c => `${c.kind}: ${c.text} ${refs(c.citations)}`), "What remains uncertain:", ...a.uncertainties.map(t => `- ${t}`),
      ...(a.next_step ? ["Proposed experiment:", `${a.next_step.action} ${refs(a.next_step.citations)}`, `Measure: ${a.next_step.measure}`, `Decide: ${a.next_step.decision_rule}`] : []),
      `Canonical EAE records loaded: ${data.loaded_at}`,
      ...data.sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}\nOriginal: ${safeOriginalUrl(s.original?.url) || "Unavailable"}\nRecord snapshot: ${s.snapshot_id}`),
      "EAE records contain attributed reports and interpretations, not independent verification."
    ].join("\n\n");
  }

  function renderCanonicalDetails(source, passageId, quote = "") {
    const originalUrl = safeOriginalUrl(source.original?.url);
    return `<h3>${esc(source.title)}</h3>${quote ? `<blockquote class="answer-quote"><b>Cited excerpt</b><p>${esc(quote)}</p></blockquote>` : ""}<p>Current EAE record. Observations are attributed reports; interpretations and limitations are shown separately. These are not verified quotations from the original source.</p><a class="source" href="${esc(source.url, true)}" target="_blank" rel="noopener noreferrer">Open EAE page</a><section class="evidence-origin"><h4>Original source</h4><p>${esc(source.original?.title)}</p><p>${esc([source.original?.producer, formatDate(source.original?.date)].filter(Boolean).join(" · "))}</p>${originalUrl ? `<a class="source" href="${esc(originalUrl, true)}" target="_blank" rel="noopener noreferrer">Open original source</a>` : ""}</section>${source.passages.map(p => `<section class="evidence-passage-block${p.id === passageId ? " cited-passage" : ""}" ${p.id === passageId ? 'data-cited-passage tabindex="-1"' : ""}><h4>${p.field.startsWith("observed.") ? "Reported observation" : p.field.startsWith("what_this_does_not_establish.") ? "What this does not establish" : p.field === "open_question" ? "Open question" : "EAE interpretation"}${p.id === passageId ? " · cited passage" : ""}</h4><div class="evidence-passage">${esc(p.text)}</div></section>`).join("")}`;
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
    const passageClass = passage.label === "WHAT THIS DOES NOT ESTABLISH" ? " epistemic-boundary" : "";

    return `<article class="ask-result ask-result-signal">${provenance ? `<div class="date">${esc(provenance)}</div>` : ""}<h3>${esc(headline)}</h3>${chips.length ? `<div class="meta">${chips.map((chip, index) => `<span class="chip${index === 0 ? " transition" : ""}">${esc(chip)}</span>`).join("")}</div>` : ""}${passage.text ? `<div class="ask-match${passageClass}"><b>${esc(passage.label)}</b><p>${esc(passage.text)}</p></div>` : ""}<div class="ask-result-foot">${evidence.verdict ? `<strong>${esc(evidence.verdict)}</strong>` : "<span></span>"}<a class="source" href="${esc(result.url, true)}">Read Scale Signal →</a></div></article>`;
  }

  function renderSignalFallbackResult(result) {
    const passage = matchedPassage(result.excerpt);
    const passageClass = passage.label === "WHAT THIS DOES NOT ESTABLISH" ? " epistemic-boundary" : "";
    return `<article class="ask-result ask-result-signal"><h3>${esc(result.title || "Scale Signal")}</h3>${passage.text ? `<div class="ask-match${passageClass}"><b>${esc(passage.label)}</b><p>${esc(passage.text)}</p></div>` : ""}<div class="ask-result-foot"><span></span><a class="source" href="${esc(result.url, true)}">Read Scale Signal →</a></div></article>`;
  }

  function renderResult(result) {
    let markup = isPracticesUrl(result.url) ? renderPracticesResult(result)
      : result.evidence ? renderSignalResult(result)
      : signalIdFromUrl(result.url) ? renderSignalFallbackResult(result) : "";
    if (markup && result.retrieved) {
      markup = markup.replace("</article>", `<button class="evidence-inspect" type="button" data-source-id="${esc(result.retrieved.id, true)}">Inspect passages</button></article>`);
    }
    return markup;
  }

  function renderEvidenceDetails(result) {
    const source = result.retrieved;
    const original = result.evidence?.source;
    const originalUrl = safeOriginalUrl(original?.url);
    const metadata = originalUrl
      ? `<section class="evidence-origin"><h4>Original source</h4><p>${esc(original.title || "Source report")}</p><p>${esc([formatDate(original.date), original.producer].filter(Boolean).join(" · "))}</p><a class="source" href="${esc(originalUrl, true)}" target="_blank" rel="noopener noreferrer">Open original source</a><p class="ask-note">Source metadata comes from the current EAE record; the passages below come from the search index and may reflect an earlier page version.</p></section>`
      : `<p class="ask-note">Original-source metadata is unavailable. Use the EAE page to check its references.</p>`;
    return `<h3>${esc(result.title)}</h3><p>Passages from the indexed EAE page. These may include EAE interpretation and are not verified quotations from the original source.</p><a class="source" href="${esc(source.url, true)}" target="_blank" rel="noopener noreferrer">Open EAE page</a>${metadata}${source.truncated ? '<p class="ask-note">Showing a bounded selection of retrieved passages. Open the EAE page for full context.</p>' : ""}${source.passages.map((passage, index) => `<section class="evidence-passage-block"><h4>Passage ${index + 1}</h4><div class="evidence-passage">${esc(passage.text)}</div></section>`).join("")}`;
  }

  function init(doc = globalThis.document, fetchImpl = globalThis.fetch) {
    if (!doc || typeof fetchImpl !== "function") return;
    const form = doc.getElementById("ask-evidence-form");
    const input = doc.getElementById("ask-evidence-input");
    const button = doc.getElementById("ask-evidence-submit");
    const count = doc.getElementById("ask-evidence-count");
    const status = doc.getElementById("ask-evidence-status");
    const results = doc.getElementById("ask-evidence-results");
    const answerPanel = doc.getElementById("ask-evidence-answer");
    const stop = doc.getElementById("ask-evidence-stop");
    const error = doc.getElementById("ask-evidence-error");
    const empty = doc.getElementById("ask-evidence-empty");
    const refine = doc.getElementById("ask-evidence-refine");
    const dialog = doc.getElementById("evidence-dialog");
    const details = doc.getElementById("evidence-details");
    const close = doc.getElementById("evidence-close");
    let inspectedFrom = null;
    let renderedResults = null;
    if (!form || !input || !button || !count || !status || !results || !stop || !error || !empty || !refine || !dialog || !details || !close) return;

    const investigation = createInvestigation({
      request: createSearchRequest(fetchImpl),
      generate: createAnswerRequest(fetchImpl),
      onState(state) {
        const finding = ["finding", "preparing"].includes(state.phase);
        if (dialog.open && ["editing", "finding", "failed"].includes(state.phase)) dialog.close();
        empty.hidden = state.phase !== "limited";
        button.disabled = finding;
        input.readOnly = finding;
        stop.hidden = !finding;
        if (finding) form.setAttribute("aria-busy", "true");
        else form.removeAttribute("aria-busy");
        error.textContent = state.error;
        if (state.error) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
        count.textContent = "";
        if (renderedResults !== state.results) {
          results.innerHTML = state.results.map(renderResult).join("");
          renderedResults = state.results;
        }
        status.textContent = state.phase === "preparing" ? "Preparing an answer from current evidence…"
          : finding ? "Finding relevant evidence…"
          : state.stopped ? "Investigation stopped. You can edit your question and try again."
          : state.phase === "limited" ? "No matching evidence in this corpus."
          : state.phase === "failed" ? "Search is temporarily unavailable. Please try again or explore the Evidence page."
          : "";
        if (["complete", "preparing", "answer_limited", "answer_failed"].includes(state.phase)) {
          const total = state.results.length;
          count.textContent = total ? `${total} ${total === 1 ? "result" : "results"}` : "";
          if (state.phase === "complete") status.textContent = state.answer ? "Answer ready. Check its evidence and proposed next step." : total ? "" : "No evidence matched this question.";
        }
        if (answerPanel) {
          answerPanel.innerHTML = state.answer ? renderAnswer(state.answer)
            : state.phase === "answer_failed" ? `<article class="answer-card"><h3>The answer could not be prepared</h3><p>${state.rateLimited ? "Please wait a minute before retrying." : "Your evidence is still available below. Try preparing the answer again."}</p><button type="button" class="evidence-inspect" data-answer-retry>Retry answer</button><button type="button" class="evidence-inspect" data-answer-refine>Refine question</button></article>` : "";
          if (state.phase === "answer_limited") status.textContent = "The evidence is not sufficient to answer this question.";
          if (state.phase === "answer_failed") status.textContent = "Answer unavailable. Retrieved evidence remains available.";
        }
        // Keep cancellation reachable below the tall homepage hero on mobile.
        if (finding) stop.scrollIntoView({ block: "nearest", behavior: "instant" });
        if (state.error || state.stopped) input.focus();
      },
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void investigation.submit(input.value);
    });
    stop.addEventListener("click", () => investigation.stop());
    refine.addEventListener("click", () => { investigation.refine(); input.focus(); });
    results.addEventListener("click", event => {
      const trigger = event.target.closest("[data-source-id]");
      if (!trigger) return;
      const result = investigation.state.results.find(item => item.retrieved?.id === trigger.dataset.sourceId);
      if (!result) return;
      inspectedFrom = trigger;
      details.innerHTML = renderEvidenceDetails(result);
      dialog.showModal();
    });
    answerPanel?.addEventListener("click", async event => {
      const trigger = event.target.closest("button");
      if (!trigger) return;
      if (trigger.hasAttribute("data-answer-refine")) { investigation.refine(); input.focus(); }
      else if (trigger.hasAttribute("data-answer-retry")) await investigation.retryAnswer();
      else if (trigger.hasAttribute("data-answer-copy")) {
        const copyStatus = answerPanel.querySelector("[data-copy-status]");
        try {
          await navigator.clipboard.writeText(answerText(investigation.state.answer, investigation.state.query));
          if (copyStatus?.isConnected) copyStatus.textContent = "Copied with sources and uncertainties.";
        } catch { if (copyStatus?.isConnected) copyStatus.textContent = "Copy unavailable. Select the answer text to copy it."; }
      } else if (trigger.dataset.citationSource) {
        const source = investigation.state.answer?.sources.find(s => s.id === trigger.dataset.citationSource);
        if (!source) return;
        inspectedFrom = trigger;
        details.innerHTML = renderCanonicalDetails(source, trigger.dataset.passageId, trigger.dataset.citationQuote);
        dialog.showModal();
        details.querySelector("[data-cited-passage]")?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      if (inspectedFrom?.isConnected) inspectedFrom.focus({ preventScroll: true });
      inspectedFrom = null;
    });
    input.addEventListener("input", () => {
      error.textContent = "";
      input.removeAttribute("aria-invalid");
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      normalizeAnswer, createAnswerRequest, renderAnswer, renderCanonicalDetails, answerText,
      normalizeEvidenceResults,
      renderEvidenceDetails,
      validateQuestion,
      createInvestigation,
      createSearchRequest,
      shortExcerpt,
      safeSourceUrl,
      isPracticesUrl,
      signalIdFromUrl,
      isAllowedSearchUrl,
      matchedPassage,
      normalizeResults,
      enrichResults,
      renderResult,
    };
  }

  if (typeof document !== "undefined") init();
})();
