import { ANSWER_CASES, RUBRIC_VERSION } from './answer-rubric.mjs';
import { EVALUATION_MODELS } from './evaluation-models.mjs';
import { evaluateQuestion } from './evaluation-case.mjs';

export async function compareModels(base, snapshots, transport, progress = () => {}) {
  if (ANSWER_CASES.some(c => !snapshots?.[c.id])) throw Error('All six pinned cases are required');
  const reports = Object.fromEntries(Object.entries(EVALUATION_MODELS).map(([key, model]) => [key, {
    endpoint: new URL(base).origin, model, model_key: key, rubric_version: RUBRIC_VERSION,
    semantic_status: 'unreviewed', evidence_mode: 'pinned_snapshots', pinned_cases: snapshots, results: [],
  }]));
  const pairs = [];
  for (const [i, testCase] of ANSWER_CASES.entries()) {
    // Alternate first model to reduce systematic ordering effects. No retries.
    const keys = i % 2 ? ['gpt-oss', 'llama'] : ['llama', 'gpt-oss'];
    for (const key of keys) {
      progress(`${testCase.id}: ${key}`);
      const selected = (url, options = {}) => transport(url, { ...options, headers: { ...options.headers, 'X-EAE-Evaluation-Model': key } });
      const result = await evaluateQuestion(base, testCase.question, testCase.expected_abstention, selected, snapshots[testCase.id]);
      reports[key].results.push({ case_id: testCase.id, ...result });
    }
    const results = Object.keys(reports).map(key => reports[key].results.at(-1));
    const diagnostics = results.map(r => r.data?.diagnostics ?? r.diagnostic);
    const sameInput = Boolean(diagnostics[0]?.generation_input_sha256 && diagnostics[0].generation_input_sha256 === diagnostics[1]?.generation_input_sha256);
    const modelsConfirmed = diagnostics[0]?.model_key === 'llama' && diagnostics[1]?.model_key === 'gpt-oss';
    pairs.push({ case_id: testCase.id, same_input: sameInput, models_confirmed: modelsConfirmed,
      contracts_pass: results.every(r => r.contract === 'pass' && r.abstention_pass) });
  }
  const evaluated_at = new Date().toISOString();
  for (const report of Object.values(reports)) report.evaluated_at = evaluated_at;
  return { reports, comparison: { evaluated_at, semantic_status: 'unreviewed', pairs } };
}
