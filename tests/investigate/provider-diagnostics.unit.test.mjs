import { expect, it } from 'vitest';
import { providerDiagnostics } from '../../workers/ai-search/provider-diagnostics.mjs';
import { spawnSync } from 'node:child_process';
it.each([3036, '3036'])('extracts structured quota codes (%s)', code => {
  expect(providerDiagnostics({ code, statusCode: '429' })).toEqual({ provider_error_category: 'quota_exceeded', provider_error_code: 3036, provider_http_status: 429 });
});
it('recognizes binding prefixes without copying text', () => {
  expect(providerDiagnostics(new Error('AiError: InferenceUpstreamError: 3040: secret'))).toEqual({ provider_error_category: 'capacity_exceeded', provider_error_code: 3040 });
});
it('keeps unknown numeric codes without guessing a category', () => {
  expect(providerDiagnostics({ code: 9999, status: 500 })).toEqual({ provider_error_category: 'unknown', provider_error_code: 9999, provider_http_status: 500 });
});
it.each([null, 'secret', { code: 'secret', status: Infinity }, { message: 'prompt contains 3036: secret', name: 'secret' }])('does not expose arbitrary exceptions (%#)', error => {
  expect(providerDiagnostics(error)).toEqual({ provider_error_category: 'unknown' });
});
it('distinguishes integration type errors', () => {
  expect(providerDiagnostics(new TypeError('private'))).toEqual({ provider_error_category: 'integration_type_error' });
});
it('rejects an invalid single case before making network requests', () => {
  const run = spawnSync(process.execPath, ['workers/ai-search/evaluate-answers.mjs', '--base-url', 'http://localhost:1', '--output', '/tmp/unused-evaluation.json', '--case', 'invalid'], { encoding: 'utf8' });
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('Unknown --case');
  expect(run.stdout).not.toContain('Evaluating:');
});
