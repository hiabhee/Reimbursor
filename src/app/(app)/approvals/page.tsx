import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApprovalTable } from "@/components/ApprovalTable"

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const [pendingApprovals, company] = await Promise.all([
    prisma.approvalAction.findMany({
      where: { approverId: session.user.id, action: "PENDING" },
      include: {
        expense: {
          include: { employee: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { currency: true },
    }),
  ])

  return (
    <ApprovalTable
      approvals={pendingApprovals.map((a) => ({
        ...a.expense,
        submittedAmount: Number(a.expense.submittedAmount),
        convertedAmount: Number(a.expense.convertedAmount),
        date: a.expense.date.toISOString(),
        approvalActions: [],
      }))}
      companyCurrency={company?.currency || "USD"}
      viewerRole={session.user.role as "ADMIN" | "MANAGER"}
    />
  )
}
