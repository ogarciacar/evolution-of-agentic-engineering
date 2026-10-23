import { expect, it, vi } from 'vitest';
import { handleEvaluation } from '../../workers/ai-search/evaluation-worker.js';
import { fixtureEnv } from './answer-fixtures.mjs';
import { generatedAnswerFor } from './answer-fixtures.mjs';
import { evaluateQuestion } from '../../workers/ai-search/evaluation-case.mjs';
const token = 'test-evaluation-token-with-at-least-32-characters';
it.each(['summary', 'claims[0]', 'claims[3]', 'next_step'])('E10: identifies missing observed support at %s through the Worker and report', async path => {
  const run = vi.fn(async (_model, input) => {
    const sources = JSON.parse(input.messages[1].content).sources;
    const answer = generatedAnswerFor(sources);
    const ref = sources[0].passages.find(p => p.field === 'interpretation').ref;
    if (path.startsWith('claims')) {
      const index = Number(path[7]);
      answer.claims = Array.from({ length: index + 1 }, () => ({ ...answer.claims[0] }));
      answer.claims[index] = { kind: 'interpretation', text: 'private rejected claim', citations: [ref] };
    } else answer[path].citations = [ref];
    answer.summary.text = 'private rejected summary';
    return { response: answer };
  });
  const env = fixtureEnv(run, { EVALUATION_TOKEN: token });
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const transport = (url, init) => handleEvaluation(new Request(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }), env);
    const result = await evaluateQuestion('https://evaluation.test', 'Q', false, transport, { record_ids: ['context'] });
    expect(result).toMatchObject({ contract: 'fail', status: 502, diagnostic: { validation_reason: 'observed_evidence_missing', validation_path: path, answer_contract: 'evidence_first_v8', prompt_revision: 'evidence_first_v8' } });
    expect(result).not.toHaveProperty('data');
    const entries = log.mock.calls.map(([entry]) => JSON.parse(entry));
    expect(entries).toContainEqual(expect.objectContaining({ validation_path: path, request_id: result.request_id }));
    expect(JSON.stringify([result, entries])).not.toContain('private rejected');
    expect(run).toHaveBeenCalledOnce();
  } finally { log.mockRestore(); }
});
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
it.each(['complete', 'missing effort', 'missing quality condition', 'absolute threshold', 'unknown stage', 'unresolved citation', 'open question only'])('E11: structured diagnosis %s through authenticated Worker and evaluation report', async kind => {
  const { diagnosisFor } = await import('./answer-fixtures.mjs');
  const run = vi.fn(async (_model, input) => {
    const sources = JSON.parse(input.messages[1].content).sources;
    const answer = generatedAnswerFor(sources, true);
    answer.next_step = diagnosisFor();
    const step = answer.next_step;
    if (kind === 'missing effort') delete step.active_effort;
    if (kind === 'missing quality condition') delete step.guardrail.acceptance;
    if (kind === 'absolute threshold') step.decision.threshold = '30 minutes';
    if (kind === 'unknown stage') step.decision.focus_stage = 'private stage';
    if (kind === 'unresolved citation') step.citations = ['s9p9'];
    if (kind === 'open question only') step.citations = [sources[0].passages.find(p => p.field === 'open_question').ref];
    return { response: answer };
  });
  const env = fixtureEnv(run, { EVALUATION_TOKEN: token });
  const transport = (url, init) => handleEvaluation(new Request(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }), env);
  const result = await evaluateQuestion('https://evaluation.test', 'Where is the workflow bottleneck?', false, transport, { record_ids: ['context'] });
  if (kind === 'complete') {
    expect(result.contract).toBe('pass');
    expect(result.data.answer.next_step.action).toContain('Proposed diagnosis');
    expect(result.data.answer.next_step.measure).toContain('active minutes');
    expect(result.data.answer.next_step.decision_rule).toContain('all pass');
    expect(result.data.diagnostics.answer_contract).toBe('evidence_first_v8');
  } else {
    expect(result).toMatchObject({ contract: 'fail', status: 502 });
    expect(result).not.toHaveProperty('data');
    const reason = { 'unknown stage': 'diagnosis_stage_invalid', 'unresolved citation': 'citation_reference_unknown', 'open question only': 'observed_evidence_missing' }[kind] || 'diagnosis_incomplete';
    expect(result.diagnostic.validation_reason).toBe(reason);
    if (kind !== 'unresolved citation') expect(result.diagnostic.validation_path).toBe('next_step');
    expect(JSON.stringify(result)).not.toContain('private stage');
  }
  expect(run).toHaveBeenCalledOnce();
});
it('E12: a cited answer without an experiment survives authenticated evaluation', async () => {
  const run = vi.fn(async (_model, input) => {
    const answer = generatedAnswerFor(JSON.parse(input.messages[1].content).sources);
    answer.next_step = null;
    return { response: answer };
  });
  const env = fixtureEnv(run, { EVALUATION_TOKEN: token });
  const transport = (url, init) => handleEvaluation(new Request(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }), env);
  const result = await evaluateQuestion('https://evaluation.test', 'What practices are reported?', false, transport, { record_ids: ['context'] });
  expect(result.contract).toBe('pass');
  expect(result.data.answer).toMatchObject({ outcome: 'answered', next_step: null });
  expect(result.data.answer.claims).toHaveLength(1);
  expect(result.data.diagnostics).toMatchObject({ answer_contract: 'evidence_first_v8', prompt_revision: 'evidence_first_v8' });
  expect(result.human_review.decision).toBe('unreviewed');
  expect(run).toHaveBeenCalledOnce();
});
