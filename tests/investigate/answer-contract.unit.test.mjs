import { expect, it } from 'vitest';
import { canonicalSources, validateAnswer, ANSWER_LIMITS } from '../../workers/ai-search/answer.js';
import { record, answerFor } from './answer-fixtures.mjs';
it('snapshot identity changes with canonical metadata; unchanged passage identities remain stable', async () => {
  const first = (await canonicalSources([record])).sources[0];
  const changed = (await canonicalSources([{ ...record, source: { ...record.source, date: '2026-10-01' } }])).sources[0];
  expect(changed.snapshot_id).not.toBe(first.snapshot_id);
  expect(changed.passages).toEqual(first.passages);
  expect(first.passages[0].text).toBe(record.observed[0]);
});
it('omits whole oversized or boundary-free records instead of dropping limitations', async () => {
  const data = await canonicalSources([{ ...record, observed: ['x'.repeat(ANSWER_LIMITS.recordBytes)] }, { ...record, what_this_does_not_establish: [] }, null]);
  expect(data).toEqual({ sources: [], omitted: 3 });
});
it('requires references on conclusions and rejects extra model fields', async () => {
  const { sources } = await canonicalSources([record]);
  const answer = answerFor(sources);
  expect(validateAnswer(answer, sources)).toBe(answer);
  expect(() => validateAnswer({ ...answer, confidence: 100 }, sources)).toThrow();
  expect(() => validateAnswer({ ...answer, summary: { text: 'Unsupported claim', citations: [] } }, sources)).toThrow();
});
it('cannot use a valid quote from one record to cite another', async () => {
  const { sources } = await canonicalSources([record, { ...record, id: 'other', observed: ['A different report.'] }]);
  const answer = answerFor(sources);
  answer.summary.citations[0].source_id = sources[1].id;
  expect(() => validateAnswer(answer, sources)).toThrow();
});
it('rejects the live human-review paraphrase even with an authentic quote', async () => {
  const observed = 'OpenAI states that as automation progresses, the least automatable tasks will take a larger share of researcher effort and become important bottlenecks, and that compute is another gating factor that may become more important over time.';
  const { sources } = await canonicalSources([{ ...record, observed: [observed] }]);
  const answer = answerFor(sources);
  answer.claims[0].text = 'Human review becomes the bottleneck as automation progresses and the least automatable tasks take a larger share of researcher effort.';
  expect(() => validateAnswer(answer, sources)).toThrow('complete attributed passage');
  answer.claims[0].text = observed;
  expect(validateAnswer(answer, sources)).toBe(answer);
});
it('rejects a comparison without a decision and accepts conditional alternative actions', async () => {
  const { sources } = await canonicalSources([record]);
  const answer = answerFor(sources);
  answer.next_step.decision_rule = 'Compare the time spent on human review for tasks with high and low automatability';
  expect(() => validateAnswer(answer, sources)).toThrow('alternative actions');
});
it('permits a cited experiment under uncertainty but rejects unsupported or incomplete proposals', async () => {
  const { uncertainAnswerFor } = await import('./answer-fixtures.mjs');
  const { sources } = await canonicalSources([record]);
  const answer = uncertainAnswerFor(sources);
  expect(validateAnswer(answer, sources)).toBe(answer);
  for (const mutate of [
    a => { a.next_step.citations = []; },
    a => { a.summary.citations = []; },
    a => { a.next_step.measure = ''; },
    a => { a.next_step.decision_rule = 'Compare the results'; },
    a => { a.next_step.citations[0].quote = 'Invented finding'; },
    a => { a.claims = answerFor(sources).claims; },
  ]) {
    const broken = structuredClone(answer);
    mutate(broken);
    expect(() => validateAnswer(broken, sources)).toThrow();
  }
});
it('assembles a decision from required fields without requiring model punctuation', async () => {
  const { finalizeGeneratedAnswer } = await import('../../workers/ai-search/answer.js');
  const { generatedAnswerFor } = await import('./answer-fixtures.mjs');
  const { sources } = await canonicalSources([record]);
  const generated = generatedAnswerFor(sources);
  generated.next_step.decision = { condition: 'review time\nfalls', if_true: 'continue the trial', if_false: 'stop and investigate' };
  const answer = finalizeGeneratedAnswer(generated, sources);
  expect(answer.next_step.decision_rule).toBe('If review time falls, continue the trial; otherwise stop and investigate');
  expect(answer.next_step).not.toHaveProperty('decision');
  expect(generated.next_step).not.toHaveProperty('decision_rule');
  for (const field of ['condition', 'if_true', 'if_false']) {
    const incomplete = structuredClone(generated);
    delete incomplete.next_step.decision[field];
    expect(() => finalizeGeneratedAnswer(incomplete, sources)).toThrow('both actions');
    incomplete.next_step.decision[field] = ' ';
    expect(() => finalizeGeneratedAnswer(incomplete, sources)).toThrow('both actions');
  }
});
it('encodes mutually exclusive outcome requirements in the generation schema', async () => {
  const { GENERATION_SCHEMA, finalizeGeneratedAnswer } = await import('../../workers/ai-search/answer.js');
  const { generatedAnswerFor } = await import('./answer-fixtures.mjs');
  const [answered, insufficient] = GENERATION_SCHEMA.anyOf.map(s => s.properties);
  expect(answered.outcome.enum).toEqual(['answered']);
  expect(answered.claims.minItems).toBe(1);
  expect(answered.summary.properties.citations.minItems).toBe(1);
  expect(answered.next_step.required).toContain('decision');
  expect(insufficient.outcome.enum).toEqual(['insufficient']);
  expect(insufficient.claims.maxItems).toBe(0);
  const { sources } = await canonicalSources([record]);
  const invalid = { ...generatedAnswerFor(sources), outcome: 'insufficient' };
  expect(() => finalizeGeneratedAnswer(invalid, sources)).toThrow('Invalid abstention');
});
