import { createHash } from 'node:crypto';
import { ANSWER_CONTRACT, validateAnswer } from './answer.js';
import { ANSWER_CASES, CRITERIA, RUBRIC_VERSION } from './answer-rubric.mjs';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
export const reportDigest = report => createHash('sha256').update(JSON.stringify(stable(report))).digest('hex');
export function createReview(report) {
  return { rubric_version: RUBRIC_VERSION, report_sha256: reportDigest(report),
    reviewer: '', reviewed_at: '', cases: ANSWER_CASES.map(c => ({
      id: c.id, question: c.question, expectation: c.expectation,
      ratings: Object.fromEntries(Object.keys(CRITERIA).map(key => [key, { pass: null, rationale: '' }])),
      decision: 'unreviewed',
    })) };
}
// Verifies explicit review completeness and ties it to this exact report.
// It does not judge entailment, verify reviewer identity, or authorize deployment.
export function checkReview(report, review) {
  const blockers = [];
  if (review?.rubric_version !== RUBRIC_VERSION) blockers.push('Review rubric version mismatch');
  if (review?.report_sha256 !== reportDigest(report)) blockers.push('Review does not match this report');
  if (typeof review?.reviewer !== 'string' || !review.reviewer.trim()) blockers.push('Reviewer is missing');
  if (typeof review?.reviewed_at !== 'string' || !Number.isFinite(Date.parse(review.reviewed_at))) blockers.push('Review date is missing or invalid');
  const results = Array.isArray(report?.results) ? report.results : [];
  const reviews = Array.isArray(review?.cases) ? review.cases : [];
  if (results.length !== ANSWER_CASES.length || reviews.length !== ANSWER_CASES.length) blockers.push('Exactly six evaluation cases and reviews are required');
  for (const c of ANSWER_CASES) {
    const matches = results.filter(r => r.question === c.question);
    const assessments = reviews.filter(r => r.id === c.id);
    if (matches.length !== 1 || assessments.length !== 1) { blockers.push(`${c.id}: missing or duplicate case`); continue; }
    const result = matches[0], assessment = assessments[0];
    if (result.contract !== 'pass') blockers.push(`${c.id}: technical contract failed`);
    try { validateAnswer(result.data?.answer, result.data?.sources || []); }
    catch { blockers.push(`${c.id}: answer does not satisfy the current contract`); }
    if (result.data?.diagnostics?.answer_contract !== ANSWER_CONTRACT) blockers.push(`${c.id}: generation contract marker missing or outdated`);
    if (c.expected_abstention && (result.data?.answer?.outcome !== 'insufficient' || result.data?.answer?.next_step !== null)) blockers.push(`${c.id}: unrelated-question abstention failed`);
    if (assessment.question !== c.question) blockers.push(`${c.id}: review question mismatch`);
    if (assessment.decision !== 'pass') blockers.push(`${c.id}: semantic review is ${assessment.decision === 'fail' ? 'fail' : 'pending'}`);
    for (const key of Object.keys(CRITERIA)) {
      const rating = assessment.ratings?.[key];
      if (rating?.pass !== true || typeof rating?.rationale !== 'string' || !rating.rationale.trim()) blockers.push(`${c.id}: ${key} needs a passing assessment with rationale`);
    }
  }
  return { status: blockers.length ? 'blocked' : 'reviewed_pass', blockers };
}
