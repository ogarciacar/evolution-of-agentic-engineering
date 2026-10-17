export const EVALUATION_MODELS = Object.freeze({
  llama: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'gpt-oss': '@cf/openai/gpt-oss-120b',
});

// Only final answer text is validated or exposed; never use reasoning as an answer.
export function normalizeCandidateOutput(result) {
  const usage = result?.usage;
  const normalizedUsage = {
    prompt_tokens: usage?.prompt_tokens ?? usage?.input_tokens,
    completion_tokens: usage?.completion_tokens ?? usage?.output_tokens,
  };
  if (result?.status === 'incomplete') return { response: null, usage: normalizedUsage };
  if (result?.choices) {
    const choice = result.choices.length === 1 ? result.choices[0] : null;
    return { response: choice?.finish_reason === 'stop' && choice.message?.role === 'assistant' && !choice.message?.tool_calls && !choice.message?.refusal ? choice.message.content : null, usage: normalizedUsage };
  }
  if (Array.isArray(result?.output)) {
    const messages = result.output.filter(item => item.type === 'message' && item.role === 'assistant');
    const content = messages.length === 1 ? messages[0].content : null;
    return { response: Array.isArray(content) && content.length === 1 && content[0].type === 'output_text' ? content[0].text : null, usage: normalizedUsage };
  }
  return { response: result?.response ?? null, usage: normalizedUsage };
}
