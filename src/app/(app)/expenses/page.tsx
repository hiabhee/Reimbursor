import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ExpenseTable } from "@/components/ExpenseTable"

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [expenses, company] = await Promise.all([
    prisma.expense.findMany({
      where: { employeeId: session.user.id },
      include: { employee: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { currency: true },
    }),
  ])

  return (
    <ExpenseTable
      expenses={expenses.map((e) => ({
        ...e,
        submittedAmount: Number(e.submittedAmount),
        convertedAmount: Number(e.convertedAmount),
        date: e.date.toISOString(),
      }))}
      companyCurrency={company?.currency || "USD"}
      viewerRole={session.user.role as "ADMIN" | "MANAGER" | "EMPLOYEE"}
    />
  )
}
