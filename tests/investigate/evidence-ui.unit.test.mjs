import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const { normalizeEvidenceResults, renderEvidenceDetails, createInvestigation } = createRequire(import.meta.url)('../../evidence-search.js');
const source = {
  id: `source:${'a'.repeat(64)}`, kind: 'eae_signal', url: 'https://agenticengineering.science/signals/context/', title: 'Context',
  passages: [{ id: `passage:${'b'.repeat(64)}`, text: '  Exact\n<script>danger()</script>  ' }],
};
const payload = { evidence: { version: 1, provenance: 'indexed_eae_pages', outcome: 'evidence_found', sources: [source] } };
it('keeps complete passage text separately from the card excerpt', () => {
  const result = normalizeEvidenceResults(payload)[0];
  expect(result.retrieved.passages[0].text).toBe(source.passages[0].text);
});
it('escapes passages and source titles; does not render an unsafe original URL', () => {
  const result = normalizeEvidenceResults(payload)[0];
  const html = renderEvidenceDetails({ ...result, evidence: { source: { title: '<img onerror=bad()>', url: 'javascript:bad()', date: '', producer: '' } } });
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toMatch(/<script|<img|href="javascript:/);
});
it('retains legacy cards when a deployed Worker has not upgraded yet', () => {
  const results = normalizeEvidenceResults({ results: [{ title: 'Legacy', url: '/signals/context/', excerpt: 'An excerpt' }] });
  expect(results[0].retrieved).toBeUndefined();
  expect(results[0].title).toBe('Legacy');
});
it('rejects malformed packages rather than turning them into false no-match results', () => {
  expect(() => normalizeEvidenceResults({})).toThrow();
  expect(() => normalizeEvidenceResults({ evidence: { version: 99 } })).toThrow();
  expect(() => normalizeEvidenceResults({ evidence: { ...payload.evidence, sources: [{ ...source, url: 'https://evil.example/' }] } })).toThrow();
  expect(() => normalizeEvidenceResults({ evidence: { ...payload.evidence, outcome: 'evidence_found', sources: [] } })).toThrow();
});
it('treats omitted oversized evidence as failure, not no matches', () => {
  expect(() => normalizeEvidenceResults({ evidence: { ...payload.evidence, outcome: 'evidence_unavailable', sources: [] } })).toThrow();
});
it('T05/T10: empty results enter limited; refinement keeps the query without fetching again', async () => {
  let calls = 0;
  const investigation = createInvestigation({ request: async () => { calls++; return []; } });
  await investigation.submit('Context?');
  expect(investigation.state.phase).toBe('limited');
  investigation.refine();
  expect(investigation.state).toMatchObject({ phase: 'editing', query: 'Context?' });
  expect(calls).toBe(1);
});
