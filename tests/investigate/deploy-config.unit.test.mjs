import { expect, it } from 'vitest';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
it('deployment defaults disable synthesis; enabling requires explicit configuration', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'eae-deploy-'));
  try {
    for (const name of ['configure-deploy.mjs', 'wrangler.jsonc']) await copyFile(`workers/ai-search/${name}`, path.join(dir, name));
    const env = { ...process.env, EVIDENCE_DB_NAME: 'test-db', EVIDENCE_DB_ID: '00000000-0000-0000-0000-000000000000' };
    delete env.EAE_ANSWER_ENABLED;
    const run = () => execFileSync(process.execPath, [path.join(dir, 'configure-deploy.mjs')], { env });
    const config = async () => JSON.parse(await readFile(path.join(dir, 'wrangler.deploy.json'), 'utf8'));
    run();
    expect((await config()).vars.ANSWER_ENABLED).toBe('false');
    expect((await config()).d1_databases[0].database_name).toBe('test-db');
    env.EAE_ANSWER_ENABLED = 'true'; run();
    expect((await config()).vars.ANSWER_ENABLED).toBe('true');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
