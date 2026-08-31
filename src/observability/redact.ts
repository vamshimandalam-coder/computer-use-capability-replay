const sensitive =
  /pass(word)?|secret|token|cookie|authorization|member.?id|account|ssn|email|phone/i;
export function redact(value: unknown, key = ''): unknown {
  if (sensitive.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((v) => redact(v, key));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  return value;
}
