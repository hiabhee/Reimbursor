import { createHash } from "crypto"

const REDACTED = "[REDACTED]"

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /sk-[A-Za-z0-9_-]{8,}/g, replacement: REDACTED },
  { pattern: /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: `Bearer ${REDACTED}` },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: REDACTED },
  { pattern: /\b(password|passwd|secret|token|api[_-]?key|authorization)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, replacement: `$1$2${REDACTED}` },
  { pattern: /\b(?:\d[ -]*?){13,19}\b/g, replacement: REDACTED },
]

const CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/

export function redactSecrets(input: string): string {
  let output = input
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    output = output.replace(pattern, replacement)
  }
  return output
}

export function containsCardLikeData(input: string): boolean {
  return CARD_LIKE.test(input)
}

export function truncateForAudit(value: string, maxLength = 500): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…[truncated ${value.length - maxLength} chars]`
}

export function redactForAudit(input: string, maxLength = 500): string {
  return truncateForAudit(redactSecrets(input), maxLength)
}

export function hashInput(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}
