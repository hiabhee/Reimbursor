import type { AiReviewType } from "@prisma/client"

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1"

export type AiFeature =
  | "EXTRACTION"
  | "VALIDATION"
  | "APPROVAL_SUMMARY"
  | "ASSISTANT"

const FEATURE_ENV_KEYS: Record<AiFeature, string> = {
  EXTRACTION: "AI_EXPENSE_EXTRACTION_ENABLED",
  VALIDATION: "AI_EXPENSE_VALIDATION_ENABLED",
  APPROVAL_SUMMARY: "AI_APPROVAL_SUMMARY_ENABLED",
  ASSISTANT: "AI_ASSISTANT_ENABLED",
}

const FEATURE_REVIEW_TYPE: Record<AiFeature, AiReviewType> = {
  EXTRACTION: "EXTRACTION",
  VALIDATION: "VALIDATION",
  APPROVAL_SUMMARY: "SUMMARY",
  ASSISTANT: "SUMMARY",
}

function readFlag(key: string): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === "") return false
  return raw === "true" || raw === "1"
}

function readPositiveInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function readModel(key: string, fallback: string): string {
  const raw = process.env[key]
  return raw && raw.trim() ? raw.trim() : fallback
}

export const aiConfig = {
  provider: process.env.AI_PROVIDER ?? "groq",
  baseUrl: process.env.AI_BASE_URL || GROQ_BASE_URL,
  apiKey: process.env.GROQ_API_KEY ?? "",
  defaultModel: readModel("AI_DEFAULT_MODEL", "openai/gpt-oss-120b"),
  extractionModel: process.env.AI_EXTRACTION_MODEL || undefined,
  validationModel: process.env.AI_VALIDATION_MODEL || undefined,
  summaryModel: process.env.AI_SUMMARY_MODEL || undefined,
  assistantModel: process.env.AI_ASSISTANT_MODEL || undefined,
  requestTimeoutMs: readPositiveInt("AI_REQUEST_TIMEOUT_MS", 45_000),
  maxRetries: readPositiveInt("AI_MAX_RETRIES", 2),
  maxOutputTokens: readPositiveInt("AI_MAX_OUTPUT_TOKENS", 2_000),
  logRawText: process.env.AI_LOG_RAW_TEXT === "true" && process.env.NODE_ENV === "development",
} as const

export type AiConfig = typeof aiConfig

export function isAiFeatureEnabled(feature: AiFeature): boolean {
  if (!aiConfig.apiKey) return false
  if (process.env.AI_ENABLED === "false") return false
  return readFlag(FEATURE_ENV_KEYS[feature])
}

export function reviewTypeForFeature(feature: AiFeature): AiReviewType {
  return FEATURE_REVIEW_TYPE[feature]
}

export function modelForFeature(feature: AiFeature): string {
  switch (feature) {
    case "EXTRACTION":
      return aiConfig.extractionModel || aiConfig.defaultModel
    case "VALIDATION":
      return aiConfig.validationModel || aiConfig.defaultModel
    case "APPROVAL_SUMMARY":
      return aiConfig.summaryModel || aiConfig.defaultModel
    case "ASSISTANT":
      return aiConfig.assistantModel || aiConfig.defaultModel
  }
}

export function promptVersionForFeature(feature: AiFeature): string {
  return `${feature.toLowerCase()}_v1`
}
