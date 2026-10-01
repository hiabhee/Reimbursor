import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { OCR_IMAGE_TYPES, readReceiptFile } from "@/lib/receiptFiles"
import { runTesseractOcr } from "@/lib/ocr"

export const runtime = "nodejs"
export const maxDuration = 60

/* ─── Category keyword map ─────────────────────────────────── */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  MEALS:          ["restaurant", "cafe", "coffee", "lunch", "dinner", "breakfast", "food", "bar", "bistro", "pizza", "burger", "sushi", "grill", "kitchen", "eatery", "diner"],
  TRAVEL:         ["airline", "flight", "airport", "booking", "expedia", "train", "rail", "bus", "ticket", "boarding"],
  ACCOMMODATION:  ["hotel", "hilton", "marriott", "inn", "lodge", "resort", "motel", "hostel", "airbnb", "suite", "room", "stay", "accommodation"],
  TRANSPORTATION: ["uber", "lyft", "taxi", "cab", "grab", "bolt", "transit", "metro", "subway", "parking", "fuel", "petrol", "gas station", "toll"],
  SUPPLIES:       ["office", "stationery", "paper", "pen", "staples", "supplies", "depot", "print"],
  EQUIPMENT:      ["apple", "dell", "hp", "lenovo", "samsung", "monitor", "laptop", "keyboard", "mouse", "headset", "camera", "equipment", "hardware"],
}

/* ─── Currency symbol / code map ───────────────────────────── */
const CURRENCY_SYMBOLS: Record<string, string> = {
  "$":  "USD",
  "€":  "EUR",
  "£":  "GBP",
  "₹":  "INR",
  "¥":  "JPY",
  "₩":  "KRW",
  "₦":  "NGN",
  "₣":  "CHF",
  "A$": "AUD",
  "C$": "CAD",
  "S$": "SGD",
}

/* ─── Helpers ───────────────────────────────────────────────── */

function detectCurrency(text: string): string | null {
  const upper = text.toUpperCase()

  // Explicit 3-letter ISO code (e.g. "USD", "EUR")
  const isoMatch = upper.match(/\b(USD|EUR|GBP|INR|JPY|CNY|CAD|AUD|SGD|AED|CHF|BRL|MXN|ZAR|NGN|HKD|SEK|NOK|DKK|PLN|KRW)\b/)
  if (isoMatch) return isoMatch[1]

  // Symbol-based detection (longest match first)
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS).sort((a, b) => b[0].length - a[0].length)) {
    const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`${escaped}\\s*[\\d,]+(?:[.]\\d{1,2})?`).test(text)) return code
  }

  if (/\bR\s*[\d,]+(?:[.]\d{1,2})?\b/i.test(text)) return "ZAR"

  return null
}

function detectAmount(text: string): number | null {
  // Match patterns like: $12.50, 12.50, 1,234.56, 12,50 (European)
  const patterns = [
    /(?:grand\s*total|total|amount|sum|due|pay)[^\d]*?([\d.,]+(?:[.,]\d{1,2})?)/i,
    /(?:\$|€|£|₹|¥)\s*([\d,]+\.?\d{0,2})/,
    /([\d,]+\.\d{2})\s*(?:USD|EUR|GBP|INR|JPY|total)?/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const raw = normalizeNumber(match[1])
      const num = parseFloat(raw)
      if (!isNaN(num) && num > 0 && num < 1_000_000) return num
    }
  }

  // Fallback: find the largest number that looks like a price
  const allNumbers = Array.from(text.matchAll(/([\d.,]+[.,]\d{2})/g))
    .map((m) => parseFloat(normalizeNumber(m[1])))
    .filter((n) => n > 0 && n < 1_000_000)

  if (allNumbers.length > 0) return Math.max(...allNumbers)

  return null
}

function normalizeNumber(value: string): string {
  const cleaned = value.replace(/\s/g, "")
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  if (lastComma > lastDot) return cleaned.replace(/\./g, "").replace(",", ".")
  return cleaned.replace(/,/g, "")
}

function detectDate(text: string): string | null {
  const patterns = [
    // YYYY-MM-DD
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    // DD/MM/YYYY or MM/DD/YYYY
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
    // "Jan 12, 2024" or "12 Jan 2024"
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+(\d{4})/i,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})/i,
  ]

  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  }

  for (const pattern of patterns) {
    const m = text.match(pattern)
    if (!m) continue

    try {
      // YYYY-MM-DD
      if (m[0].match(/^\d{4}/)) {
        const [, y, mo, d] = m
        return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
      }
      // "12 Jan 2024"
      if (m[2] && isNaN(Number(m[2]))) {
        const month = monthMap[m[2].toLowerCase().slice(0, 3)]
        return `${m[3]}-${month}-${m[1].padStart(2, "0")}`
      }
      // "Jan 12, 2024"
      if (m[1] && isNaN(Number(m[1]))) {
        const month = monthMap[m[1].toLowerCase().slice(0, 3)]
        return `${m[3]}-${month}-${m[2].padStart(2, "0")}`
      }
      // Ambiguous numeric dates default to month/day; unambiguous values use the valid month/day.
      const [, a, , y] = m
      const aNum = parseInt(a)
      const b = m[2]
      if (aNum > 12) {
        return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`
      }
      return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`
    } catch {
      continue
    }
  }

  return null
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase()
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => ({
    category,
    score: keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? keyword.length : 0), 0),
  }))
  const best = scores.sort((a, b) => b.score - a.score)[0]
  if (best && best.score > 0) return best.category
  return "OTHER"
}

function detectMerchant(text: string): string | null {
  // First non-empty line is usually the merchant name on a receipt
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 2)
  if (lines.length === 0) return null

  // Skip lines that look like addresses or dates
  const skipPatterns = /^\d|receipt|invoice|tax|vat|total|amount|date|time|thank|welcome|www\.|http/i
  for (const line of lines.slice(0, 5)) {
    if (!skipPatterns.test(line) && line.length >= 3 && line.length <= 60) {
      return line
    }
  }
  return lines[0]
}

/* ─── Route handler ─────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const { buffer } = await readReceiptFile(file, OCR_IMAGE_TYPES)

    // Run Tesseract OCR (worker path fixed in src/lib/ocr.ts for Next.js)
    const text = await runTesseractOcr(buffer)

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from image" }, { status: 422 })
    }

    // Extract structured fields
    const amount   = detectAmount(text)
    const currency = detectCurrency(text)
    const date     = detectDate(text)
    const category = detectCategory(text)
    const merchant = detectMerchant(text)

    const result = {
      description: merchant,
      amount,
      currency,
      date,
      category,
      merchant,
      // Include raw text so the client can show confidence
      rawText: text.slice(0, 500),
    }

    const extraction = await prisma.ocrExtraction.create({
      data: {
        companyId: session.user.companyId,
        userId: session.user.id,
        status: "COMPLETE",
        rawText: text.slice(0, 10000),
        result,
        parserVersion: "ocr-v2",
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ ...result, extractionId: extraction.id })
  } catch (error) {
    if (error instanceof Error && (error.message === "Unsupported file type" || error.message.includes("File") || error.message.includes("content"))) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("OCR error:", error)
    return NextResponse.json({ error: "OCR processing failed" }, { status: 500 })
  }
}
