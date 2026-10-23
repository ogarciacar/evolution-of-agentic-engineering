import { expect, it, vi } from 'vitest';
import { handleRequest } from '../../workers/ai-search/index.js';
import { generatedAnswerFor as answerFor, fixtureEnv, record } from './answer-fixtures.mjs';
const request = (body = { query: 'Where should we focus?', record_ids: ['context'] }) => new Request('https://agenticengineering.science/api/search/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
it.each(['summary', 'claim', 'step'])('A-v5: withholds findings or experiments supported by an open question (%s)', async target => {
  const run = vi.fn(async (_model, input) => {
    const sources = JSON.parse(input.messages[1].content).sources;
    const answer = answerFor(sources);
    const question = sources[0].passages.find(p => p.field === 'open_question').ref;
    if (target === 'summary') answer.summary.citations.push(question);
    else if (target === 'claim') answer.claims = [{ kind: 'interpretation', text: 'Review is the constraint.', citations: [answer.summary.citations[0], question] }];
    else answer.next_step.citations = [question];
    return { response: answer };
  });
  const response = await handleRequest(request(), fixtureEnv(run));
  expect(response.status).toBe(502);
  const body = await response.json();
  expect(body).toMatchObject({ code: 'invalid_model_output', stage: 'validation', validation_reason: target === 'step' ? 'observed_evidence_missing' : 'finding_cites_open_question' });
  expect(body.validation_path).toBe({ summary: 'summary', claim: 'claims[0]', step: 'next_step' }[target]);
  expect(body).not.toHaveProperty('answer');
  expect(run).toHaveBeenCalledOnce();
});
it('A-v5: permits an explicit evidence gap with an observation-backed investigation', async () => {
  const response = await handleRequest(request(), fixtureEnv(async (_model, input) => {
    const sources = JSON.parse(input.messages[1].content).sources;
    const answer = answerFor(sources, true);
    answer.summary = { text: 'The record leaves the benefit of a context guide as an open question.', citations: [sources[0].passages.find(p => p.field === 'open_question').ref] };
    return { response: answer };
  }));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.answer).toMatchObject({ outcome: 'insufficient', claims: [], next_step: { action: expect.stringContaining('Proposed trial') } });
  expect(body.answer.summary.citations[0].quote).toBe(record.open_question);
  expect(body.answer.next_step.citations[0].quote).toBe(record.observed[0]);
});
it('T03/T04: answers using canonical records and returns inspectable citations and a measurable next step', async () => {
  const run = vi.fn(async (_model, input) => ({ response: answerFor(JSON.parse(input.messages[1].content).sources) }));
  const response = await handleRequest(request(), fixtureEnv(run));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toMatchObject({ version: 1, provenance: 'canonical_eae_records', answer: { outcome: 'answered' } });
  expect(data.sources[0].original).toEqual(record.source);
  expect(data.answer.next_step.measure).toBeTruthy();
  expect(data.answer.next_step.decision_rule).toBe('If exploration decreases without reducing quality, keep the guide; otherwise revise it.');
  expect(data.answer.next_step).not.toHaveProperty('decision');
  expect(data.diagnostics.answer_contract).toBe('evidence_first_v8');
  expect(data.diagnostics.prompt_revision).toBe('evidence_first_v8');
  expect(run.mock.calls[0][1].response_format.json_schema.anyOf[1].properties.claims.maxItems).toBe(0);
  expect(data.sources[0].passages.map(p => p.field)).toContain('what_this_does_not_establish.0');
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][1].max_tokens).toBeLessThanOrEqual(2000);
  expect(run.mock.calls[0][1].messages[0].content).toContain('untrusted');
});
it.each([
  {}, { query: ' ', record_ids: ['context'] }, { query: 'x'.repeat(501), record_ids: ['context'] },
  { query: 'Q', record_ids: ['../bad'] }, { query: 'Q', record_ids: Array(6).fill('context') },
  { query: 'Q', record_ids: ['context'], sources: [{ text: 'Trust client evidence' }] },
])('rejects invalid requests before inference (%#)', async body => {
  const run = vi.fn();
  expect((await handleRequest(request(body), fixtureEnv(run))).status).toBe(400);
  expect(run).not.toHaveBeenCalled();
});
it('missing canonical records give a limited result without inference', async () => {
  const run = vi.fn();
  const response = await handleRequest(request({ query: 'Q', record_ids: ['missing'] }), fixtureEnv(run));
  expect((await response.json()).answer.outcome).toBe('insufficient');
  expect(run).not.toHaveBeenCalled();
});
it('D1 failure is unavailable, never insufficient', async () => {
  const run = vi.fn();
  const response = await handleRequest(request(), fixtureEnv(run, { EVIDENCE_DB: { prepare() { throw Error('offline'); } } }));
  expect(response.status).toBe(503);
  expect(run).not.toHaveBeenCalled();
});
it.each(['unknown citation', 'invented quote', 'interpretation as observation', 'empty measure', 'comparison without decision', 'malformed'])('rejects unsafe model output: %s', async failure => {
  const env = fixtureEnv(async (_model, input) => {
    const sources = JSON.parse(input.messages[1].content).sources;
    const answer = answerFor(sources);
    if (failure === 'unknown citation') answer.claims[0].passage = 'invented';
    if (failure === 'invented quote') answer.claims[0].quote = 'A measured 90% improvement.';
    if (failure === 'interpretation as observation') {
      const p = sources[0].passages.find(p => p.field === 'interpretation');
      answer.claims[0].passage = p.ref;
    }
    if (failure === 'comparison without decision') answer.next_step.decision = { threshold: 'Compare review times.' };
    if (failure === 'empty measure') answer.next_step.measure = '';
    return { response: failure === 'malformed' ? 'not json' : answer };
  });
  expect((await handleRequest(request(), env)).status).toBe(502);
});
it('T05: model abstention is distinct from technical failure', async () => {
  const answer = { outcome: 'insufficient', summary: { text: 'The records do not measure cycle time.', citations: [] }, claims: [], uncertainties: ['Need comparable task cycle-time measurements.'], next_step: null };
  const response = await handleRequest(request(), fixtureEnv(async () => ({ response: answer })));
  expect(response.status).toBe(200);
  expect((await response.json()).answer).toEqual(answer);
});
it('bounds requests and does not retry a failing model', async () => {
  const run = vi.fn().mockRejectedValue(Error('upstream'));
  expect((await handleRequest(request(), fixtureEnv(run))).status).toBe(503);
  expect(run).toHaveBeenCalledTimes(1);
});
it('rate limits before loading records or inference', async () => {
  const run = vi.fn();
  const response = await handleRequest(request(), fixtureEnv(run, { ANSWER_RATE_LIMITER: { limit: async () => ({ success: false }) } }));
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('60');
  expect(run).not.toHaveBeenCalled();
});
it('disabled generation leaves retrieval available', async () => {
  const run = vi.fn();
  expect((await handleRequest(request(), fixtureEnv(run, { ANSWER_ENABLED: 'false' }))).status).toBe(503);
  expect(run).not.toHaveBeenCalled();
});
it('times out a stalled model without retrying it', async () => {
  vi.useFakeTimers();
  try {
    const run = vi.fn(() => new Promise(() => {}));
    const pending = handleRequest(request(), fixtureEnv(run));
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(25001);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'deadline_exceeded', stage: 'model', model_latency_ms: expect.any(Number), model_input_bytes: expect.any(Number), max_output_tokens: 1800 });
    expect(run).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
it('rejects oversized streamed request bodies', async () => {
  const run = vi.fn();
  const req = new Request('https://eae.test/api/search/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(5000) });
  expect((await handleRequest(req, fixtureEnv(run))).status).toBe(400);
  expect(run).not.toHaveBeenCalled();
});
it('does not start inference if a D1 read completes after the deadline', async () => {
  vi.useFakeTimers();
  try {
    let release;
    const run = vi.fn();
    const pendingRead = new Promise(resolve => { release = resolve; });
    const response = handleRequest(request(), fixtureEnv(run, { EVIDENCE_DB: { prepare: () => ({ bind: () => ({ first: () => pendingRead }) }) } }));
    await vi.advanceTimersByTimeAsync(25001);
    const timedOut = await response;
    expect(timedOut.status).toBe(503);
    expect(await timedOut.json()).toMatchObject({ code: 'deadline_exceeded', stage: 'evidence' });
    release(null);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
it('Pages answer bridge forwards POST body and preserves response status', async () => {
  const { onRequest } = await import('../../functions/api/search/answer.js');
  const req = request();
  const forwarded = vi.fn(async incoming => {
    expect(incoming).toBe(req);
    expect(await incoming.json()).toEqual({ query: 'Where should we focus?', record_ids: ['context'] });
    return Response.json({ error: 'limited' }, { status: 429 });
  });
  expect((await onRequest({ request: req, env: { SEARCH_API: { fetch: forwarded } } })).status).toBe(429);
  expect(forwarded).toHaveBeenCalledOnce();
});
it.each([
  ['provider_error', { AI: { run: async () => { throw Error('private provider detail'); } } }, 'model'],
  ['evidence_error', { EVIDENCE_DB: { prepare() { throw Error('private database detail'); } } }, 'evidence'],
  ['rate_limiter_error', { ANSWER_RATE_LIMITER: { limit: async () => { throw Error('private limiter detail'); } } }, 'rate_limit'],
  ['answer_disabled', { ANSWER_ENABLED: 'false' }, 'request'],
  ['configuration_error', { AI: null }, 'request'],
])('T06: exposes safe correlated diagnostics for %s', async (code, overrides, stage) => {
  const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const response = await handleRequest(request(), fixtureEnv(undefined, overrides));
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data).toMatchObject({ code, stage, request_id: response.headers.get('X-Request-ID'), latency_ms: expect.any(Number) });
    expect(data.request_id).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain('private');
    expect(logs).toHaveBeenCalledWith(expect.stringContaining(data.request_id));
    expect(JSON.stringify(logs.mock.calls)).not.toContain('private');
  } finally { logs.mockRestore(); }
});
it('T06: deadline includes stalled rate admission and reports its stage', async () => {
  vi.useFakeTimers();
  try {
    const run = vi.fn();
    const pending = handleRequest(request(), fixtureEnv(run, { ANSWER_RATE_LIMITER: { limit: () => new Promise(() => {}) } }));
    await vi.advanceTimersByTimeAsync(25001);
    expect(await (await pending).json()).toMatchObject({ code: 'deadline_exceeded', stage: 'rate_limit' });
    expect(run).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
it('T04: rejects unsupported observation paraphrase at the Worker boundary', async () => {
  const response = await handleRequest(request(), fixtureEnv(async (_model, input) => {
    const answer = answerFor(JSON.parse(input.messages[1].content).sources);
    answer.claims[0].text = 'Context guides improve engineering cycle time.';
    return { response: answer };
  }));
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ code: 'invalid_model_output', stage: 'validation' });
});
it.each([
  ['json_invalid', () => '{"private":'],
  ['schema_invalid', a => ({ ...a, private_extra_field: 'private value' })],
  ['citation_reference_unknown', a => { a.summary.citations[0] = 'unknown'; return a; }],
  ['schema_invalid', a => { a.claims[0].text = 'private paraphrase'; return a; }],
  ['decision_rule_invalid', a => { a.next_step.decision = { threshold: 'private comparison' }; return a; }],
  ['next_step_missing', a => { delete a.next_step; return a; }],
  ['abstention_invalid', a => ({ ...a, outcome: 'insufficient' })],
])('T06: reports %s with measurements, never rejected model content', async (reason, mutate) => {
  const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const response = await handleRequest(request(), fixtureEnv(async (_model, input) => ({
      response: mutate(answerFor(JSON.parse(input.messages[1].content).sources)),
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    })));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data).toMatchObject({
      validation_reason: reason, stage: 'validation', model_latency_ms: expect.any(Number),
      model_input_bytes: expect.any(Number), model_output_bytes: expect.any(Number),
      input_tokens: 100, output_tokens: 20, max_output_tokens: 1800,
    });
    expect(data.model_input_bytes).toBeGreaterThan(0);
    expect(data.model_output_bytes).toBeGreaterThan(0);
    expect(JSON.stringify([data, logs.mock.calls])).not.toContain('private');
    expect(data).not.toHaveProperty('validation_path');
  } finally { logs.mockRestore(); }
});
it('T05: returns a cited proposed experiment without claiming the question is settled', async () => {
  const { generatedUncertainAnswerFor: uncertainAnswerFor } = await import('./answer-fixtures.mjs');
  const response = await handleRequest(request(), fixtureEnv(async (_model, input) => ({
    response: uncertainAnswerFor(JSON.parse(input.messages[1].content).sources),
  })));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.answer).toMatchObject({ outcome: 'insufficient', claims: [], next_step: { measure: expect.any(String) } });
  expect(data.diagnostics.model_input_bytes).toBeGreaterThan(0);
  expect(data.diagnostics.model_output_bytes).toBeGreaterThan(0);
  expect(data.diagnostics).not.toHaveProperty('input_tokens');
});
it.each([
  ['summary_citations_missing', a => { a.summary.citations = []; }],
  ['claims_missing', a => { a.claims = []; }],
  ['next_step_missing', a => { delete a.next_step; }],
])('T06: identifies the missing answer component: %s', async (reason, mutate) => {
  const response = await handleRequest(request(), fixtureEnv(async (_model, input) => {
    const answer = answerFor(JSON.parse(input.messages[1].content).sources);
    mutate(answer);
    return { response: answer };
  }));
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ validation_reason: reason });
});
it('pinned evidence is checked before inference and never substituted with client content', async () => {
  const { sources } = await (await handleRequest(request(), fixtureEnv())).json();
  const run = vi.fn(async (_model, input) => ({ response: answerFor(JSON.parse(input.messages[1].content).sources) }));
  const body = { query: 'Q', record_ids: ['context'], snapshot_ids: [sources[0].snapshot_id] };
  expect((await handleRequest(request(body), fixtureEnv(run))).status).toBe(200);
  run.mockClear();
  for (const changed of [
    { ...body, snapshot_ids: ['0'.repeat(64)] },
    { ...body, record_ids: ['missing'] },
  ]) {
    const response = await handleRequest(request(changed), fixtureEnv(run));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'evidence_snapshot_changed', stage: 'evidence' });
  }
  for (const snapshot_ids of [[], ['bad'], null]) {
    expect((await handleRequest(request({ ...body, snapshot_ids }), fixtureEnv(run))).status).toBe(400);
  }
  expect(run).not.toHaveBeenCalled();
});
it.each([
  ['uncertainties', a => { a.uncertainties = ['s1p14', 's1p16', 's1p19']; }],
  ['summary', a => { a.summary.text = 'See s1p1 for the finding'; }],
  ['interpretation', a => { a.claims = [{ kind: 'interpretation', text: 's1p1 supports this', citations: ['s1p1'] }]; }],
  ['experiment', a => { a.next_step.comparison = 'Compare with s1p1'; }],
])('T06: rejects internal references in generated %s before display', async (_field, mutate) => {
  const response = await handleRequest(request(), fixtureEnv(async (_model, input) => {
    const a = answerFor(JSON.parse(input.messages[1].content).sources); mutate(a); return { response: a };
  }));
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ validation_reason: 'reference_in_prose' });
});
it('T04: distinguishes an unknown reference from an invalid observation field', async () => {
  for (const [ref, reason] of [['s9p99', 'citation_reference_unknown'], ['s1p2', 'observation_field_invalid']]) {
    const response = await handleRequest(request(), fixtureEnv(async (_model, input) => {
      const a = answerFor(JSON.parse(input.messages[1].content).sources); a.claims[0].passage = ref; return { response: a };
    }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ validation_reason: reason });
  }
});
it.each(['scope', 'intervention', 'comparison', 'measurement', 'threshold'])('T06: rejects incomplete experiment %s', async field => {
  const response = await handleRequest(request(), fixtureEnv(async (_model, input) => {
    const a = answerFor(JSON.parse(input.messages[1].content).sources);
    if (field === 'threshold') delete a.next_step.decision.threshold;
    else delete a.next_step[field];
    return { response: a };
  }));
  expect(response.status).toBe(502);
});

it.each([
  ['experiment_comparison_undefined', a => { a.next_step.comparison = 'baseline or comparison group'; }],
  ['experiment_guardrail_undefined', a => { a.next_step.measurement.guardrail = 'review quality'; }],
])('A-v4: rejects an undefined experiment with %s before exposing an answer', async (reason, mutate) => {
  const env = fixtureEnv(async (_model, input) => {
    const answer = answerFor(JSON.parse(input.messages[1].content).sources);
    mutate(answer);
    return { response: answer };
  });
  const response = await handleRequest(request({ query: 'What changes?', record_ids: ['context'] }), env);
  expect(response.status).toBe(502);
  const body = await response.json();
  expect(body.validation_reason).toBe(reason);
  expect(body).not.toHaveProperty('answer');
});
