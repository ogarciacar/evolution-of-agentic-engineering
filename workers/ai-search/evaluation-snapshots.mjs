import { ANSWER_CASES } from './answer-rubric.mjs';

// Pin canonical evidence, never accept report text as model input.
export function pinnedCases(report) {
  if (!Array.isArray(report?.results) || report.results.length !== ANSWER_CASES.length) throw Error('Snapshot report needs all six cases');
  return Object.fromEntries(ANSWER_CASES.map(testCase => {
    const matches = report.results.filter(r => r.question === testCase.question);
    const sources = matches[0]?.data?.sources;
    if (matches.length !== 1 || !Array.isArray(sources) || !sources.length || sources.length > 5 ||
      sources.some(s => !/^[a-zA-Z0-9_-]{1,180}$/.test(s.record_id || '') || !/^[a-f0-9]{64}$/.test(s.snapshot_id || '')) ||
      new Set(sources.map(s => s.record_id)).size !== sources.length) throw Error(`Missing complete canonical snapshots: ${testCase.id}`);
    return [testCase.id, { record_ids: sources.map(s => s.record_id), snapshot_ids: sources.map(s => s.snapshot_id) }];
  }));
}
