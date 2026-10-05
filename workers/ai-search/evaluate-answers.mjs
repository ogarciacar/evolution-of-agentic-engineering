// Explicit live evaluation: costs up to six bounded Workers AI calls. Not part of CI.
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAnswer } from './answer.js';
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
for (const question of questions) {
  try {
    const search = await fetch(new URL(`/api/search?q=${encodeURIComponent(question)}&passages=1`, base), { signal: AbortSignal.timeout(30000) });
    if (!search.ok) throw Error(`Retrieval HTTP ${search.status}`);
    const retrieval = await search.json();
    if (!retrieval.answer_available) throw Error('Answer capability is not enabled at this endpoint');
    const record_ids = [...new Set(retrieval.evidence.sources.map(s => s.record_id).filter(Boolean))];
    const started = Date.now();
    const response = await fetch(new URL('/api/search/answer', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: question, record_ids }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Answer HTTP ${response.status}`);
    const data = await response.json();
    validateAnswer(data.answer, data.sources);
    const expectedAbstention = question === questions.at(-1);
    results.push({ question, latency_ms: Date.now() - started, contract: 'pass', expected_abstention: expectedAbstention, abstention_pass: !expectedAbstention || data.answer.outcome === 'insufficient', data,
      human_review: { claims_supported: null, boundaries_preserved: null, question_answered_or_justified_abstention: null, next_step_useful_and_measurable: null, decision: 'unreviewed', notes: '' } });
  } catch (error) { results.push({ question, contract: 'fail', error: error.message }); }
}
const output = option('--output');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ evaluated_at: new Date().toISOString(), endpoint: base.origin, results }, null, 2) + '\n');
console.log(`Saved ${results.length} live cases to ${output}. Human review is required; contract checks do not establish claim support.`);
if (results.some(r => r.contract !== 'pass' || !r.abstention_pass)) process.exitCode = 1;
