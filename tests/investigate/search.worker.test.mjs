import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../../workers/ai-search/index.js';

describe('existing retrieval contract in the Cloudflare Workers runtime', () => {
  it.each(['', '   ', 'x'.repeat(501), '🧅'.repeat(251)])('rejects invalid input before retrieval (%#)', async query => {
    const get = vi.fn();
    const response = await handleRequest(new Request(`https://eae.test/api/search?q=${encodeURIComponent(query)}`), { AI_SEARCH: { get } });
    expect(response.status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });
  it('returns fixture evidence with the actual Worker response shape', async () => {
    const search = vi.fn().mockResolvedValue({ chunks: [{
      item: { key: '/signals/context/', metadata: { title: 'Context evidence fixture' } },
      text: 'A fixed evidence passage.', score: 0.9,
    }] });
    const response = await handleRequest(new Request('https://eae.test/api/search?q=%20Context%3F%20'), {
      AI_SEARCH: { get: () => ({ search }) },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ query: 'Context?', results: [{
      title: 'Context evidence fixture', url: 'https://agenticengineering.science/signals/context/',
      excerpt: 'A fixed evidence passage.', score: 0.9,
    }] });
    expect(search.mock.calls[0][0].messages[0].content).toBe('Context?');
  });
});
