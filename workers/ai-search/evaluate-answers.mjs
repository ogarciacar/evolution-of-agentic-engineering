// Explicit live evaluation: costs up to six bounded Workers AI calls. Not part of CI.
import fs from 'node:fs/promises';
import path from 'node:path';
import { evaluationTransport } from './evaluation-transport.mjs';
import { evaluateQuestion } from './evaluation-case.mjs';
import { ANSWER_CASES, RUBRIC_VERSION } from './answer-rubric.mjs';
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (!args.includes('--base-url') || !args.includes('--output')) throw Error('Usage: npm run eval:answer -- --base-url https://agenticengineering.science --output .artifacts/answer-evaluation.json');
const base = new URL(option('--base-url'));
if (base.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(base.hostname)) throw Error('Use HTTPS or localhost');
const transport = args.includes('--evaluation') ? evaluationTransport(base, process.env.EAE_EVALUATION_TOKEN) : fetch;
const results = [];
for (const [index, testCase] of ANSWER_CASES.entries()) {
  const { question, expected_abstention } = testCase;
  console.log(`[${index + 1}/${ANSWER_CASES.length}] Evaluating: ${question}`);
  const result = await evaluateQuestion(base, question, expected_abstention, transport);
  results.push({ case_id: testCase.id, ...result });
  console.log(`  ${result.contract}: ${result.diagnostic?.validation_reason || result.diagnostic?.code || result.data?.answer.outcome || result.error} (${result.latency_ms} ms)`);
}
const output = option('--output');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ evaluated_at: new Date().toISOString(), endpoint: base.origin, rubric_version: RUBRIC_VERSION, semantic_status: 'unreviewed', results }, null, 2) + '\n');
console.log(`Saved ${results.length} live cases to ${output}. Human review is required; contract checks do not establish claim support.`);
if (results.some(r => r.contract !== 'pass' || !r.abstention_pass)) process.exitCode = 1;
