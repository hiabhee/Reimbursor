export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_FEATURE_DISABLED"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_REFUSAL"
  | "AI_INVALID_RESPONSE"
  | "AI_UNAVAILABLE"

export class AiError extends Error {
  readonly code: AiErrorCode
  readonly status: number
  readonly retryable: boolean

  constructor(
    code: AiErrorCode,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message)
    this.name = "AiError"
    this.code = code
    this.status = options.status ?? defaultStatusForCode(code)
    this.retryable = options.retryable ?? defaultRetryableForCode(code)
    if (options.cause !== undefined) this.cause = options.cause
  }
}

function defaultStatusForCode(code: AiErrorCode): number {
  switch (code) {
    case "AI_NOT_CONFIGURED":
    case "AI_FEATURE_DISABLED":
      return 503
    case "AI_TIMEOUT":
      return 504
    case "AI_RATE_LIMITED":
      return 429
    case "AI_REFUSAL":
    case "AI_INVALID_RESPONSE":
      return 502
    case "AI_UNAVAILABLE":
      return 502
  }
}

function defaultRetryableForCode(code: AiErrorCode): boolean {
  return code === "AI_TIMEOUT" || code === "AI_RATE_LIMITED" || code === "AI_UNAVAILABLE"
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError
}

export function toAiError(error: unknown): AiError {
  if (isAiError(error)) return error

  if (error instanceof Error) {
    if (error.name === "APIConnectionTimeoutError") {
      return new AiError("AI_TIMEOUT", "The AI request timed out", { cause: error })
    }

    const status = (error as { status?: number }).status
    if (typeof status === "number") {
      if (status === 429) {
        return new AiError("AI_RATE_LIMITED", "The AI provider is rate limiting requests", { cause: error })
      }
      if (status === 408) {
        return new AiError("AI_TIMEOUT", "The AI request timed out", { cause: error })
      }
      if (status >= 500) {
        return new AiError("AI_UNAVAILABLE", "The AI provider is temporarily unavailable", { cause: error })
      }
      return new AiError("AI_INVALID_RESPONSE", "The AI provider rejected the request", {
        status: 502,
        retryable: false,
        cause: error,
      })
    }
  }

  return new AiError("AI_UNAVAILABLE", "Unexpected AI failure", { cause: error })
}
