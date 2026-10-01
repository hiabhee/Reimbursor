import {
  aiReceiptExtractionSchema,
  type AiReceiptExtraction,
} from "./schemas";
import {
  isAiFeatureEnabled,
  modelForFeature,
  promptVersionForFeature,
} from "./config";
import { runStructuredCompletion, type AiImageInput } from "./client";
import { AiError } from "./errors";
import {
  buildReceiptUserPrompt,
  RECEIPT_SYSTEM_PROMPT,
} from "./prompts/receipt";

export type ExtractionSource = "ai" | "fallback" | "disabled";

export interface ReceiptExtractionOutcome {
  data: AiReceiptExtraction;
  source: ExtractionSource;
  model: string | null;
  promptVersion: string | null;
  latencyMs: number;
}

export interface ExtractReceiptInput {
  ocrText: string;
  image?: AiImageInput;
}

/**
 * AI normalization + confidence scoring over Tesseract OCR text.
 * Never throws for AI failures: falls back to deterministic parsing so
 * receipt scanning keeps working when the provider is down/disabled.
 */
export async function extractReceiptFields(
  input: ExtractReceiptInput
): Promise<ReceiptExtractionOutcome> {
  const startedAt = Date.now();

  if (!isAiFeatureEnabled("EXTRACTION")) {
    return {
      data: deterministicExtraction(input.ocrText),
      source: "disabled",
      model: null,
      promptVersion: null,
      latencyMs: Date.now() - startedAt,
    };
  }

  try {
    const result = await runStructuredCompletion({
      feature: "EXTRACTION",
      schema: aiReceiptExtractionSchema,
      schemaName: "receipt_extraction",
      system: RECEIPT_SYSTEM_PROMPT,
      user: buildReceiptUserPrompt(input.ocrText),
      image: input.image,
    });

    return {
      data: result.data,
      source: "ai",
      model: result.model,
      promptVersion: result.promptVersion,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    if (error instanceof AiError && error.code === "AI_FEATURE_DISABLED") {
      return {
        data: deterministicExtraction(input.ocrText),
        source: "disabled",
        model: null,
        promptVersion: null,
        latencyMs: Date.now() - startedAt,
      };
    }
    // Provider error / refusal / invalid JSON -> deterministic fallback.
    // The caller persists source:"fallback" so the UI can show OCR-only mode.
    return {
      data: deterministicExtraction(input.ocrText),
      source: "fallback",
      model: modelForFeature("EXTRACTION"),
      promptVersion: promptVersionForFeature("EXTRACTION"),
      latencyMs: Date.now() - startedAt,
    };
  }
}

// ─── Deterministic fallback (mirrors src/app/api/ocr/route.ts) ───

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  MEALS: ["restaurant", "cafe", "coffee", "lunch", "dinner", "breakfast", "food", "bar", "bistro", "pizza", "burger", "sushi", "grill", "kitchen", "eatery", "diner"],
  TRAVEL: ["airline", "flight", "airport", "booking", "expedia", "train", "rail", "bus", "ticket", "boarding"],
  ACCOMMODATION: ["hotel", "hilton", "marriott", "inn", "lodge", "resort", "motel", "hostel", "airbnb", "suite", "room", "stay", "accommodation"],
  TRANSPORTATION: ["uber", "lyft", "taxi", "cab", "grab", "bolt", "transit", "metro", "subway", "parking", "fuel", "petrol", "gas station", "toll"],
  SUPPLIES: ["office", "stationery", "paper", "pen", "staples", "supplies", "depot", "print"],
  EQUIPMENT: ["apple", "dell", "hp", "lenovo", "samsung", "monitor", "laptop", "keyboard", "mouse", "headset", "camera", "equipment", "hardware"],
};

const ISO_CURRENCIES = /\b(USD|EUR|GBP|INR|JPY|CNY|CAD|AUD|SGD|AED|CHF|BRL|MXN|ZAR|NGN|HKD|SEK|NOK|DKK|PLN|KRW)\b/;

