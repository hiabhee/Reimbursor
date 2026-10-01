import { z } from "zod"

export const aiExpenseCategories = [
  "TRAVEL",
  "MEALS",
  "ACCOMMODATION",
  "TRANSPORTATION",
  "SUPPLIES",
  "EQUIPMENT",
  "OTHER",
] as const

export const aiFindingSeverities = ["INFO", "WARNING", "BLOCKING"] as const

const confidence = z.number().min(0).max(1)
const optionalText = z.string().max(2000).nullable()

export const aiReceiptExtractionSchema = z.object({
  merchant: optionalText,
  description: optionalText,
  amount: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  category: z.enum(aiExpenseCategories).nullable(),
  confidence: z.object({
    merchant: confidence,
    amount: confidence,
    currency: confidence,
    date: confidence,
    category: confidence,
  }),
  warnings: z.array(z.string().max(300)),
})

export const aiFindingSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[A-Z0-9_]+$/, "Finding code must be SCREAMING_SNAKE_CASE"),
  severity: z.enum(aiFindingSeverities),
  message: z.string().min(1).max(500),
  evidence: optionalText,
  confidence: confidence,
})

export const aiExpenseValidationSchema = z.object({
  status: z.enum(["PASS", "REVIEW_REQUIRED", "BLOCKED"]),
  summary: z.string().min(1).max(600),
  findings: z.array(aiFindingSchema).max(20),
})

export const aiApprovalSummarySchema = z.object({
  headline: z.string().min(1).max(200),
  policyChecks: z.array(z.string().max(300)).max(10),
  findings: z.array(aiFindingSchema).max(20),
  recommendation: z.enum(["APPROVE", "REJECT", "REQUEST_CLARIFICATION"]),
  recommendationReason: z.string().min(1).max(500),
})

export const aiAssistantReplySchema = z.object({
  answer: z.string().min(1).max(3000),
  suggestedQuestions: z.array(z.string().max(160)).max(4),
})

export type AiReceiptExtraction = z.infer<typeof aiReceiptExtractionSchema>
export type AiFinding = z.infer<typeof aiFindingSchema>
export type AiExpenseValidation = z.infer<typeof aiExpenseValidationSchema>
export type AiApprovalSummary = z.infer<typeof aiApprovalSummarySchema>
export type AiAssistantReply = z.infer<typeof aiAssistantReplySchema>
export type AiExpenseCategory = (typeof aiExpenseCategories)[number]

export const LOW_CONFIDENCE_THRESHOLD = 0.6

export function confidenceBand(value: number): "HIGH" | "MEDIUM" | "LOW" {
  if (value >= 0.85) return "HIGH"
  if (value >= LOW_CONFIDENCE_THRESHOLD) return "MEDIUM"
  return "LOW"
}

export function lowConfidenceFields(confidence: Record<string, number>): string[] {
  return Object.entries(confidence)
    .filter(([, value]) => value < LOW_CONFIDENCE_THRESHOLD)
    .map(([field]) => field)
}

export function toJsonSchema<T extends z.ZodType>(schema: T): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: "output" }) as Record<string, unknown>
}
