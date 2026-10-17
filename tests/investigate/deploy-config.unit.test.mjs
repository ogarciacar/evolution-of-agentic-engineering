import { expect, it } from 'vitest';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
it('deployment defaults disable synthesis; enabling requires explicit configuration', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'eae-deploy-'));
  try {
    for (const name of ['configure-deploy.mjs', 'configure-evaluation.mjs', 'wrangler.jsonc']) await copyFile(`workers/ai-search/${name}`, path.join(dir, name));
    const env = { ...process.env, EVIDENCE_DB_NAME: 'test-db', EVIDENCE_DB_ID: '00000000-0000-0000-0000-000000000000' };
    delete env.EAE_ANSWER_ENABLED;
    const run = () => execFileSync(process.execPath, [path.join(dir, 'configure-deploy.mjs')], { env });
    const config = async () => JSON.parse(await readFile(path.join(dir, 'wrangler.deploy.json'), 'utf8'));
    run();
    expect((await config()).vars.ANSWER_ENABLED).toBe('false');
    expect((await config()).d1_databases[0].database_name).toBe('test-db');
    const production = await readFile(path.join(dir, 'wrangler.deploy.json'), 'utf8');
    execFileSync(process.execPath, [path.join(dir, 'configure-evaluation.mjs')], { env });
    const evaluation = JSON.parse(await readFile(path.join(dir, 'wrangler.evaluation.json'), 'utf8'));
    expect(evaluation).toMatchObject({ name: 'agentic-engineering-search-evaluation', main: './evaluation-worker.js', routes: [], workers_dev: true, preview_urls: false, vars: { ANSWER_ENABLED: 'true' } });
    expect(evaluation.ratelimits[0].namespace_id).not.toBe((await config()).ratelimits[0].namespace_id);
    expect(await readFile(path.join(dir, 'wrangler.deploy.json'), 'utf8')).toBe(production);
    expect(evaluation).not.toHaveProperty('secrets');
    env.EAE_ANSWER_ENABLED = 'true'; run();
    expect((await config()).vars.ANSWER_ENABLED).toBe('true');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
