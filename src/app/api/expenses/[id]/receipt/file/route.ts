import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { readFile } from "fs/promises"
import { join, basename } from "path"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const expense = await prisma.expense.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { employee: { select: { managerId: true } }, receipt: true },
  })
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 })

  const canAccess =
    session.user.role === "ADMIN" ||
    expense.employeeId === session.user.id ||
    (session.user.role === "MANAGER" && expense.employee.managerId === session.user.id)
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!expense.receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 })

  const storageDir = process.env.RECEIPT_STORAGE_DIR || join(process.cwd(), ".data", "receipts")
  const storageKey = expense.receipt.storageKey || basename(expense.receipt.url)

  try {
    const content = await readFile(join(storageDir, storageKey))
    return new Response(content, {
      headers: {
        "Content-Type": expense.receipt.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${expense.receipt.filename.replace(/[\"\r\n]/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Receipt file not found" }, { status: 404 })
  }
}
