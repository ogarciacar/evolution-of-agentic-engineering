import { expect, it, vi } from 'vitest';
import { handleRequest } from '../../workers/ai-search/index.js';
import { answerFor, fixtureEnv, record } from './answer-fixtures.mjs';
const request = (body = { query: 'Where should we focus?', record_ids: ['context'] }) => new Request('https://agenticengineering.science/api/search/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
it('T03/T04: answers using canonical records and returns inspectable citations and a measurable next step', async () => {
  const run = vi.fn(async (_model, input) => ({ response: answerFor(JSON.parse(input.messages[1].content).sources) }));
  const response = await handleRequest(request(), fixtureEnv(run));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toMatchObject({ version: 1, provenance: 'canonical_eae_records', answer: { outcome: 'answered' } });
  expect(data.sources[0].original).toEqual(record.source);
  expect(data.answer.next_step.measure).toBeTruthy();
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
it.each(['unknown citation', 'invented quote', 'interpretation as observation', 'empty measure', 'malformed'])('rejects unsafe model output: %s', async failure => {
  const env = fixtureEnv(async (_model, input) => {
    const sources = JSON.parse(input.messages[1].content).sources;
    const answer = answerFor(sources);
    if (failure === 'unknown citation') answer.claims[0].citations[0].passage_id = 'invented';
    if (failure === 'invented quote') answer.claims[0].citations[0].quote = 'A measured 90% improvement.';
    if (failure === 'interpretation as observation') {
      const p = sources[0].passages.find(p => p.field === 'interpretation');
      answer.claims[0].citations = [{ source_id: sources[0].id, passage_id: p.id, quote: p.text }];
    }
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
    expect((await pending).status).toBe(503);
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
    expect((await response).status).toBe(503);
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
