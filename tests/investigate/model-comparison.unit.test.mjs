import { expect, it, vi } from 'vitest';
import { normalizeCandidateOutput } from '../../workers/ai-search/evaluation-models.mjs';
import { compareModels } from '../../workers/ai-search/model-comparison.mjs';
import { ANSWER_CASES } from '../../workers/ai-search/answer-rubric.mjs';

it('reads final answer formats and normalizes usage without exposing reasoning', () => {
  const response = '{"outcome":"insufficient"}';
  expect(normalizeCandidateOutput({ response }).response).toBe(response);
  const result = normalizeCandidateOutput({ output: [{ type: 'reasoning', text: 'private reasoning' }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: response }] }], usage: { input_tokens: 100, output_tokens: 20 } });
  expect(result).toEqual({ response, usage: { prompt_tokens: 100, completion_tokens: 20 } });
  expect(JSON.stringify(result)).not.toContain('private');
});
it.each([
  { choices: [{ finish_reason: 'length', message: { role: 'assistant', content: '{}' } }] },
  { choices: [{ finish_reason: 'stop', message: { role: 'assistant', reasoning_content: '{}' } }] },
  { status: 'incomplete', response: '{}' },
  { output: [{ type: 'reasoning', text: '{}' }] },
  { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{}', refusal: 'refused' } }] },
])('does not treat incomplete/refused/reasoning-only content as a final answer (%#)', value => {
  expect(normalizeCandidateOutput(value).response ?? null).toBeNull();
});
it('runs twelve pinned requests with alternating order and detects an old Worker ignoring selection', async () => {
  const snapshots = Object.fromEntries(ANSWER_CASES.map(c => [c.id, { record_ids: ['context'], snapshot_ids: ['a'.repeat(64)] }]));
  const keys = [];
  const transport = vi.fn(async (url, init) => {
    expect(new URL(url).pathname).toBe('/api/search/answer');
    expect(JSON.parse(init.body).snapshot_ids).toEqual(['a'.repeat(64)]);
    keys.push(init.headers['X-EAE-Evaluation-Model']);
    return Response.json({ code: 'invalid_model_output', model_key: 'llama', generation_input_sha256: 'b'.repeat(64) }, { status: 502 });
  });
  const { reports, comparison } = await compareModels('https://example.com', snapshots, transport);
  expect(transport).toHaveBeenCalledTimes(12);
  expect(keys.slice(0, 4)).toEqual(['llama', 'gpt-oss', 'gpt-oss', 'llama']);
  expect(reports.llama.results).toHaveLength(6);
  expect(reports['gpt-oss'].results).toHaveLength(6);
  expect(comparison.pairs.every(p => p.same_input && !p.models_confirmed && !p.contracts_pass)).toBe(true);
});
it('refuses incomplete pins before any model request', async () => {
  const transport = vi.fn();
  await expect(compareModels('https://example.com', {}, transport)).rejects.toThrow('All six');
  expect(transport).not.toHaveBeenCalled();
});
it('accepts a matched pair only when both models and input identities are confirmed', async () => {
  const { canonicalSources } = await import('../../workers/ai-search/answer.js');
  const { record, answerFor } = await import('./answer-fixtures.mjs');
  const { sources } = await canonicalSources([record]);
  const snapshots = Object.fromEntries(ANSWER_CASES.map(c => [c.id, { record_ids: [record.id], snapshot_ids: [sources[0].snapshot_id] }]));
  let mismatch = false;
  const transport = async (_url, init) => {
    const key = init.headers['X-EAE-Evaluation-Model'];
    const weather = JSON.parse(init.body).query === ANSWER_CASES.at(-1).question;
    const answer = weather ? { outcome: 'insufficient', summary: { text: 'No weather evidence', citations: [] }, claims: [], uncertainties: ['Need weather data'], next_step: null } : answerFor(sources);
    return Response.json({ sources, answer, diagnostics: { model_key: key, generation_input_sha256: mismatch && key === 'gpt-oss' ? 'c'.repeat(64) : 'b'.repeat(64) } });
  };
  expect((await compareModels('https://example.com', snapshots, transport)).comparison.pairs.every(p => p.same_input && p.models_confirmed && p.contracts_pass)).toBe(true);
  mismatch = true;
  expect((await compareModels('https://example.com', snapshots, transport)).comparison.pairs.every(p => !p.same_input)).toBe(true);
});
