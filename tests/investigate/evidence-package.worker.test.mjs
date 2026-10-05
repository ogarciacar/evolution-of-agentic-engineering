import { describe, expect, it } from 'vitest';
import { handleRequest } from '../../workers/ai-search/index.js';
const chunk = (text, key = '/signals/context/') => ({ text, item: { key, metadata: { title: 'Context' } } });
async function retrieve(chunks) {
  const response = await handleRequest(new Request('https://eae.test/api/search?q=context&passages=1'), { AI_SEARCH: { get: () => ({ search: async () => ({ chunks }) }) } });
  return { status: response.status, body: await response.json() };
}
describe('traceable evidence package', () => {
  it('preserves exact text, groups passages, and deduplicates canonical page variants', async () => {
    const text = '  ## Source\nAn exact passage.  ';
    const { body } = await retrieve([chunk(text), chunk(text, '/signals/context?utm_source=test#section'), chunk('Another passage')]);
    expect(body.evidence.outcome).toBe('evidence_found');
    expect(body.evidence.sources).toHaveLength(1);
    expect(body.evidence.sources[0]).toMatchObject({ kind: 'eae_signal', url: 'https://agenticengineering.science/signals/context/', record_id: 'context' });
    expect(body.evidence.sources[0].passages.map(p => p.text)).toEqual([text, 'Another passage']);
    expect(body.evidence.sources[0].passages[0].id).toMatch(/^passage:[a-f0-9]{64}$/);
  });
  it('IDs survive ranking changes and change only for different source/text', async () => {
    const a = (await retrieve([chunk('A'), chunk('B')])).body.evidence.sources[0];
    const b = (await retrieve([chunk('B'), chunk('A')])).body.evidence.sources[0];
    expect(a.id).toBe(b.id);
    expect(a.passages[0].id).toBe(b.passages[1].id);
    expect(a.passages[0].id).not.toBe(a.passages[1].id);
    const c = (await retrieve([chunk('A', '/signals/other/')])).body.evidence.sources[0];
    expect(c.passages[0].id).not.toBe(a.passages[0].id);
  });
  it('keeps real practices text and labels a collection without inventing a source record', async () => {
    const text = '| Practice | Observation |\n| Context | Reported |';
    const source = (await retrieve([chunk(text, '/practices')])).body.evidence.sources[0];
    expect(source).toMatchObject({ kind: 'eae_collection', record_id: null });
    expect(source.passages[0].text).toBe(text);
  });
  it('empty, blank, malformed, off-site and unsupported passages yield no matches', async () => {
    const { body } = await retrieve([chunk(''), chunk('  '), chunk({ bad: true }), chunk('outside', 'https://example.org/signals/a'), chunk('index', '/evidence'), chunk('unsafe', 'https://user:pass@agenticengineering.science/signals/a')]);
    expect(body.evidence).toMatchObject({ outcome: 'no_matching_evidence', sources: [] });
  });
  it('bounds source and passage counts, indicating omissions without clipping text', async () => {
    const input = Array.from({ length: 8 }, (_, i) => Array.from({ length: 5 }, (_, j) => chunk(`Text ${i} ${j}`, `/signals/source-${i}/`))).flat();
    const evidence = (await retrieve(input)).body.evidence;
    expect(evidence.sources).toHaveLength(5);
    expect(evidence.sources.every(s => s.passages.length === 3)).toBe(true);
    expect(evidence.truncated).toBe(true);
  });
  it('all oversized passages are unavailable rather than falsely called no matches', async () => {
    const evidence = (await retrieve([chunk('x'.repeat(12001))])).body.evidence;
    expect(evidence).toMatchObject({ outcome: 'evidence_unavailable', sources: [], truncated: true });
  });
  it('a malformed provider response fails instead of claiming no evidence', async () => {
    expect((await retrieve('not an array')).status).toBe(503);
  });
});
