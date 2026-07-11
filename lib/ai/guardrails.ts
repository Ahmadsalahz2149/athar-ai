/** Content guardrails v1 (pure). A banned-pattern scan that blocks export of
 * unsafe drafts. The list is intentionally conservative + extensible; a model
 * reviewer pass can be layered on later. */

const BANNED: { id: string; rx: RegExp }[] = [
  // Leaked secrets / PII in a draft should never be published.
  { id: "credit_card", rx: /\b(?:\d[ -]?){13,16}\b/ },
  { id: "email_leak", rx: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/ },
  { id: "api_key", rx: /\b(sk|pk|api|key|token)[-_][A-Za-z0-9]{16,}\b/i },
  // Obvious profanity markers (extend per market).
  { id: "profanity", rx: /(fuck|shit|بذيء|قذر)/i },
];

export type GuardResult = { ok: boolean; violations: string[] };

export function checkContent(text: string): GuardResult {
  const violations = BANNED.filter((b) => b.rx.test(text ?? "")).map((b) => b.id);
  return { ok: violations.length === 0, violations };
}
