import fs from 'node:fs';
const { EVIDENCE_DB_NAME, EVIDENCE_DB_ID } = process.env;
if (!EVIDENCE_DB_NAME || !/^[a-f0-9-]{36}$/i.test(EVIDENCE_DB_ID || '')) throw Error('Existing EVIDENCE_DB_NAME and EVIDENCE_DB_ID are required');
const dir = new URL('./', import.meta.url);
const config = JSON.parse(fs.readFileSync(new URL('wrangler.jsonc', dir), 'utf8'));
// A distinct Worker and entry point; never inherit the production route.
config.name = 'agentic-engineering-search-evaluation';
config.main = './evaluation-worker.js';
config.routes = [];
config.workers_dev = true;
config.preview_urls = false;
config.vars = { ANSWER_ENABLED: 'true' };
config.ratelimits = config.ratelimits.map(binding => ({ ...binding, namespace_id: '2026101701' }));
config.d1_databases = [{ binding: 'EVIDENCE_DB', database_name: EVIDENCE_DB_NAME, database_id: EVIDENCE_DB_ID }];
fs.writeFileSync(new URL('wrangler.evaluation.json', dir), JSON.stringify(config, null, 2) + '\n');
console.log('Evaluation configuration ready: separate Worker, no production routes, authentication required');
