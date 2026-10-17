import fs from 'node:fs/promises';
import { createReview, checkReview } from './answer-review.mjs';
const args = process.argv.slice(2);
const options = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!['--input', '--output', '--review'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options.has(args[i])) throw Error('Usage: npm run review:answer -- --input report.json (--output review.json | --review review.json)');
  options.set(args[i], args[i + 1]);
}
if (!options.has('--input') || options.has('--output') === options.has('--review')) throw Error('Provide --input and exactly one of --output or --review');
const report = JSON.parse(await fs.readFile(options.get('--input'), 'utf8'));
if (options.has('--output')) {
  await fs.writeFile(options.get('--output'), JSON.stringify(createReview(report), null, 2) + '\n', { flag: 'wx' });
  console.log('Created an unreviewed checklist. Read the rubric and report; complete every rating with evidence-based rationale. Existing files are never overwritten.');
} else {
  const review = JSON.parse(await fs.readFile(options.get('--review'), 'utf8'));
  const result = checkReview(report, review);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'reviewed_pass') process.exitCode = 1;
}
