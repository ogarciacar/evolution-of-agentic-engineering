import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { canonicalSources, finalizeGeneratedAnswer, validateAnswer } from '../../workers/ai-search/answer.js';
import { record, generatedAnswerFor } from './answer-fixtures.mjs';

const live = JSON.parse(readFileSync(new URL('./fixtures/answer-human-review-v4.json', import.meta.url)));
it.each(['summary', 'claims[0]', 'next_step'])('attaches the component path %s to missing-observation errors', async path => {
  const { sources } = await canonicalSources([record]);
  const value = generatedAnswerFor(sources);
  if (path === 'claims[0]') value.claims = [{ kind: 'interpretation', text: 'An inference.', citations: ['s1p2'] }];
  else value[path].citations = ['s1p2'];
  expect(() => finalizeGeneratedAnswer(value, sources)).toThrow(expect.objectContaining({ reason: 'observed_evidence_missing', validation_path: path }));
});
it('rejects the actual v4 human-review answer that promoted an open question into a finding', () => {
  expect(() => validateAnswer(live.answer, live.sources)).toThrow('Open questions cannot support findings');
  expect(() => validateAnswer(live.answer, live.sources)).toThrow(expect.objectContaining({ validation_path: 'summary' }));
});

it.each(['summary', 'claim'])('rejects an open question in %s even when mixed with observed evidence', async target => {
  const { sources } = await canonicalSources([record]);
  const value = generatedAnswerFor(sources);
  const question = `s1p${sources[0].passages.findIndex(p => p.field === 'open_question') + 1}`;
  const citations = ['s1p1', question];
  if (target === 'summary') value.summary.citations = citations;
  else value.claims = [{ kind: 'interpretation', text: 'Context is a constraint.', citations }];
  expect(() => finalizeGeneratedAnswer(value, sources)).toThrow('Open questions cannot support findings');
});

it.each(['interpretation', 'model_implication', 'what_this_does_not_establish.0'])('requires observed support rather than %s alone', async field => {
  const { sources } = await canonicalSources([record]);
  const ref = `s1p${sources[0].passages.findIndex(p => p.field === field) + 1}`;
  for (const target of ['summary', 'claim', 'step']) {
    const value = generatedAnswerFor(sources);
    if (target === 'summary') value.summary.citations = [ref];
    else if (target === 'claim') value.claims = [{ kind: 'interpretation', text: 'A bounded inference.', citations: [ref] }];
    else value.next_step.citations = [ref];
    expect(() => finalizeGeneratedAnswer(value, sources)).toThrow('requires observed evidence');
  }
});

it('preserves observed findings with cited limitations and interpretations', async () => {
  const { sources } = await canonicalSources([record]);
  const value = generatedAnswerFor(sources);
  const boundary = `s1p${sources[0].passages.findIndex(p => p.field.startsWith('what_this_does_not_establish.')) + 1}`;
  value.summary.citations.push(boundary);
  value.claims.push({ kind: 'interpretation', text: 'The reported exploration motivates a local test, without establishing a causal effect.', citations: ['s1p1', 's1p2', boundary] });
  expect(finalizeGeneratedAnswer(value, sources).outcome).toBe('answered');
});

it('allows an open question as an insufficient boundary and investigation motivation, with observed support for the step', async () => {
  const { sources } = await canonicalSources([record]);
  const value = generatedAnswerFor(sources, true);
  const question = `s1p${sources[0].passages.findIndex(p => p.field === 'open_question') + 1}`;
  value.summary = { text: 'The record leaves the benefit of a context guide as an open question.', citations: [question] };
  value.next_step.citations.push(question);
  expect(finalizeGeneratedAnswer(value, sources).outcome).toBe('insufficient');
  value.next_step.citations = [question];
  expect(() => finalizeGeneratedAnswer(value, sources)).toThrow('requires observed evidence');
  value.next_step = null;
  expect(finalizeGeneratedAnswer(value, sources).next_step).toBeNull();
});
