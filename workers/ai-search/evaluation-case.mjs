import { validateAnswer } from './answer.js';

// Inject transport for deterministic tests. Never copy arbitrary upstream error bodies.
export async function evaluateQuestion(base, question, expectedAbstention = false, transport = fetch) {
  const started = Date.now();
  let stage = 'retrieval';
  let status = null;
  let requestId = null;
  let diagnostic = null;
  const read = async response => {
    status = response.status;
    requestId = response.headers.get('X-Request-ID');
    if (!response.ok) {
      let body;
      try { body = await response.json(); } catch { /* Non-JSON gateway failure. */ }
      diagnostic = Object.fromEntries(['code', 'stage', 'latency_ms', 'request_id', 'validation_reason', 'answer_contract', 'prompt_revision', 'model_latency_ms', 'model_input_bytes', 'model_output_bytes', 'max_output_tokens', 'input_tokens', 'output_tokens'].filter(k =>
        typeof body?.[k] === 'number' || (typeof body?.[k] === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(body[k]))
      ).map(k => [k, body[k]]));
      throw Error(`${stage} HTTP ${status}`);
    }
    return response.json();
  };
  try {
    const retrieval = await read(await transport(new URL(`/api/search?q=${encodeURIComponent(question)}&passages=1`, base), { signal: AbortSignal.timeout(30000) }));
    if (!retrieval.answer_available) throw Error('Answer capability is not enabled at this endpoint');
    const record_ids = [...new Set(retrieval.evidence.sources.map(s => s.record_id).filter(Boolean))];
    stage = 'answer'; status = null; requestId = null;
    const data = await read(await transport(new URL('/api/search/answer', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: question, record_ids }), signal: AbortSignal.timeout(30000) }));
    stage = 'contract';
    validateAnswer(data.answer, data.sources);
    return { question, latency_ms: Date.now() - started, request_id: requestId, contract: 'pass', expected_abstention: expectedAbstention, abstention_pass: !expectedAbstention || (data.answer.outcome === 'insufficient' && data.answer.next_step === null), data,
      human_review: { claims_supported: null, boundaries_preserved: null, question_answered_or_justified_abstention: null, next_step_useful_and_measurable: null, decision: 'unreviewed', notes: '' } };
  } catch (error) {
    return { question, contract: 'fail', stage, status, request_id: requestId, latency_ms: Date.now() - started, diagnostic, error: error.message };
  }
}
