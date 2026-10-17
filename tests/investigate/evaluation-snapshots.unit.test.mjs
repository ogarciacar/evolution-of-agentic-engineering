import { expect, it, vi } from 'vitest';
import { pinnedCases } from '../../workers/ai-search/evaluation-snapshots.mjs';
import { ANSWER_CASES } from '../../workers/ai-search/answer-rubric.mjs';
import { evaluateQuestion } from '../../workers/ai-search/evaluation-case.mjs';
const report = () => ({ results: ANSWER_CASES.map(c => ({ question: c.question, data: { sources: [{ record_id: 'context', snapshot_id: 'a'.repeat(64), text: 'Never send this text' }] } })) });
it('requires complete unique cases and canonical snapshot identities before a paid run', () => {
  expect(Object.keys(pinnedCases(report()))).toHaveLength(6);
  for (const mutate of [r => r.results.pop(), r => { r.results[1] = r.results[0]; }, r => { delete r.results[0].data; }, r => { r.results[0].data.sources[0].snapshot_id = 'invalid'; }]) {
    const broken = report(); mutate(broken);
    expect(() => pinnedCases(broken)).toThrow();
  }
});
it('bypasses retrieval for pinned evaluation and preserves snapshot mismatch diagnostics', async () => {
  const pinned = pinnedCases(report())[ANSWER_CASES[0].id];
  const transport = vi.fn(async (url, init) => {
    expect(url.pathname).toBe('/api/search/answer');
    expect(JSON.parse(init.body)).toEqual({ query: ANSWER_CASES[0].question, ...pinned });
    return Response.json({ code: 'evidence_snapshot_changed', stage: 'evidence' }, { status: 409 });
  });
  const result = await evaluateQuestion(new URL('https://example.com'), ANSWER_CASES[0].question, false, transport, pinned);
  expect(transport).toHaveBeenCalledOnce();
  expect(result).toMatchObject({ contract: 'fail', status: 409, diagnostic: { code: 'evidence_snapshot_changed' } });
});
