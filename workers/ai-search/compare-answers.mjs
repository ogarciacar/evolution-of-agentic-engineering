// Explicit paid evaluation: twelve bounded model calls, never run by CI.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pinnedCases } from './evaluation-snapshots.mjs';
import { evaluationTransport } from './evaluation-transport.mjs';
import { compareModels } from './model-comparison.mjs';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--base-url', '--snapshot-report', '--output-dir'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) throw Error('Use --base-url URL --snapshot-report FILE --output-dir NEW_DIRECTORY');
  options[args[i]] = args[i + 1];
}
if (Object.keys(options).length !== 3) throw Error('Use --base-url URL --snapshot-report FILE --output-dir NEW_DIRECTORY');
const base = new URL(options['--base-url']);
const transport = evaluationTransport(base, process.env.EAE_EVALUATION_TOKEN);
const snapshots = pinnedCases(JSON.parse(await fs.readFile(options['--snapshot-report'], 'utf8')));
const output = options['--output-dir'];
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output); // Refuse to overwrite an earlier run, before any inference.
const { reports, comparison } = await compareModels(base, snapshots, transport, console.log);
for (const [key, report] of Object.entries(reports)) await fs.writeFile(path.join(output, `${key}.json`), JSON.stringify(report, null, 2) + '\n');
await fs.writeFile(path.join(output, 'comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
console.log(`Saved comparison to ${output}. Human semantic review is still required.`);
if (comparison.pairs.some(p => !p.same_input || !p.models_confirmed || !p.contracts_pass)) process.exitCode = 1;
