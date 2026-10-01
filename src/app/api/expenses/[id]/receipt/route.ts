import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { extensionForMimeType, readReceiptFile, RECEIPT_FILE_TYPES } from "@/lib/receiptFiles"

async function getAuthorizedExpense(id: string, session: { user: { id: string; companyId: string; role: string } }) {
  const expense = await prisma.expense.findFirst({
    where: { id, companyId: session.user.companyId },
    include: { employee: { select: { managerId: true } } },
  })
  if (!expense) return null

  const canAccess =
    session.user.role === "ADMIN" ||
    expense.employeeId === session.user.id ||
    (session.user.role === "MANAGER" && expense.employee.managerId === session.user.id)

  return canAccess ? expense : false
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const expense = await getAuthorizedExpense(params.id, session)
  if (expense === null) return NextResponse.json({ error: "Expense not found" }, { status: 404 })
  if (expense === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const { buffer, mimeType } = await readReceiptFile(file, RECEIPT_FILE_TYPES)
    const storageKey = `${randomUUID()}.${extensionForMimeType(mimeType)}`
    const uploadDir = process.env.RECEIPT_STORAGE_DIR || join(process.cwd(), ".data", "receipts")

    await mkdir(uploadDir, { recursive: true })
    await writeFile(join(uploadDir, storageKey), buffer)

    const url = `/api/expenses/${params.id}/receipt/file`

    // Upsert receipt record
    const receipt = await prisma.receipt.upsert({
      where:  { expenseId: params.id },
      update: { url, storageKey, filename: file.name, mimeType, size: file.size },
      create: { expenseId: params.id, url, storageKey, filename: file.name, mimeType, size: file.size },
    })

    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Unsupported") || error.message.includes("File"))) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Receipt upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const expense = await getAuthorizedExpense(params.id, session)
  if (expense === null) return NextResponse.json({ error: "Expense not found" }, { status: 404 })
  if (expense === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const receipt = await prisma.receipt.findUnique({ where: { expenseId: params.id } })

  if (!receipt) return NextResponse.json(null)
  return NextResponse.json(receipt)
}
