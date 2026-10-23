import { expect, it } from 'vitest';
import { canonicalSources, finalizeGeneratedAnswer } from '../../workers/ai-search/answer.js';
import { diagnosisFor, generatedAnswerFor, record } from './answer-fixtures.mjs';
async function fixture() {
  const { sources } = await canonicalSources([record]);
  const generated = generatedAnswerFor(sources, true);
  generated.next_step = diagnosisFor();
  return { sources, generated };
}
it('renders a bounded diagnosis with waiting, effort, flow, overlap and guarded relative decision', async () => {
  const { sources, generated } = await fixture();
  const answer = finalizeGeneratedAnswer(generated, sources);
  expect(answer.next_step.action).toContain('proposed sample: 20');
  expect(answer.next_step.action).toContain('review queue (waiting)');
  expect(answer.next_step.measure).toContain('active minutes: human review');
  expect(answer.next_step.measure).toContain('changes: arrivals');
  expect(answer.next_step.measure).toContain('Record overlaps separately; do not sum');
  expect(answer.next_step.decision_rule).toContain('largest median elapsed time');
  expect(answer.next_step.decision_rule).toContain('all pass; required approvals retained');
  expect(answer.next_step).not.toHaveProperty('mode');
});
it.each(['sample', 'window', 'stages', 'active_effort', 'flow', 'overlap', 'guardrail', 'decision'])('rejects missing diagnosis %s', async field => {
  const { sources, generated } = await fixture(); delete generated.next_step[field];
  expect(() => finalizeGeneratedAnswer(generated, sources)).toThrow();
});
it.each([0, -1, 1.5, 101, '20'])('rejects non-bounded or nonnumeric sample %s', async count => {
  const { sources, generated } = await fixture(); generated.next_step.sample.count = count;
  expect(() => finalizeGeneratedAnswer(generated, sources)).toThrow();
});
it.each(['threshold', 'unknown stage', 'duplicate stage', 'no waiting', 'same endpoints', 'missing acceptance'])('rejects %s', async kind => {
  const { sources, generated } = await fixture(); const s = generated.next_step;
  if (kind === 'threshold') s.decision.threshold = '30 minutes';
  if (kind === 'unknown stage') s.decision.focus_stage = 'unknown';
  if (kind === 'duplicate stage') s.stages[1].name = s.stages[0].name;
  if (kind === 'no waiting') s.stages[0].kind = 'processing';
  if (kind === 'same endpoints') s.stages[0].end = s.stages[0].start;
  if (kind === 'missing acceptance') delete s.guardrail.acceptance;
  expect(() => finalizeGeneratedAnswer(generated, sources)).toThrow();
});
it('renders maximum-length diagnosis fields within public limits', async () => {
  const { DIAGNOSIS_SCHEMA } = await import('../../workers/ai-search/diagnosis.js');
  const { sources, generated } = await fixture();
  function maximum(value, schema) {
    if (schema.type === 'string') return schema.enum ? value : 'x'.repeat(schema.maxLength);
    if (schema.type === 'integer') return schema.maximum;
    if (schema.type === 'array') return Array.from({ length: schema.maxItems }, () => maximum(value[0], schema.items));
    return Object.fromEntries(Object.entries(schema.properties).map(([k, spec]) => [k, maximum(value[k], spec)]));
  }
  const s = maximum(generated.next_step, DIAGNOSIS_SCHEMA);
  s.citations = ['s1p1'];
  s.stages.forEach((stage, i) => { stage.name = String(i).repeat(20); stage.end = 'y'.repeat(35); stage.kind = i ? 'processing' : 'waiting'; });
  s.decision.focus_stage = s.stages[0].name;
  generated.next_step = s;
  const { next_step } = finalizeGeneratedAnswer(generated, sources);
  expect(next_step.action.length).toBeLessThanOrEqual(700);
  expect(next_step.measure.length).toBeLessThanOrEqual(500);
  expect(next_step.decision_rule.length).toBeLessThanOrEqual(600);
});
