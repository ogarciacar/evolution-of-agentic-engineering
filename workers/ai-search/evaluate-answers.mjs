// Explicit live evaluation: costs up to six bounded Workers AI calls. Not part of CI.
import fs from 'node:fs/promises';
import path from 'node:path';
import { evaluateQuestion } from './evaluation-case.mjs';
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (!args.includes('--base-url') || !args.includes('--output')) throw Error('Usage: npm run eval:answer -- --base-url https://agenticengineering.science --output .artifacts/answer-evaluation.json');
const base = new URL(option('--base-url'));
if (base.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(base.hostname)) throw Error('Use HTTPS or localhost');
const questions = [
  'Are coding agents actually reducing engineering cycle time?',
  'What changes when teams go from one agent to many?',
  'Where does human review become the bottleneck?',
  'What evidence supports the claim that context is becoming the limiting factor?',
  'What new infrastructure appears once agents become part of the engineering system?',
  'What will the weather in Amsterdam be tomorrow?',
];
const results = [];
for (const question of questions) results.push(await evaluateQuestion(base, question, question === questions.at(-1)));
const output = option('--output');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ evaluated_at: new Date().toISOString(), endpoint: base.origin, results }, null, 2) + '\n');
console.log(`Saved ${results.length} live cases to ${output}. Human review is required; contract checks do not establish claim support.`);
if (results.some(r => r.contract !== 'pass' || !r.abstention_pass)) process.exitCode = 1;
