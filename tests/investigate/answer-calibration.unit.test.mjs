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
