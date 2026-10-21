import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createReview, checkReview, reportDigest } from '../../workers/ai-search/answer-review.mjs';
import { ANSWER_CASES } from '../../workers/ai-search/answer-rubric.mjs';
import { ANSWER_CONTRACT, canonicalSources, validateAnswer } from '../../workers/ai-search/answer.js';
import { record, answerFor } from './answer-fixtures.mjs';

async function reportFixture() {
  const { sources } = await canonicalSources([record]);
  return { results: ANSWER_CASES.map(c => ({ question: c.question, contract: 'pass', data: {
    sources, diagnostics: { answer_contract: ANSWER_CONTRACT },
    answer: c.expected_abstention ? { outcome: 'insufficient', summary: { text: 'No weather evidence.', citations: [] }, claims: [], uncertainties: ['No relevant source.'], next_step: null } : answerFor(sources),
  } })) };
}
// Synthetic review validates checker mechanics only, never live answer quality.
function completedReview(report) {
  const review = createReview(report);
  review.reviewer = 'test fixture';
  review.reviewed_at = '2026-10-17T08:52:17Z';
  for (const c of review.cases) {
    c.decision = 'pass';
    for (const r of Object.values(c.ratings)) Object.assign(r, { pass: true, rationale: 'Synthetic assessment for checker tests only.' });
  }
  return review;
}
it('contract success alone leaves semantic review blocked', async () => {
  const report = await reportFixture();
  const template = createReview(report);
  expect(template.cases.every(c => c.decision === 'unreviewed')).toBe(true);
  expect(checkReview(report, template).status).toBe('blocked');
  expect(checkReview(report, completedReview(report)).status).toBe('reviewed_pass');
});
it('binds the review to the exact report independent of object key ordering', async () => {
  const report = await reportFixture();
  const review = completedReview(report);
  const changed = structuredClone(report);
  changed.results[0].data.answer.summary.text = 'A different claim';
  expect(checkReview(changed, review).blockers).toContain('Review does not match this report');
  expect(reportDigest({ b: 2, a: 1 })).toBe(reportDigest({ a: 1, b: 2 }));
});
it.each(['missing case', 'duplicate case', 'failed contract', 'invalid answer', 'old deployment', 'weather experiment'])('blocks %s even with a completed passing review', async kind => {
  const report = await reportFixture();
  if (kind === 'missing case') report.results.pop();
  if (kind === 'duplicate case') report.results[1] = structuredClone(report.results[0]);
  if (kind === 'failed contract') report.results[0].contract = 'fail';
  if (kind === 'invalid answer') report.results[0].data.answer.summary.citations = [];
  if (kind === 'old deployment') report.results[0].data.diagnostics.answer_contract = 'old';
  if (kind === 'weather experiment') report.results.at(-1).data.answer = report.results[0].data.answer;
  expect(checkReview(report, completedReview(report)).status).toBe('blocked');
});
it.each(['rejection', 'missing rating', 'no rationale', 'no reviewer', 'wrong rubric', 'duplicate review'])('blocks review with %s', async kind => {
  const report = await reportFixture(), review = completedReview(report);
  if (kind === 'rejection') review.cases[0].decision = 'fail';
  if (kind === 'missing rating') delete review.cases[0].ratings.support;
  if (kind === 'no rationale') review.cases[0].ratings.support.rationale = ' ';
  if (kind === 'no reviewer') review.reviewer = '';
  if (kind === 'wrong rubric') review.rubric_version = 'old';
  if (kind === 'duplicate review') review.cases[1] = structuredClone(review.cases[0]);
  expect(checkReview(report, review).status).toBe('blocked');
});
it('preserves the live counterexamples: valid contracts do not imply supported answers', () => {
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/answer-semantic-baseline.json', import.meta.url)));
  expect(baseline.review_origin).toContain('not human release approval');
  expect(baseline.cases.map(c => c.id)).toEqual(ANSWER_CASES.map(c => c.id));
  // Preserve historical payloads. v5 now catches missing observed support in
  // three cases; the other semantic failures still require actual review.
  for (const c of baseline.cases) {
    if (['many-agents', 'human-review', 'context'].includes(c.id))
      expect(() => validateAnswer(c.answer, c.sources)).toThrow('requires observed evidence');
    else expect(validateAnswer(c.answer, c.sources)).toBe(c.answer);
  }
  expect(baseline.cases.filter(c => c.assessment.decision === 'fail')).toHaveLength(5);
  const context = baseline.cases.find(c => c.id === 'context');
  expect(context.answer.uncertainties).toContain('The sources do not compare the performance of different context management approaches.');
  expect(context.sources.flatMap(s => s.passages).some(p => p.field === 'observed.5' && p.text.includes('352 seconds to 325 seconds'))).toBe(true);
  expect(context.assessment.ratings.boundaries.pass).toBe(false);
});
it('CLI creates a pending review, refuses overwrite and returns nonzero for incomplete review', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'eae-review-'));
  try {
    const input = join(dir, 'report.json'), output = join(dir, 'review.json');
    const raw = JSON.stringify(await reportFixture());
    writeFileSync(input, raw);
    const run = (...args) => spawnSync(process.execPath, ['workers/ai-search/review-answers.mjs', '--input', input, ...args], { encoding: 'utf8' });
    expect(run('--output', output).status).toBe(0);
    const initial = readFileSync(output, 'utf8');
    expect(JSON.parse(initial).cases[0].decision).toBe('unreviewed');
    expect(run('--output', output).status).not.toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(initial);
    expect(run('--review', output).status).toBe(1);
    expect(readFileSync(input, 'utf8')).toBe(raw);
    writeFileSync(output, JSON.stringify(completedReview(JSON.parse(raw))));
    expect(run('--review', output).status).toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