function fallbackCurrency(text: string): { value: string | null; confidence: number } {
  const iso = text.toUpperCase().match(ISO_CURRENCIES);
  if (iso) return { value: iso[1], confidence: 0.95 };
  if (/[$€£₹¥₩₦]/.test(text)) {
    const map: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY", "₩": "KRW", "₦": "NGN" };
    const sym = (text.match(/[$€£₹¥₩₦]/) ?? ["$"])[0];
    return { value: map[sym] ?? null, confidence: 0.6 };
  }
  return { value: null, confidence: 0.3 };
}

function normalizeNumber(value: string): string {
  const cleaned = value.replace(/\s/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) return cleaned.replace(/\./g, "").replace(",", ".");
  return cleaned.replace(/,/g, "");
}

function fallbackAmount(text: string): { value: number | null; confidence: number } {
  const m = text.match(/(?:grand\s*total|total|amount|sum|due|pay)[^\d]*?([\d.,]+(?:[.,]\d{1,2})?)/i);
  if (m) {
    const num = parseFloat(normalizeNumber(m[1]));
    if (!isNaN(num) && num > 0 && num < 1_000_000) return { value: num, confidence: 0.7 };
  }
  const all = Array.from(text.matchAll(/([\d.,]+[.,]\d{2})/g))
    .map((x) => parseFloat(normalizeNumber(x[1])))
    .filter((n) => n > 0 && n < 1_000_000);
  if (all.length > 0) return { value: Math.max(...all), confidence: 0.5 };
  return { value: null, confidence: 0.3 };
}

function fallbackDate(text: string): { value: string | null; confidence: number } {
  const m = text.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
    ?? text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!m) return { value: null, confidence: 0.3 };
  try {
    if (/^\d{4}/.test(m[0])) {
      return { value: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`, confidence: 0.7 };
    }
    const [, a, b, y] = m;
    if (parseInt(a) > 12) return { value: `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`, confidence: 0.6 };
    return { value: `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`, confidence: 0.6 };
  } catch {
    return { value: null, confidence: 0.3 };
  }
}

function fallbackCategory(text: string): { value: AiReceiptExtraction["category"]; confidence: number } {
  const lower = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = kws.reduce((s, k) => s + (lower.includes(k) ? k.length : 0), 0);
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  if (!best) return { value: "OTHER", confidence: 0.4 };
  return {
    value: best as AiReceiptExtraction["category"],
    confidence: bestScore > 10 ? 0.75 : 0.55,
  };
}

function fallbackMerchant(text: string): { value: string | null; confidence: number } {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 2);
  if (lines.length === 0) return { value: null, confidence: 0.2 };
  const skip = /^\d|receipt|invoice|tax|vat|total|amount|date|time|thank|welcome|www\.|http/i;
  for (const line of lines.slice(0, 5)) {
    if (!skip.test(line) && line.length >= 3 && line.length <= 60) {
      return { value: line, confidence: 0.6 };
    }
  }
  return { value: lines[0].slice(0, 120), confidence: 0.4 };
}

export function deterministicExtraction(ocrText: string): AiReceiptExtraction {
  const amount = fallbackAmount(ocrText);
  const currency = fallbackCurrency(ocrText);
  const date = fallbackDate(ocrText);
  const category = fallbackCategory(ocrText);
  const merchant = fallbackMerchant(ocrText);
  return {
    merchant: merchant.value,
    description: merchant.value,
    amount: amount.value,
    currency: currency.value,
    date: date.value,
    category: category.value,
    confidence: {
      merchant: merchant.confidence,
      amount: amount.confidence,
      currency: currency.confidence,
      date: date.confidence,
      category: category.confidence,
    },
    warnings: ["AI extraction unavailable — used OCR keyword fallback"],
  };
}
