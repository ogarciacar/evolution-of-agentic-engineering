// Only fixed categories and bounded numeric metadata leave the exception boundary.
// Codes: https://developers.cloudflare.com/workers-ai/platform/errors/
const categories = new Map([
  [3036, 'quota_exceeded'], [3040, 'capacity_exceeded'],
  [5018, 'access_denied'], [5016, 'model_agreement_required'],
  [3023, 'account_blocked'], [3041, 'access_denied'], [5035, 'paid_plan_required'],
  [5007, 'model_not_found'], [3042, 'invalid_model'],
  [5004, 'invalid_input'], [3003, 'incomplete_request'], [3006, 'request_too_large'],
  [5019, 'deprecated_sdk'], [5005, 'unsupported_lora'],
  [3007, 'provider_timeout'], [3008, 'provider_aborted'],
]);
const numeric = value => typeof value === 'number' && Number.isInteger(value) ? value : typeof value === 'string' && /^\d{3,5}$/.test(value) ? Number(value) : undefined;

export function providerDiagnostics(error) {
  // Workers bindings may expose a numeric property or prefix the message with it.
  // Do not serialize the message, stack, cause, headers, or arbitrary properties.
  const explicit = numeric(error?.code);
  const prefix = typeof error?.message === 'string' ? error.message.slice(0, 160).match(/^(?:(?:AiError|InferenceUpstreamError):\s*)*(\d{4,5}):/) : null;
  const code = explicit ?? (prefix ? Number(prefix[1]) : undefined);
  const status = numeric(error?.status) ?? numeric(error?.statusCode);
  const category = categories.get(code) ?? (error?.name === 'TypeError' ? 'integration_type_error' : 'unknown');
  return {
    provider_error_category: category,
    ...(code >= 1000 && code <= 99999 ? { provider_error_code: code } : {}),
    ...(status >= 400 && status <= 599 ? { provider_http_status: status } : {}),
  };
}
