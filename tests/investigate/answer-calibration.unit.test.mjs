import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { finalizeGeneratedAnswer } from '../../workers/ai-search/answer.js';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/answer-semantic-baseline.json', import.meta.url)));
function example(id, field, summary, uncertainty, step) {
  const data = baseline.cases.find(c => c.id === id);
  const source = data.sources[0], passage = source.passages.find(p => p.field === field);
  const citations = [`s1p${source.passages.indexOf(passage) + 1}`];
  return { sources: data.sources, generated: {
    outcome: 'answered', summary: { text: summary, citations },
    claims: [{ kind: 'observation', passage: citations[0] }],
    uncertainties: [uncertainty], next_step: { scope: 'Five comparable tasks in one repository', intervention: 'Use a revised context interface', comparison: 'Current interface with the same model and tests', measurement: { metric: 'Median task duration', unit: 'seconds', window: 'Task start to passing tests', guardrail: 'No failed tests or increased reviewer minutes' }, decision: step.decision, citations },
  } };
}
// Hand-authored calibration examples verify contract compatibility, NOT model quality.
// The live model must still be evaluated against the independent semantic rubric.
it('accepts a bounded comparative answer without demanding a universal causal claim', () => {
  const { sources, generated } = example('context', 'observed.5',
    'Atlassian reports that its iterated CLI configuration maintained quality while reducing task time and tokens relative to its MCP baseline.',
    'This first-party comparison is specific to one configuration and task family; bundled changes do not isolate each contribution or establish context as the universal limiting factor.',
    { action: 'Proposed trial: on one repository, run five comparable tasks through the current context interface and a batched variant, keeping the model and tests fixed.',
      measure: 'For each run, record seconds from task start to passing tests, tokens consumed, test results and reviewer minutes.',
      decision: { threshold: 'median task time falls with no failed tests or increase in reviewer minutes', if_true: 'continue the local trial with more tasks', if_false: 'inspect the traces before revising the interface' } });
  const answer = finalizeGeneratedAnswer(generated, sources);
  expect(answer.outcome).toBe('answered');
  expect(answer.claims[0].text).toContain('352 seconds to 325 seconds');
  expect(answer.next_step.decision_rule).toContain('otherwise inspect the traces');
});
it('accepts an attributed infrastructure description with uncertainty and a bounded next step', () => {
  const { sources, generated } = example('infrastructure', 'observed.1',
    'Cloudflare reports platform capabilities for authentication, routing and inference, a knowledge layer around Backstage and AGENTS.md, and an enforcement layer around review and engineering standards.',
    'This describes Cloudflare’s stack; it does not establish the isolated benefit of each layer or that every team needs the same stack.',
    { action: 'Proposed trial: choose one repository and compare five similar tasks using current instructions versus an updated repository guide, with the same model and verification checks.',
      measure: 'Record minutes from task start to passing checks, reviewer minutes and failed checks for each run.',
      decision: { threshold: 'median task time falls without more failed checks or reviewer minutes', if_true: 'retain the guide in this repository and extend the trial', if_false: 'revise the guide using the observed failures' } });
  expect(finalizeGeneratedAnswer(generated, sources).outcome).toBe('answered');
});
it('renders a measurement-only review investigation with a conditional local follow-up', () => {
  const live = JSON.parse(readFileSync(new URL('./fixtures/answer-human-review-v5.json', import.meta.url)));
  const sources = live.sources;
  const ref = (index, field) => `s${index + 1}p${sources[index].passages.findIndex(p => p.field === field) + 1}`;
  const generated = {
    outcome: 'insufficient',
    summary: { text: 'The records describe review controls and expert checkpoints, but do not establish which stage limits delivery on the same workload.', citations: [ref(0, 'observed.9'), ref(2, 'observed.3')] },
    claims: [], uncertainties: ['Comparable queue, reviewer-effort and check timings on the same changes are missing.'],
    next_step: {
      scope: 'One repository; a proposed sample of 20 comparable changes',
      intervention: 'Observe the current workflow without changing tools or review policy; record review queue waits, active reviewer time, checks and merge intervals, plus change arrivals and completions.',
      comparison: 'Compare stages on the same changes with task class and checks fixed; record overlaps separately and count elapsed intervals once.',
      measurement: { metric: 'Stage elapsed time, active reviewer time, arrivals and completions', unit: 'Minutes and changes', window: 'Ready for review to merge for each sampled change', guardrail: 'Existing required checks pass and approvals remain enforced' },
      decision: { threshold: 'review waiting is the largest elapsed stage with required checks passing and approvals enforced', if_true: 'investigate reviewer availability and queue scheduling in this repository', if_false: 'inspect the largest measured stage or collect more comparable observations if inconclusive' },
      citations: [ref(0, 'observed.9')],
    },
  };
  const answer = finalizeGeneratedAnswer(generated, sources);
  expect(answer.outcome).toBe('insufficient');
  expect(answer.next_step.action).toContain('without changing tools or review policy');
  expect(answer.next_step.measure).toContain('Minutes and changes');
  expect(answer.next_step.decision_rule).toContain('checks passing and approvals enforced');
  expect(answer.next_step.decision_rule).toContain('otherwise inspect the largest measured stage');
});
