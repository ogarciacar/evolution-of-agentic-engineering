import { expect, it, vi } from 'vitest';
import { evaluationTransport } from '../../workers/ai-search/evaluation-transport.mjs';
const base = 'https://agentic-engineering-search-evaluation.example.workers.dev';
const token = 'a'.repeat(64);
it.each(['https://agenticengineering.science', 'http://agentic-engineering-search-evaluation.example.workers.dev', 'https://agentic-engineering-search-evaluation.example.workers.dev.evil.test'])('refuses an unintended evaluation target: %s', url => {
  expect(() => evaluationTransport(url, token)).toThrow('separate');
});
it('requires a secret without embedding it in errors', () => {
  expect(() => evaluationTransport(base, undefined)).toThrow('EAE_EVALUATION_TOKEN');
});
it('authenticates requests and refuses redirects and origin changes', async () => {
  const transport = vi.fn().mockResolvedValue(new Response('ok'));
  const send = evaluationTransport(base, token, transport);
  await send(`${base}/api/search`, { headers: { 'Content-Type': 'application/json' } });
  expect(transport).toHaveBeenCalledWith(`${base}/api/search`, expect.objectContaining({ redirect: 'manual', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }));
  expect(() => send('https://agenticengineering.science/api/search')).toThrow('another origin');
  expect(transport).toHaveBeenCalledOnce();
});
