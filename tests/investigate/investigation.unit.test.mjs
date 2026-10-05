import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const { validateQuestion, createInvestigation, createSearchRequest } = createRequire(import.meta.url)('../../evidence-search.js');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('T01 question validation', () => {
  it('rejects empty questions and normalizes outer whitespace', () => {
    expect(validateQuestion('   ').error).toBe('Enter a question to search the evidence.');
    expect(validateQuestion('  Context?  ')).toEqual({ query: 'Context?', error: '' });
  });
  it('matches the existing API and HTML limit in UTF-16 code units', () => {
    expect(validateQuestion('x'.repeat(500)).error).toBe('');
    expect(validateQuestion('x'.repeat(501)).error).toBe('Use 500 characters or fewer.');
    expect(validateQuestion('🧅'.repeat(250)).error).toBe('');
    expect(validateQuestion('🧅'.repeat(251)).error).toBe('Use 500 characters or fewer.');
  });
});

describe('investigation lifecycle', () => {
  it('T00 starts in editing without a request', () => {
    const request = vi.fn();
    const investigation = createInvestigation({ request });
    expect(investigation.state).toMatchObject({ phase: 'editing', results: [], error: '' });
    expect(request).not.toHaveBeenCalled();
  });
  it('T01 never requests evidence for invalid input', async () => {
    const request = vi.fn();
    const investigation = createInvestigation({ request });
    await investigation.submit(' ');
    expect(request).not.toHaveBeenCalled();
    expect(investigation.state.phase).toBe('editing');
    expect(investigation.state.error).not.toBe('');
  });
  it('T02 enters finding synchronously, trims query and suppresses double submission', async () => {
    const pending = deferred();
    const request = vi.fn(() => pending.promise);
    const investigation = createInvestigation({ request });
    const first = investigation.submit('  Context?  ');
    expect(investigation.state).toMatchObject({ phase: 'finding', query: 'Context?' });
    await investigation.submit('Second question');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('Context?');
    pending.resolve([]);
    await first;
    expect(investigation.state.phase).toBe('limited');
  });
  it('T07 stops immediately, aborts the adapter and preserves the question', async () => {
    const pending = deferred();
    const request = vi.fn(() => pending.promise);
    const investigation = createInvestigation({ request });
    const first = investigation.submit('Context?');
    investigation.stop();
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    expect(investigation.state).toMatchObject({ phase: 'editing', query: 'Context?', stopped: true });
    pending.resolve([{ title: 'Late evidence' }]);
    await first;
    expect(investigation.state.phase).toBe('editing');
    expect(investigation.state.results).toEqual([]);
  });
  it.each(['resolve', 'reject'])('T07 ignores a late %s while a newer request is in progress', async settlement => {
    const old = deferred();
    const fresh = deferred();
    const request = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const investigation = createInvestigation({ request });
    const first = investigation.submit('Old question');
    investigation.stop();
    const second = investigation.submit('New question');
    old[settlement](settlement === 'resolve' ? [{ title: 'Old' }] : new Error('Late failure'));
    await first;
    expect(investigation.state).toMatchObject({ phase: 'finding', query: 'New question' });
    fresh.resolve([{ title: 'Current' }]);
    await second;
    expect(investigation.state.results).toEqual([{ title: 'Current' }]);
  });
  it('a failed request releases the submission guard for retry', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    const investigation = createInvestigation({ request });
    await investigation.submit('Context?');
    expect(investigation.state).toMatchObject({ phase: 'failed', query: 'Context?' });
    await investigation.submit('Context?');
    expect(investigation.state.phase).toBe('limited');
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe('search request adapter', () => {
  it('encodes the query and propagates cancellation through search and enrichment', async () => {
    const controller = new AbortController();
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ title: 'Source', url: '/signals/context/', excerpt: 'Evidence' }] }) })
      .mockResolvedValueOnce({ ok: false });
    const results = await createSearchRequest(fetch)('A & B?', { signal: controller.signal });
    expect(fetch.mock.calls[0][0]).toBe('/api/search?q=A%20%26%20B%3F&passages=1');
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
    expect(fetch.mock.calls[1][1].signal).toBe(controller.signal);
    expect(results[0].title).toBe('Source');
  });
  it('does not start enrichment if search completes after cancellation', async () => {
    const controller = new AbortController();
    const pending = deferred();
    const fetch = vi.fn(() => pending.promise);
    const request = createSearchRequest(fetch)('Context?', { signal: controller.signal });
    controller.abort();
    pending.resolve({ ok: true, json: async () => ({ results: [{ url: '/signals/context/' }] }) });
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects non-success HTTP responses', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(createSearchRequest(fetch)('Context?', {})).rejects.toThrow('HTTP 503');
  });
});
