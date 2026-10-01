import OpenAI from "openai"
import type { z } from "zod"
import { aiConfig, isAiFeatureEnabled, modelForFeature, promptVersionForFeature, type AiFeature } from "./config"
import { AiError, toAiError } from "./errors"
import { hashInput, redactForAudit } from "./redaction"
import { toJsonSchema } from "./schemas"

const globalForAi = globalThis as unknown as { aiClient: OpenAI | undefined }

export interface AiImageInput {
  mimeType: string
  base64: string
}

export interface StructuredCompletionArgs<T extends z.ZodType> {
  feature: AiFeature
  schema: T
  schemaName: string
  system: string
  user: string
  image?: AiImageInput
}

export interface StructuredCompletionResult<T> {
  data: T
  model: string
  promptVersion: string
  inputHash: string
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
}

function getClient(): OpenAI {
  if (!aiConfig.apiKey) {
    throw new AiError("AI_NOT_CONFIGURED", "AI provider is not configured")
  }

  if (!globalForAi.aiClient) {
    globalForAi.aiClient = new OpenAI({
      apiKey: aiConfig.apiKey,
      baseURL: aiConfig.baseUrl,
      timeout: aiConfig.requestTimeoutMs,
      maxRetries: aiConfig.maxRetries,
    })
  }

  return globalForAi.aiClient
}

export function assertAiFeatureEnabled(feature: AiFeature): void {
  if (!isAiFeatureEnabled(feature)) {
    throw new AiError("AI_FEATURE_DISABLED", `AI feature ${feature} is disabled`)
  }
}

function buildUserContent(user: string, image?: AiImageInput): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: user },
  ]

  if (image) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    })
  }

  return parts
}

export async function runStructuredCompletion<T extends z.ZodType>(
  args: StructuredCompletionArgs<T>
): Promise<StructuredCompletionResult<z.infer<T>>> {
  assertAiFeatureEnabled(args.feature)

  const model = modelForFeature(args.feature)
  const promptVersion = promptVersionForFeature(args.feature)
  const inputHash = hashInput(`${args.schemaName}:${model}:${promptVersion}:${args.user}`)
  const startedAt = Date.now()

  const client = getClient()

  let completion: OpenAI.Chat.Completions.ChatCompletion
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: aiConfig.maxOutputTokens,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: buildUserContent(args.user, args.image) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: args.schemaName,
          strict: true,
          schema: toJsonSchema(args.schema),
        },
      },
    })
  } catch (error) {
    throw toAiError(error)
  }

  const latencyMs = Date.now() - startedAt
  const choice = completion.choices[0]
  const message = choice?.message

  if (message?.refusal) {
    throw new AiError("AI_REFUSAL", "The AI model refused to process this input")
  }

  const content = message?.content?.trim()
  if (!content) {
    throw new AiError("AI_INVALID_RESPONSE", "The AI model returned an empty response")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new AiError(
      "AI_INVALID_RESPONSE",
      `The AI model returned malformed JSON: ${redactForAudit(content, 120)}`
    )
  }

  const result = args.schema.safeParse(parsed)
  if (!result.success) {
    throw new AiError(
      "AI_INVALID_RESPONSE",
      `The AI model returned a response that failed validation: ${redactForAudit(
        JSON.stringify(result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }))),
        300
      )}`
    )
  }

  return {
    data: result.data,
    model,
    promptVersion,
    inputHash,
    latencyMs,
    inputTokens: completion.usage?.prompt_tokens ?? null,
    outputTokens: completion.usage?.completion_tokens ?? null,
  }
}
