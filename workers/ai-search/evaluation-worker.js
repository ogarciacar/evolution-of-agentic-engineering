import { handleRequest } from './index.js';

// Evaluation-only entry point. Production continues to use index.js directly.
export async function handleEvaluation(request, env) {
  const reject = (status, code) => Response.json({ error: code, code }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (typeof env.EVALUATION_TOKEN !== 'string' || env.EVALUATION_TOKEN.length < 32 || env.EVALUATION_TOKEN.length > 1024 || /\s/.test(env.EVALUATION_TOKEN)) return reject(503, 'evaluation_not_configured');
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length > 1031) return reject(401, 'unauthorized');
  const encoder = new TextEncoder();
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const [expected, received] = await Promise.all([digest(env.EVALUATION_TOKEN), digest(authorization.slice(7))]);
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ received[i];
  if (mismatch) return reject(401, 'unauthorized');
  return handleRequest(request, env);
}
export default { fetch: handleEvaluation };
