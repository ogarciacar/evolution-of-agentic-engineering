import { expect, it, vi } from 'vitest';
import { evaluateQuestion } from '../../workers/ai-search/evaluation-case.mjs';
const retrieval = () => Response.json({ answer_available: true, evidence: { sources: [{ record_id: 'context' }] } });
it('retains status, request ID, stage and timing on failed live cases without private error bodies', async () => {
  const transport = vi.fn().mockResolvedValueOnce(retrieval()).mockResolvedValueOnce(Response.json({ code: 'deadline_exceeded', stage: 'model', latency_ms: 25000, error: 'private details' }, { status: 503, headers: { 'X-Request-ID': 'test-id' } }));
  const result = await evaluateQuestion('https://eae.test', 'Q', false, transport);
  expect(result).toMatchObject({ contract: 'fail', status: 503, stage: 'answer', request_id: 'test-id', latency_ms: expect.any(Number), diagnostic: { code: 'deadline_exceeded', stage: 'model', latency_ms: 25000 } });
  expect(JSON.stringify(result)).not.toContain('private details');
});
it('records non-JSON gateway errors and transport timeouts', async () => {
  const gateway = await evaluateQuestion('https://eae.test', 'Q', false, async () => new Response('gateway', { status: 502 }));
  expect(gateway).toMatchObject({ contract: 'fail', stage: 'retrieval', status: 502 });
  const timeout = await evaluateQuestion('https://eae.test', 'Q', false, async () => { throw new DOMException('Timeout', 'TimeoutError'); });
  expect(timeout).toMatchObject({ contract: 'fail', status: null, latency_ms: expect.any(Number), error: 'Timeout' });
});
it('keeps expected abstention separate from pending human review', async () => {
  const data = { answer: { outcome: 'insufficient', summary: { text: 'No weather evidence.', citations: [] }, claims: [], uncertainties: ['Need weather data.'], next_step: null }, sources: [] };
  const transport = vi.fn().mockResolvedValueOnce(retrieval()).mockResolvedValueOnce(Response.json(data, { headers: { 'X-Request-ID': 'abstention-id' } }));
  const result = await evaluateQuestion('https://eae.test', 'Weather?', true, transport);
  expect(result).toMatchObject({ contract: 'pass', abstention_pass: true, request_id: 'abstention-id', human_review: { decision: 'unreviewed', claims_supported: null } });
});
it('retains validation reason and generation measurements for a rejected answer', async () => {
  const transport = vi.fn().mockResolvedValueOnce(retrieval()).mockResolvedValueOnce(Response.json({
    answer_contract: 'structured_decision_v1', prompt_revision: 'bounded_evidence_v1', code: 'invalid_model_output', stage: 'validation', validation_reason: 'observation_not_verbatim',
    model_input_bytes: 8000, model_output_bytes: 900, model_latency_ms: 21000,
    input_tokens: 2000, output_tokens: 225, max_output_tokens: 1800,
    response: 'private model output',
  }, { status: 502 }));
  const result = await evaluateQuestion('https://eae.test', 'Q', false, transport);
  expect(result.diagnostic).toMatchObject({ answer_contract: 'structured_decision_v1', prompt_revision: 'bounded_evidence_v1', validation_reason: 'observation_not_verbatim', model_input_bytes: 8000, model_output_bytes: 900, model_latency_ms: 21000, input_tokens: 2000, output_tokens: 225, max_output_tokens: 1800 });
  expect(JSON.stringify(result)).not.toContain('private');
});
it('does not count an unrelated question with an experiment as a correct abstention', async () => {
  const { canonicalSources } = await import('../../workers/ai-search/answer.js');
  const { record, uncertainAnswerFor } = await import('./answer-fixtures.mjs');
  const { sources } = await canonicalSources([record]);
  const transport = vi.fn().mockResolvedValueOnce(retrieval()).mockResolvedValueOnce(Response.json({ sources, answer: uncertainAnswerFor(sources) }));
  expect(await evaluateQuestion('https://eae.test', 'Weather?', true, transport)).toMatchObject({ contract: 'pass', abstention_pass: false });
});
