// Structural completeness only. Relevance, entailment and measurement validity
// still require semantic review against the question and canonical evidence.
const text = maxLength => ({ type: 'string', minLength: 1, maxLength });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const DIAGNOSIS_SCHEMA = object({
  mode: { type: 'string', enum: ['diagnose'] },
  scope: text(60),
  sample: object({ count: { type: 'integer', minimum: 1, maximum: 100 }, selection: text(80) }),
  window: text(40),
  stages: { type: 'array', minItems: 2, maxItems: 4, items: object({
    name: text(20), kind: { type: 'string', enum: ['waiting', 'processing'] },
    start: text(35), end: text(35),
  }) },
  active_effort: object({ activity: text(30), method: text(60) }),
  flow: object({ unit: text(20), arrivals: text(30), completions: text(30) }),
  overlap: { type: 'string', enum: ['record_separately_do_not_sum'] },
  guardrail: object({ check: text(50), acceptance: text(50) }),
  decision: object({ focus_stage: text(20), basis: { type: 'string', enum: ['relative_elapsed_time'] }, if_true: text(100), if_false: text(100) }),
  citations: { type: 'array', minItems: 1, maxItems: 3, items: text(16) },
});
export function validateDiagnosis(step, invalid) {
  const names = step.stages.map(s => s.name.trim().toLowerCase());
  if (new Set(names).size !== names.length || !names.includes(step.decision.focus_stage.trim().toLowerCase()))
    invalid('diagnosis_stage_invalid', 'Diagnosis requires unique stages and an existing focus stage', 'next_step');
  if (!step.stages.some(s => s.kind === 'waiting') || !step.stages.some(s => s.kind === 'processing'))
    invalid('diagnosis_stage_invalid', 'Diagnosis must distinguish waiting and processing intervals', 'next_step');
  if (step.stages.some(s => s.start.trim().toLowerCase() === s.end.trim().toLowerCase()))
    invalid('diagnosis_stage_invalid', 'Stage start and end must differ', 'next_step');
}
export function renderDiagnosis(step) {
  const clean = t => t.trim().replace(/\s+/g, ' ').replace(/\.+$/, '');
  const intervals = step.stages.map(s => `${clean(s.name)} (${s.kind}): ${clean(s.start)} → ${clean(s.end)}`).join('; ');
  const quality = `${clean(step.guardrail.check)}: ${clean(step.guardrail.acceptance)}`;
  return {
    action: `Proposed diagnosis — ${clean(step.scope)}; proposed sample: ${step.sample.count} ${clean(step.sample.selection)}. Observe current workflow; keep checks and approvals. Same-sample stages: ${intervals}.`,
    measure: `Window: ${clean(step.window)}. Stage elapsed minutes; active minutes: ${clean(step.active_effort.activity)} via ${clean(step.active_effort.method)}. ${clean(step.flow.unit)}: arrivals at ${clean(step.flow.arrivals)}; completions at ${clean(step.flow.completions)}. Record overlaps separately; do not sum overlapping elapsed times or add active effort. Check: ${quality}.`,
    decision_rule: `If ${clean(step.decision.focus_stage)} has the largest median elapsed time on the same sample and ${quality}, ${clean(step.decision.if_true)}; otherwise ${clean(step.decision.if_false)}`,
  };
}
