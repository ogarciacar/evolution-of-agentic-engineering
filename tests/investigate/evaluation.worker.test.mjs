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
