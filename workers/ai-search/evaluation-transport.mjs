export function evaluationTransport(base, token, transport = fetch) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !/^agentic-engineering-search-evaluation\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)) throw Error('Evaluation requires the separate agentic-engineering-search-evaluation.<account>.workers.dev HTTPS endpoint');
  if (typeof token !== 'string' || token.length < 32 || token.length > 1024 || /\s/.test(token)) throw Error('Set EAE_EVALUATION_TOKEN to the evaluation Worker secret (32–1024 non-whitespace characters)');
  return (target, options = {}) => {
    if (new URL(target).origin !== url.origin) throw Error('Refusing to send evaluation credentials to another origin');
    return transport(target, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, redirect: 'manual' });
  };
}
