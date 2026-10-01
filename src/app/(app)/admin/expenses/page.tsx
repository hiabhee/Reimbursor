import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AdminExpenseTable } from "@/components/AdminExpenseTable"
import { PageIntro, PageShell } from "@/components/ui/page-shell"

type AdminExpenseRecord = {
  id: string
  description: string
  category: string
  date: Date
  submittedAmount: unknown
  submittedCurrency: string
  convertedAmount: unknown
  status: string
  employee: { name: string; email: string }
  isAdminOverride: boolean
  adminOverrideAt: Date | null
  adminOverrideComment: string | null
}

export default async function AdminExpensesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const [expenses, company, employees] = await Promise.all([
    prisma.expense.findMany({
      where: { companyId: session.user.companyId },
      include: { employee: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { currency: true, name: true },
    }),
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      select: { id: true, name: true, email: true },
    }),
  ])

  return (
    <PageShell>
      <PageIntro
        eyebrow="Administration"
        title="All Expenses"
        description={`Review and manage expenses across ${company?.name || "your company"}.`}
      />
      <AdminExpenseTable
        expenses={expenses.map((e: AdminExpenseRecord) => ({
          id: e.id,
          description: e.description,
          category: e.category,
          date: e.date.toISOString(),
          submittedAmount: Number(e.submittedAmount),
          submittedCurrency: e.submittedCurrency,
          convertedAmount: Number(e.convertedAmount),
          status: e.status,
          employee: e.employee,
          isAdminOverride: e.isAdminOverride,
          adminOverrideAt: e.adminOverrideAt?.toISOString() || null,
          adminOverrideComment: e.adminOverrideComment,
        }))}
        companyCurrency={company?.currency || "USD"}
        employees={employees}
      />
    </PageShell>
  )
}
