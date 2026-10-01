import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OCR_IMAGE_TYPES, readReceiptFile } from "@/lib/receiptFiles";
import { runTesseractOcr } from "@/lib/ocr";
import { extractReceiptFields } from "@/lib/ai/receiptExtractor";
import { aiConfig } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

// Tight per-user rate limit for the AI path (plan §11).
// 10 requests / minute / user. In-memory; resets automatically.
const AI_WINDOW_MS = 60_000;
const AI_MAX_REQUESTS = 10;
const aiHits = new Map<string, { count: number; resetAt: number }>();

function aiRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = aiHits.get(key);
  if (!entry || entry.resetAt < now) {
    aiHits.set(key, { count: 1, resetAt: now + AI_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > AI_MAX_REQUESTS;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (aiRateLimited(`ai-extract:${session.user.id}`)) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again in a minute.", fallback: true },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let buffer: Buffer;
    let mimeType: string;
    try {
      ({ buffer, mimeType } = await readReceiptFile(file, OCR_IMAGE_TYPES));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid file";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // 1. Tesseract OCR (kept as the base layer + fallback).
    // Worker path is fixed in src/lib/ocr.ts for Next.js bundling.
    const text = await runTesseractOcr(buffer);
    if (!text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from image" },
        { status: 422 }
      );
    }

    // 2. AI normalization + confidence scoring (falls back deterministically
    // on provider failure / disabled flag — never blocks the user).
    // Send the image to the vision-capable model for small files only.
    const SEND_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
    const outcome = await extractReceiptFields({
      ocrText: text,
      image:
        buffer.length <= SEND_IMAGE_MAX_BYTES
          ? { mimeType, base64: buffer.toString("base64") }
          : undefined,
    });
    const { data: ai, source, model, promptVersion, latencyMs } = outcome;

    // 3. Persist audit record. OcrExtraction supports a null expenseId, which
    // fits the pre-submit extraction flow (AiExpenseReview requires an
    // expenseId, so it is created later at expense-creation time).
    const extraction = await prisma.ocrExtraction.create({
      data: {
        companyId: session.user.companyId,
        userId: session.user.id,
        status: "COMPLETE",
        rawText: text.slice(0, 10000),
        result: {
          merchant: ai.merchant,
          description: ai.description ?? ai.merchant,
          amount: ai.amount,
          currency: ai.currency,
          date: ai.date,
          category: ai.category,
          confidence: ai.confidence,
          warnings: ai.warnings,
          source,
          provider: aiConfig.provider,
          model,
          promptVersion,
          latencyMs,
        },
        parserVersion: "ai-extraction-v1",
        completedAt: new Date(),
      },
      select: { id: true },
    });

    // 4. Return draft fields to the client. The employee must review and
    // submit — nothing is saved as an expense here.
    return NextResponse.json({
      description: ai.description ?? ai.merchant,
      merchant: ai.merchant,
      amount: ai.amount,
      currency: ai.currency,
      date: ai.date,
      category: ai.category,
      confidence: ai.confidence,
      warnings: ai.warnings,
      source,
      model,
      extractionId: extraction.id,
    });
  } catch (error) {
    console.error("AI extraction error:", error);
    return NextResponse.json(
      { error: "AI extraction failed", fallback: true },
      { status: 500 }
    );
  }
}
