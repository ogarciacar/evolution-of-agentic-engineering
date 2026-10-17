import { ANSWER_SYSTEM, ANSWER_PROMPT_REVISION } from './answer-prompt.js';
import { getEvidenceById } from '../../functions/_lib/evidence-read-model.js';

export const ANSWER_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const ANSWER_LIMITS = Object.freeze({ records: 5, recordBytes: 10000, inputBytes: 4096, outputTokens: 1800, timeoutMs: 25000 });
const text = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items, minItems, maxItems) => ({ type: 'array', items, minItems, maxItems });
const citationSchema = object({ source_id: text(80), passage_id: text(80), quote: text(1500) });
const statementSchema = object({ text: text(1200), citations: list(citationSchema, 0, 3) });
export const ANSWER_SCHEMA = object({
  outcome: { type: 'string', enum: ['answered', 'insufficient'] },
  summary: statementSchema,
  claims: list(object({ kind: { type: 'string', enum: ['observation', 'interpretation'] }, text: text(1000), citations: list(citationSchema, 1, 3) }), 0, 4),
  uncertainties: list(text(600), 1, 4),
  next_step: { anyOf: [{ type: 'null' }, object({ action: text(700), measure: text(500), decision_rule: text(600), citations: list(citationSchema, 1, 3) })] },
});
// Generation uses structured decisions; the public v1 envelope retains its rendered sentence.
export const ANSWER_CONTRACT = 'experiment_fields_v3';
const decisionSchema = object({ threshold: text(180), if_true: text(180), if_false: text(180) });
const refs = min => list(text(16), min, 3);
const generatedClaim = { anyOf: [
  object({ kind: { type: 'string', enum: ['observation'] }, passage: text(16) }),
  object({ kind: { type: 'string', enum: ['interpretation'] }, text: text(1000), citations: refs(1) }),
] };
const generatedNextStep = object({
  scope: text(120), intervention: text(260), comparison: text(220),
  measurement: object({ metric: text(100), unit: text(40), window: text(120), guardrail: text(140) }),
  decision: decisionSchema,
  citations: refs(1),
});
const generatedBranches = ['answered', 'insufficient'].map(outcome => object({
  ...ANSWER_SCHEMA.properties,
  outcome: { type: 'string', enum: [outcome] },
  summary: object({ text: text(1200), citations: refs(outcome === 'answered' ? 1 : 0) }),
  claims: list(generatedClaim, outcome === 'answered' ? 1 : 0, outcome === 'answered' ? 4 : 0),
  next_step: outcome === 'answered' ? generatedNextStep : { anyOf: [{ type: 'null' }, generatedNextStep] },
}));
export const GENERATION_SCHEMA = { anyOf: generatedBranches };
const bytes = value => new TextEncoder().encode(value).byteLength;
async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2, '0')).join('');
}
export async function canonicalSources(records) {
  const sources = [];
  let omitted = 0;
  for (const record of records) {
    if (!record || bytes(JSON.stringify(record)) > ANSWER_LIMITS.recordBytes) { omitted++; continue; }
    const fields = [
      ...(record.observed || []).map((value, i) => [`observed.${i}`, value]),
      ['interpretation', record.interpretation],
      ['model_implication', record.model_implication?.explanation],
      ...(record.what_this_does_not_establish || []).map((value, i) => [`what_this_does_not_establish.${i}`, value]),
      ['open_question', record.open_question],
    ].filter(([, value]) => typeof value === 'string' && value.trim());
    // A partial record cannot support a synthesis that preserves epistemic boundaries.
    if (!fields.some(([key]) => key.startsWith('observed.')) || !fields.some(([key]) => key.startsWith('what_this_does_not_establish.'))) { omitted++; continue; }
    const url = `https://agenticengineering.science/signals/${record.id}/`;
    sources.push({ id: `source:${await hash(url)}`, record_id: record.id, url,
      title: record.presentation.headline || record.source.title, original: record.source,
      snapshot_id: await hash(JSON.stringify(record)),
      passages: await Promise.all(fields.map(async ([field, value]) => ({ id: `passage:${await hash(JSON.stringify([url, field, value]))}`, field, text: value }))),
    });
  }
  return { sources, omitted };
}
// Request-local references never replace canonical identities in the public response.
export function generationSources(sources) {
  return sources.map((source, i) => ({ title: source.title, original: source.original,
    passages: source.passages.map((p, j) => ({ ref: `s${i + 1}p${j + 1}`, field: p.field, text: p.text })),
  }));
}
class AnswerValidationError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; }
}
const invalid = (reason, message) => { throw new AnswerValidationError(reason, message); };
// Validate the model response even when Workers AI JSON mode succeeds.
function assertSchema(value, schema) {
  if (schema.anyOf) {
    if (!schema.anyOf.some(option => { try { assertSchema(value, option); return true; } catch { return false; } })) invalid('schema_invalid', 'Invalid union');
    return;
  }
  if (schema.type === 'null') { if (value !== null) invalid('schema_invalid', 'Expected null'); return; }
  if (schema.type === 'string') {
    if (typeof value !== 'string' || !value.trim() || value.length < (schema.minLength || 0) || value.length > (schema.maxLength || Infinity) || (schema.enum && !schema.enum.includes(value))) invalid('schema_invalid', 'Invalid text');
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) invalid('schema_invalid', 'Invalid list');
    value.forEach(item => assertSchema(item, schema.items));
  } else if (schema.type === 'object') {
    if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(key => !Object.hasOwn(schema.properties, key))) invalid('schema_invalid', 'Invalid object');
    for (const key of schema.required) assertSchema(value[key], schema.properties[key]);
  }
}
export function validateAnswer(value, sources) {
  assertSchema(value, ANSWER_SCHEMA);
  const checkCitations = (citations, observation = false) => {
    for (const citation of citations) {
      const source = sources.find(s => s.id === citation.source_id);
      const passage = source?.passages.find(p => p.id === citation.passage_id);
      if (!passage || !passage.text.includes(citation.quote) || (observation && !passage.field.startsWith('observed.'))) invalid('citation_invalid', 'Invalid citation');
    }
  };
  checkCitations(value.summary.citations);
  value.claims.forEach(claim => {
    checkCitations(claim.citations, claim.kind === 'observation');
    if (claim.kind === 'observation' && !claim.citations.some(c => {
      const passage = sources.find(s => s.id === c.source_id)?.passages.find(p => p.id === c.passage_id);
      return passage?.text === claim.text && c.quote === passage.text;
    })) invalid('observation_not_verbatim', 'Observation must preserve a complete attributed passage');
  });
  if (value.outcome === 'answered') {
    if (!value.summary.citations.length || !value.claims.length || !value.next_step) invalid('answer_incomplete', 'Incomplete answer');
  } else if (value.claims.length) invalid('abstention_invalid', 'Invalid abstention');
  if (value.next_step) {
    if (!value.summary.citations.length) invalid('answer_incomplete', 'An experiment needs a cited evidence boundary');
    checkCitations(value.next_step.citations);
    // A structural guard, not a semantic judge of the proposed experiment.
    if (!/^if\s+.+[,;]\s*.+;\s*otherwise\s+.+[.!]?$/i.test(value.next_step.decision_rule.trim())) invalid('decision_rule_invalid', 'Decision rule requires condition and alternative actions');
  }
  return value;
}
export function finalizeGeneratedAnswer(value, sources) {
  if (value?.outcome === 'insufficient' && Array.isArray(value.claims) && value.claims.length) invalid('abstention_invalid', 'Invalid abstention');
  if (value?.outcome === 'answered') {
    if (!value.summary?.citations?.length) invalid('summary_citations_missing', 'Missing summary citations');
    if (!value.claims?.length) invalid('claims_missing', 'Missing claims');
    if (!value.next_step) invalid('next_step_missing', 'Missing next step');
  }
  if (value?.next_step && !value.summary?.citations?.length) invalid('summary_citations_missing', 'Missing evidence boundary');
  if (value?.next_step) {
    try { assertSchema(value.next_step.decision, decisionSchema); }
    catch { invalid('decision_rule_invalid', 'Decision requires a threshold and both actions'); }
  }
  assertSchema(value, GENERATION_SCHEMA);
  const passages = new Map();
  sources.forEach((s, i) => s.passages.forEach((p, j) => passages.set(`s${i + 1}p${j + 1}`, { source: s, passage: p })));
  const citation = ref => {
    const found = passages.get(ref);
    if (!found) invalid('citation_reference_unknown', 'Unknown passage reference');
    if (found.passage.text.length > 1500) invalid('citation_passage_too_long', 'Citation exceeds public quote limit');
    return { source_id: found.source.id, passage_id: found.passage.id, quote: found.passage.text };
  };
  const claims = value.claims.map(claim => {
    if (claim.kind === 'interpretation') return { ...claim, citations: claim.citations.map(citation) };
    const cited = citation(claim.passage);
    if (!passages.get(claim.passage).passage.field.startsWith('observed.')) invalid('observation_field_invalid', 'Observation requires observed evidence');
    if (cited.quote.length > 1000) invalid('observation_passage_too_long', 'Observation exceeds public claim limit');
    return { kind: 'observation', text: cited.quote, citations: [cited] };
  });
  const step = value.next_step;
  const inline = text => text.trim().replace(/\s+/g, ' ');
  const fragment = text => inline(text).replace(/\.+$/, '');
  // Check generated prose only: canonical quotes must remain untouched.
  const prose = [value.summary.text, ...value.uncertainties,
    ...value.claims.filter(c => c.kind === 'interpretation').map(c => c.text),
    ...(step ? [step.scope, step.intervention, step.comparison, ...Object.values(step.measurement), ...Object.values(step.decision)] : [])];
  if (prose.some(t => /\bs\d+p\d+\b/i.test(t))) invalid('reference_in_prose', 'Internal reference in generated prose');
  const threshold = step ? fragment(step.decision.threshold).replace(/^if\s+/i, '') : '';
  if (step && (!threshold || /\b(if|then|otherwise)\b|;/i.test(threshold))) invalid('decision_threshold_invalid', 'Threshold must not contain decision branches');
  const answer = { ...value, claims, summary: { ...value.summary, citations: value.summary.citations.map(citation) }, next_step: step ? {
    action: `Proposed trial — Scope: ${fragment(step.scope)}. Intervention: ${fragment(step.intervention)}. Comparison: ${fragment(step.comparison)}.`,
    measure: `Metric: ${fragment(step.measurement.metric)}. Unit: ${fragment(step.measurement.unit)}. Window: ${fragment(step.measurement.window)}. Guardrail: ${fragment(step.measurement.guardrail)}.`,
    citations: step.citations.map(citation),
    decision_rule: `If ${threshold}, ${fragment(step.decision.if_true)}; otherwise ${inline(step.decision.if_false)}`,
  } : null };
  return validateAnswer(answer, sources);
}
function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
function limited(reason) {
  return { outcome: 'insufficient', summary: { text: reason, citations: [] }, claims: [], uncertainties: ['Try a narrower question with a current source report and explicit evidence boundaries.'], next_step: null };
}
async function readBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw Error('Expected JSON');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Missing body');
  const parts = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ANSWER_LIMITS.inputBytes) { await reader.cancel(); throw Error('Body too large'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(size); let offset = 0;
  for (const part of parts) { joined.set(part, offset); offset += part.length; }
  const body = JSON.parse(new TextDecoder().decode(joined));
  if (!body || Object.keys(body).some(key => !['query', 'record_ids', 'snapshot_ids'].includes(key)) || typeof body.query !== 'string' || !body.query.trim() || body.query.trim().length > 500
    || !Array.isArray(body.record_ids) || body.record_ids.length > ANSWER_LIMITS.records || body.record_ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,180}$/.test(id))) throw Error('Invalid request');
  if (body.snapshot_ids !== undefined && (!Array.isArray(body.snapshot_ids) || body.snapshot_ids.length !== body.record_ids.length || new Set(body.record_ids).size !== body.record_ids.length || body.snapshot_ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)))) throw Error('Invalid snapshots');
  return { query: body.query.trim(), ids: [...new Set(body.record_ids)], snapshots: body.snapshot_ids };
}
export function answerAvailable(env) { return env.ANSWER_ENABLED === 'true' && Boolean(env.AI?.run && env.EVIDENCE_DB?.prepare && env.ANSWER_RATE_LIMITER?.limit); }
export async function handleAnswer(request, env) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  let stage = 'request';
  const metrics = { answer_contract: ANSWER_CONTRACT, prompt_revision: ANSWER_PROMPT_REVISION };
  let modelStarted;
  const measurements = () => ({ ...metrics, ...(modelStarted === undefined ? {} : { model_latency_ms: metrics.model_latency_ms ?? Date.now() - modelStarted }) });
  const failure = (code, message, status, headers = {}, details = {}) => {
    const diagnostic = { code, request_id: requestId, stage, latency_ms: Date.now() - started, ...measurements(), ...details };
    console.log(JSON.stringify({ event: 'eae_answer_error', ...diagnostic }));
    return json({ error: message, ...diagnostic }, status, { 'X-Request-ID': requestId, ...headers });
  };
  if (request.method !== 'POST') return failure('method_not_allowed', 'Method not allowed', 405, { Allow: 'POST' });
  let body;
  try { body = await readBody(request); } catch { return failure('invalid_request', 'Provide a question and up to five canonical record IDs', 400); }
  if (!answerAvailable(env)) return failure(env.ANSWER_ENABLED !== 'true' ? 'answer_disabled' : 'configuration_error', 'Answer generation is unavailable', 503);
  let timer;
  let expired = false;
  try {
    const work = async () => {
      stage = 'rate_limit';
      const { success } = await env.ANSWER_RATE_LIMITER.limit({ key: `eae-answer:${request.headers.get('CF-Connecting-IP') || 'unknown'}` });
      if (expired) throw Error('Deadline');
      if (!success) return failure('rate_limited', 'Please wait a minute before asking again', 429, { 'Retry-After': '60' });
      stage = 'evidence';
      const records = await Promise.all(body.ids.map(id => getEvidenceById(env, id, 'main')));
      if (expired) throw Error("Answer deadline exceeded");
      request.signal.throwIfAborted();
      const { sources, omitted } = await canonicalSources(records);
      if (body.snapshots && (sources.length !== body.ids.length || sources.some((s, i) => s.record_id !== body.ids[i] || s.snapshot_id !== body.snapshots[i]))) return failure('evidence_snapshot_changed', 'Pinned evidence is no longer available unchanged', 409);
      const envelope = { version: 1, provenance: 'canonical_eae_records', projection: 'main', loaded_at: new Date().toISOString(), sources, omitted_records: omitted };
      if (!sources.length) return json({ ...envelope, answer: limited('The retrieved results do not contain usable current EAE records for an answer.') }, 200, { 'X-Request-ID': requestId });
      if (expired) throw Error("Answer deadline exceeded");
      request.signal.throwIfAborted();
      stage = 'model';
      const input = { messages: [{ role: 'system', content: ANSWER_SYSTEM }, { role: 'user', content: JSON.stringify({ question: body.query, sources: generationSources(sources) }) }], response_format: { type: 'json_schema', json_schema: GENERATION_SCHEMA }, max_tokens: ANSWER_LIMITS.outputTokens, temperature: 0.1 };
      metrics.model_input_bytes = bytes(JSON.stringify(input));
      metrics.max_output_tokens = ANSWER_LIMITS.outputTokens;
      modelStarted = Date.now();
      const generated = await env.AI.run(ANSWER_MODEL, input);
      if (expired) throw Error("Answer deadline exceeded");
      request.signal.throwIfAborted();
      metrics.model_latency_ms = Date.now() - modelStarted;
      metrics.model_output_bytes = bytes(typeof generated?.response === 'string' ? generated.response : JSON.stringify(generated?.response ?? null));
      for (const [key, usageKey] of [['input_tokens', 'prompt_tokens'], ['output_tokens', 'completion_tokens']]) {
        const count = generated?.usage?.[usageKey];
        if (Number.isSafeInteger(count) && count >= 0) metrics[key] = count;
      }
      stage = 'validation';
      let answer;
      try {
        const raw = typeof generated?.response === 'string' ? JSON.parse(generated.response) : generated?.response;
        answer = finalizeGeneratedAnswer(raw, sources);
      } catch (error) {
        const validation_reason = error instanceof AnswerValidationError ? error.reason : error instanceof SyntaxError ? 'json_invalid' : 'validation_error';
        return failure('invalid_model_output', 'The generated answer did not pass evidence checks', 502, {}, { validation_reason });
      }
      console.log(JSON.stringify({ event: 'eae_answer', request_id: requestId, outcome: answer.outcome, model: ANSWER_MODEL, records: sources.length, omitted_records: omitted, latency_ms: Date.now() - started, ...measurements() }));
      return json({ ...envelope, model: ANSWER_MODEL, answer, diagnostics: measurements() }, 200, { 'X-Request-ID': requestId });
    };
    return await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(Error('Answer timeout')); }, ANSWER_LIMITS.timeoutMs); })]);
  } catch {
    const code = expired ? 'deadline_exceeded' : request.signal.aborted ? 'request_aborted' : ({ rate_limit: 'rate_limiter_error', evidence: 'evidence_error', model: 'provider_error' }[stage] || 'internal_error');
    return failure(code, 'Answer generation is temporarily unavailable', 503);
  } finally { clearTimeout(timer); }
}
