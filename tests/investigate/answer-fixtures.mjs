export const record = {
  id: 'context', source: { title: 'A context report', producer: 'Example Engineering', producer_type: 'organization', date: '2026-09-01', type: 'engineering-blog', provenance: 'primary', url: 'https://example.com/report' },
  presentation: { headline: 'Context work', summary: 'A source report.' },
  observed: ['Engineers report spending time locating repository conventions.'],
  interpretation: 'Repository context may be a constraint.',
  what_this_does_not_establish: ['This does not establish a causal improvement in cycle time.'],
  model_implication: { verdict: 'INCONCLUSIVE', explanation: 'More measurement is needed.' },
  open_question: 'Does a context guide reduce unnecessary exploration?',
};
export function answerFor(sources) {
  const s = sources[0];
  const p = s.passages.find(p => p.field.startsWith('observed.'));
  const citations = [{ source_id: s.id, passage_id: p.id, quote: p.text }];
  return { outcome: 'answered', summary: { text: 'The report suggests investigating repository context before expanding agent use.', citations },
    claims: [{ kind: 'observation', text: 'Engineers report time spent locating conventions.', citations }],
    uncertainties: ['This is one organisation’s report, not a causal comparison.'],
    next_step: { action: 'Compare five similar tasks with and without a repository guide.', measure: 'Record unnecessary exploration calls and task completion quality.', decision_rule: 'Keep the guide if exploration decreases without reducing quality; otherwise revise it.', citations } };
}
export function rowFor(r = record) {
  return { evidence_id: r.id, github_path: `evidence/${r.id}.yaml`, source_title: r.source.title, source_date: r.source.date, producer: r.source.producer, producer_type: 'organization', source_type: r.source.type, provenance: r.source.provenance, source_url: r.source.url, headline: r.presentation.headline, summary: r.presentation.summary, observed_json: JSON.stringify(r.observed), interpretation: r.interpretation, limitations_json: JSON.stringify(r.what_this_does_not_establish), verdict: r.model_implication.verdict, verdict_explanation: r.model_implication.explanation, open_question: r.open_question, stages_json: '[]', conditions_json: '[]' };
}
export function fixtureEnv(run, overrides = {}) {
  return { ANSWER_ENABLED: 'true', ANSWER_RATE_LIMITER: { limit: async () => ({ success: true }) },
    EVIDENCE_DB: { prepare: () => ({ bind: (projection, id) => ({ first: async () => id === record.id && projection === 'main' ? rowFor() : null }) }) },
    AI: { run: run || (async (_model, input) => ({ response: answerFor(JSON.parse(input.messages[1].content).sources) })) }, ...overrides };
}
