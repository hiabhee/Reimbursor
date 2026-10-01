import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { expenseSchema } from "@/lib/validations"
import { completeAiReview, recordAiFeedback, startAiReview } from "@/lib/ai/audit"
import { hashInput } from "@/lib/ai/redaction"

// Persist AI extraction output as an auditable review once the expense
// exists (AiExpenseReview requires an expenseId). Records whether the
// employee accepted or edited the AI suggestion.
async function persistAiExtractionReview(args: {
  expenseId: string
  companyId: string
  userId: string
  extractionResult: unknown
  submitted: Record<string, unknown>
}) {
  const result = args.extractionResult as {
    source?: string
    model?: string | null
    confidence?: Record<string, number> | null
    warnings?: string[] | null
    merchant?: unknown
    description?: unknown
    amount?: unknown
    currency?: unknown
    date?: unknown
    category?: unknown
  } | null
  if (!result || result.source !== "ai") return

  const startedAt = Date.now()
  let reviewId: string
  try {
    reviewId = await startAiReview({
      expenseId: args.expenseId,
      companyId: args.companyId,
      feature: "EXTRACTION",
      type: "EXTRACTION",
      inputHash: hashInput(JSON.stringify(result)),
    })
  } catch {
    return
  }

  const aiFields = {
    merchant: result.merchant,
    description: result.description,
    amount: result.amount,
    currency: result.currency,
    date: result.date,
    category: result.category,
  }
  await completeAiReview({
    reviewId,
    model: result.model ?? "unknown",
    result: aiFields,
    confidence:
      result.confidence && typeof result.confidence === "object"
        ? (result.confidence as Record<string, number>)
        : null,
    warnings: Array.isArray(result.warnings) ? result.warnings : null,
    latencyMs: Date.now() - startedAt,
  })

  const suggestion: Record<string, unknown> = {
    description: result.description ?? result.merchant,
    merchant: result.merchant,
    amount: result.amount,
    currency: result.currency,
    date: result.date,
    category: result.category,
  }
  const changes: Record<string, { suggested: unknown; submitted: unknown }> = {}
  for (const [key, suggested] of Object.entries(suggestion)) {
    const submitted = args.submitted[key]
    if (
      submitted !== undefined &&
      String(submitted ?? "") !== String(suggested ?? "")
    ) {
      changes[key] = { suggested, submitted }
    }
  }

  await recordAiFeedback({
    reviewId,
    userId: args.userId,
    decision: Object.keys(changes).length === 0 ? "ACCEPTED" : "EDITED",
    changes: Object.keys(changes).length === 0 ? undefined : changes,
  })
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { currency: true },
  })

  let whereClause: { companyId: string; employeeId?: { in: string[] } | string } = {
    companyId: session.user.companyId,
  }

  if (session.user.role === "EMPLOYEE") {
    whereClause = {
      companyId: session.user.companyId,
      employeeId: session.user.id,
    }
  } else if (session.user.role === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: {
        companyId: session.user.companyId,
        managerId: session.user.id,
      },
      select: { id: true },
    })
    whereClause = {
      companyId: session.user.companyId,
      employeeId: { in: [session.user.id, ...reports.map((r) => r.id)] },
    }
  }

  const expenses = await prisma.expense.findMany({
    where: whereClause,
    include: {
      employee: { select: { id: true, name: true, email: true } },
      approvalActions: {
        include: { approver: { select: { id: true, name: true } } },
        orderBy: { stepOrder: "asc" },
      },
      receipt: { select: { id: true, url: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    expenses,
    companyCurrency: company?.currency || "USD",
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    
    const parsed = expenseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { description, category, date, submittedAmount, submittedCurrency, exchangeRate, ocrExtractionId } = parsed.data

    if (ocrExtractionId) {
      const extraction = await prisma.ocrExtraction.findFirst({
        where: {
          id: ocrExtractionId,
          companyId: session.user.companyId,
          userId: session.user.id,
          expenseId: null,
        },
        select: { id: true, result: true },
      })
      if (!extraction) {
        return NextResponse.json({ error: "Invalid or expired OCR extraction" }, { status: 400 })
      }
    }

    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
    })

    if (!company) {
      // Re-fetch user in case session is stale
      const freshUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { companyId: true },
      })
      if (!freshUser?.companyId) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 })
      }
      const freshCompany = await prisma.company.findUnique({
        where: { id: freshUser.companyId },
      })
      if (!freshCompany) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 })
      }
      // Use fresh companyId
      const convertedAmount = submittedAmount * exchangeRate
      const expense = await prisma.expense.create({
        data: {
          description,
          category,
          date: new Date(date),
          submittedAmount,
          submittedCurrency,
          convertedAmount,
          exchangeRate,
          companyId: freshUser.companyId,
          employeeId: session.user.id,
          status: "DRAFT",
        },
      })
      if (ocrExtractionId) {
        const linked = await prisma.ocrExtraction.findUnique({
          where: { id: ocrExtractionId },
          select: { result: true },
        })
        await prisma.ocrExtraction.update({ where: { id: ocrExtractionId }, data: { expenseId: expense.id } })
        await persistAiExtractionReview({
          expenseId: expense.id,
          companyId: freshUser.companyId,
          userId: session.user.id,
          extractionResult: linked?.result,
          submitted: {
            description,
            amount: submittedAmount,
            currency: submittedCurrency,
            date,
            category,
          },
        })
      }
      return NextResponse.json(expense, { status: 201 })
    }

    const convertedAmount = submittedAmount * exchangeRate

    const expense = await prisma.expense.create({
      data: {
        description,
        category,
        date: new Date(date),
        submittedAmount,
        submittedCurrency,
        convertedAmount,
        exchangeRate,
        companyId: session.user.companyId,
        employeeId: session.user.id,
        status: "DRAFT",
      },
    })

    if (ocrExtractionId) {
      const linked = await prisma.ocrExtraction.findUnique({
        where: { id: ocrExtractionId },
        select: { result: true },
      })
      await prisma.ocrExtraction.update({ where: { id: ocrExtractionId }, data: { expenseId: expense.id } })
      await persistAiExtractionReview({
        expenseId: expense.id,
        companyId: session.user.companyId,
        userId: session.user.id,
        extractionResult: linked?.result,
        submitted: {
          description,
          amount: submittedAmount,
          currency: submittedCurrency,
          date,
          category,
        },
      })
    }

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error("Error creating expense:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
