import type { AiFindingSeverity, AiReviewType, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { aiConfig, promptVersionForFeature, type AiFeature } from "./config"
import { redactForAudit } from "./redaction"
import type { AiFinding } from "./schemas"

export interface StartReviewInput {
  expenseId: string
  companyId: string
  feature: AiFeature
  type: AiReviewType
  inputHash: string
}

export interface CompleteReviewInput {
  reviewId: string
  model: string
  result: unknown
  confidence?: Record<string, number> | null
  warnings?: string[] | null
  findings?: AiFinding[]
  latencyMs: number
}

export interface FailReviewInput {
  reviewId: string
  model: string
  error: string
  latencyMs: number
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  return value as Prisma.InputJsonValue
}

function normalizeSeverity(severity: string): AiFindingSeverity {
  if (severity === "BLOCKING" || severity === "WARNING") return severity
  return "INFO"
}

export async function startAiReview(input: StartReviewInput): Promise<string> {
  const review = await prisma.aiExpenseReview.create({
    data: {
      expenseId: input.expenseId,
      companyId: input.companyId,
      type: input.type,
      status: "PENDING",
      provider: aiConfig.provider,
      model: aiConfig.defaultModel,
      promptVersion: promptVersionForFeature(input.feature),
      inputHash: input.inputHash,
    },
    select: { id: true },
  })

  return review.id
}

export async function completeAiReview(input: CompleteReviewInput): Promise<void> {
  const findings = input.findings ?? []

  await prisma.$transaction([
    prisma.aiExpenseReview.update({
      where: { id: input.reviewId },
      data: {
        status: "COMPLETE",
        model: input.model,
        result: toJson(input.result),
        confidence: toJson(input.confidence),
        warnings: toJson(input.warnings),
        latencyMs: input.latencyMs,
        completedAt: new Date(),
      },
    }),
    ...(findings.length > 0
      ? [
          prisma.aiFinding.createMany({
            data: findings.map((finding) => ({
              reviewId: input.reviewId,
              code: finding.code,
              severity: normalizeSeverity(finding.severity),
              message: redactForAudit(finding.message, 500),
              evidence: finding.evidence ? redactForAudit(finding.evidence, 500) : null,
              confidence: finding.confidence,
            })),
          }),
        ]
      : []),
  ])
}

export async function failAiReview(input: FailReviewInput): Promise<void> {
  await prisma.aiExpenseReview.update({
    where: { id: input.reviewId },
    data: {
      status: "FAILED",
      model: input.model,
      error: redactForAudit(input.error, 500),
      latencyMs: input.latencyMs,
      completedAt: new Date(),
    },
  })
}

export async function recordAiFeedback(input: {
  reviewId: string
  userId: string
  decision: "ACCEPTED" | "EDITED" | "DISMISSED"
  changes?: unknown
}): Promise<void> {
  await prisma.aiFeedback.create({
    data: {
      reviewId: input.reviewId,
      userId: input.userId,
      decision: input.decision,
      changes: toJson(input.changes),
    },
  })
}
