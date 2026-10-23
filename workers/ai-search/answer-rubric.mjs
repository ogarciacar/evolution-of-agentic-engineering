// Review criteria, not a semantic classifier. Do not send these case expectations to generation.
export const RUBRIC_VERSION = 'eae_semantic_v3';
export const CRITERIA = {
  support: 'Each factual statement is supported by its cited passage, including summary and proposed rationale. An authentic quote alone is not support.',
  boundaries: 'Preserve attribution, scope and limitations. Do not turn infrastructure constraints into human-review constraints, or one record’s limitation into a corpus-wide absence.',
  responsiveness: 'Answer the question at its requested level. Descriptive questions do not require causal proof; acknowledge relevant comparative evidence without generalizing it.',
  next_step: 'A null next_step passes this criterion for descriptive or evidence-assessment questions, or when local context is insufficient; record why omission is appropriate. This does not excuse an unsupported or unresponsive answer. When the user requests a local investigation and supplies enough context, propose one small reversible experiment with a defined task/cohort, operational measurement, comparison and decision. The experiment must test the question’s uncertainty, name the current comparison condition and measurable quality guardrail, and include that guardrail in the decision. Do not substitute a documentation trial for a concurrency question, conflate different products, or use an absolute latency threshold as evidence of dominance. No vague significant improvement or organization-wide adoption. Never assume the user has access to a source organization’s internal systems. Sample completeness or positive reviewer capacity is not a quality guardrail. For unrelated questions, pass only with no experiment.',
};
export const ANSWER_CASES = [
  { id: 'cycle-time', question: 'Are coding agents actually reducing engineering cycle time?', expected_abstention: false,
    expectation: 'Distinguish adoption/activity, first-party local efficiency reports and end-to-end cycle time. A qualified answer or justified insufficiency can pass. Do not claim no organizational adoption when retrieved records report it. Cite limitations rather than unrelated access controls.' },
  { id: 'many-agents', question: 'What changes when teams go from one agent to many?', expected_abstention: false,
    expectation: 'Describe reported changes such as isolation, orchestration, dependencies and verification where supplied evidence supports them. Separate observed changes from unproven benefits. Do not require a comprehensive controlled study to describe changes.' },
  { id: 'human-review', question: 'Where does human review become the bottleneck?', expected_abstention: false,
    expectation: 'Distinguish review queue wait, reviewer effort and infrastructure latency. Do not infer human-review bottlenecks from Git write contention. Any experiment should measure the review process before choosing an intervention.' },
  { id: 'context', question: 'What evidence supports the claim that context is becoming the limiting factor?', expected_abstention: false,
    expectation: 'If the Atlassian design-system comparison is retrieved, acknowledge its same-agent/model comparison and reported task-time/token results. Preserve first-party, task-specific and bundled-intervention limits; it does not prove context is universally the dominant constraint.' },
  { id: 'infrastructure', question: 'What new infrastructure appears once agents become part of the engineering system?', expected_abstention: false,
    expectation: 'Describe attributed infrastructure examples when supplied, such as Cloudflare’s platform, knowledge and enforcement layers. This is a descriptive question; lack of isolated causal effects does not justify marking an otherwise supported description insufficient. No experiment is required for this descriptive question; do not invent access to the source organization’s infrastructure.' },
  { id: 'weather', question: 'What will the weather in Amsterdam be tomorrow?', expected_abstention: true,
    expectation: 'Abstain because the corpus is unrelated. No forecast and no engineering experiment. Relevant non-applicability passes the support and next-step criteria.' },
];
