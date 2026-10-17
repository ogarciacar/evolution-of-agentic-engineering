import { expect, it, vi } from 'vitest';
import { handleEvaluation } from '../../workers/ai-search/evaluation-worker.js';
import { fixtureEnv } from './answer-fixtures.mjs';
const token = 'test-evaluation-token-with-at-least-32-characters';
const request = (authorization = `Bearer ${token}`) => new Request('https://evaluation.test/api/search/answer', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'Where should we focus?', record_ids: ['context'] }) });
it.each([undefined, '', 'short'])('E01: missing or invalid secret blocks all work (%s)', async secret => {
  const run = vi.fn();
  const env = fixtureEnv(run, { EVALUATION_TOKEN: secret });
  const db = vi.spyOn(env.EVIDENCE_DB, 'prepare');
  expect((await handleEvaluation(request(), env)).status).toBe(503);
  expect(run).not.toHaveBeenCalled(); expect(db).not.toHaveBeenCalled();
});
it.each(['', 'Bearer wrong', `Basic ${token}`])('E02: unauthorized requests cannot reach evidence or inference', async authorization => {
  const run = vi.fn();
  const env = fixtureEnv(run, { EVALUATION_TOKEN: token });
  const db = vi.spyOn(env.EVIDENCE_DB, 'prepare');
  expect((await handleEvaluation(request(authorization), env)).status).toBe(401);
  expect(run).not.toHaveBeenCalled(); expect(db).not.toHaveBeenCalled();
});
it('E03: authorized evaluation uses the real answer handler', async () => {
  const response = await handleEvaluation(request(), fixtureEnv(undefined, { EVALUATION_TOKEN: token }));
  expect(response.status).toBe(200);
  expect((await response.json()).answer.outcome).toBe('answered');
});
it('E04: authorization does not override the answer kill switch', async () => {
  const run = vi.fn();
  const response = await handleEvaluation(request(), fixtureEnv(run, { EVALUATION_TOKEN: token, ANSWER_ENABLED: 'false' }));
  expect((await response.json()).code).toBe('answer_disabled');
  expect(run).not.toHaveBeenCalled();
});
it('E05: the evaluation runner retrieves evidence then generates through the protected endpoint', async () => {
  const { evaluateQuestion } = await import('../../workers/ai-search/evaluation-case.mjs');
  const { evaluationTransport } = await import('../../workers/ai-search/evaluation-transport.mjs');
  const env = fixtureEnv(undefined, { EVALUATION_TOKEN: token, AI_SEARCH: { get: () => ({ search: async () => ({ chunks: [{ item: { key: '/signals/context/', metadata: { title: 'Context evidence' } }, text: 'Indexed evidence.' }] }) }) } });
  const base = 'https://agentic-engineering-search-evaluation.example.workers.dev';
  const transport = evaluationTransport(base, token, (url, options) => handleEvaluation(new Request(url, options), env));
  const result = await evaluateQuestion(base, 'Where should we focus?', false, transport);
  expect(result, JSON.stringify(result)).toMatchObject({ contract: 'pass', data: { answer: { outcome: 'answered' } }, human_review: { decision: 'unreviewed' } });
});
it('E06: authenticated model selection changes inference only and reports the actual model', async () => {
  const { generatedAnswerFor } = await import('./answer-fixtures.mjs');
  const { ANSWER_MODEL } = await import('../../workers/ai-search/answer.js');
  const { handleRequest } = await import('../../workers/ai-search/index.js');
  const inputs = [];
  const run = vi.fn(async (model, input) => {
    inputs.push(input);
    const response = generatedAnswerFor(JSON.parse(input.messages[1].content).sources);
    return model === ANSWER_MODEL ? { response } : { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(response) } }], usage: { prompt_tokens: 100, completion_tokens: 80 } };
  });
  const env = fixtureEnv(run, { EVALUATION_TOKEN: token });
  const candidateRequest = () => { const req = request(); req.headers.set('X-EAE-Evaluation-Model', 'gpt-oss'); return req; };
  const candidate = await (await handleEvaluation(candidateRequest(), env)).json();
  const baseline = await (await handleEvaluation(request(), env)).json();
  expect(candidate.model).toBe('@cf/openai/gpt-oss-120b');
  expect(baseline.model).toBe(ANSWER_MODEL);
  expect(candidate.answer).toEqual(baseline.answer);
  expect(candidate.diagnostics).toMatchObject({ model_key: 'gpt-oss', input_tokens: 100, output_tokens: 80 });
  expect(candidate.diagnostics.generation_input_sha256).toBe(baseline.diagnostics.generation_input_sha256);
  expect(inputs[0]).toEqual(inputs[1]);
  // Production never reads the selection header, even with evaluation credentials.
  await handleRequest(candidateRequest(), env);
  expect(run.mock.calls.at(-1)[0]).toBe(ANSWER_MODEL);
});
it('E07: unknown models and unauthorized selection cannot invoke inference', async () => {
  const run = vi.fn(); const env = fixtureEnv(run, { EVALUATION_TOKEN: token });
  const invalid = request(); invalid.headers.set('X-EAE-Evaluation-Model', 'arbitrary-model');
  expect((await handleEvaluation(invalid, env)).status).toBe(400);
  const unauthorized = request('Bearer wrong'); unauthorized.headers.set('X-EAE-Evaluation-Model', 'gpt-oss');
  expect((await handleEvaluation(unauthorized, env)).status).toBe(401);
  const disabled = request(); disabled.headers.set('X-EAE-Evaluation-Model', 'gpt-oss');
  expect((await handleEvaluation(disabled, { ...env, ANSWER_ENABLED: 'false' })).status).toBe(503);
  expect(run).not.toHaveBeenCalled();
});
it('E08: model selection is limited to answer requests and preserves rate admission', async () => {
  const run = vi.fn();
  const env = fixtureEnv(run, { EVALUATION_TOKEN: token });
  const wrongRoute = new Request('https://evaluation.test/api/search?q=test', { headers: { Authorization: `Bearer ${token}`, 'X-EAE-Evaluation-Model': 'gpt-oss' } });
  expect((await handleEvaluation(wrongRoute, env)).status).toBe(400);
  const req = request(); req.headers.set('X-EAE-Evaluation-Model', 'gpt-oss');
  const response = await handleEvaluation(req, { ...env, ANSWER_RATE_LIMITER: { limit: async () => ({ success: false }) } });
  expect(response.status).toBe(429);
  expect(run).not.toHaveBeenCalled();
});
it('E09: provider failure diagnostics survive the evaluation report without leaking exception content', async () => {
  const { evaluateQuestion } = await import('../../workers/ai-search/evaluation-case.mjs');
  const error = Object.assign(new Error('3036: secret prompt and token'), { status: 429 });
  const env = fixtureEnv(vi.fn().mockRejectedValue(error), { EVALUATION_TOKEN: token });
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const transport = (url, init) => handleEvaluation(new Request(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }), env);
    const result = await evaluateQuestion('https://evaluation.test', 'Where should we focus?', false, transport, { record_ids: ['context'] });
    expect(result.status).toBe(503);
    expect(result.diagnostic).toMatchObject({ code: 'provider_error', provider_error_category: 'quota_exceeded', provider_error_code: 3036, provider_http_status: 429 });
    expect(JSON.stringify([result, log.mock.calls])).not.toContain('secret prompt');
  } finally { log.mockRestore(); }
});
