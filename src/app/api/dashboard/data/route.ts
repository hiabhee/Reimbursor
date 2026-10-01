import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: userId, companyId, role } = session.user

  if (role === "ADMIN") {
    const [userCount, statusStats, expenseList, pendingApprovals] = await Promise.all([
      prisma.user.count({ where: { companyId } }),
      prisma.expense.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
        _sum: { convertedAmount: true },
      }),
      prisma.expense.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          employee: { select: { name: true, email: true } },
        },
      }),
      prisma.approvalAction.count({
        where: { approverId: userId, action: "PENDING" },
      }),
    ])

    const { statusCounts, statusTotals } = statusStats.reduce(
      (acc, s) => {
        acc.statusCounts[s.status] = s._count._all
        acc.statusTotals[s.status] = Number(s._sum.convertedAmount) || 0
        return acc
      },
      {
        statusCounts: { PENDING: 0, APPROVED: 0, REJECTED: 0, DRAFT: 0 } as Record<string, number>,
        statusTotals: { PENDING: 0, APPROVED: 0, REJECTED: 0, DRAFT: 0 } as Record<string, number>,
      }
    )

    return NextResponse.json({
      role: "ADMIN",
      userCount,
      pendingCount: statusCounts.PENDING || 0,
      approvedTotal: statusTotals.APPROVED || 0,
      pendingTotal: statusTotals.PENDING || 0,
      expenses: expenseList.map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        date: e.date,
        submittedAmount: Number(e.submittedAmount),
        submittedCurrency: e.submittedCurrency,
        convertedAmount: Number(e.convertedAmount),
        status: e.status,
        employee: e.employee,
        isAdminOverride: e.isAdminOverride,
      })),
      pendingApprovals,
    })
  }

  if (role === "MANAGER") {
    const [myExpenses, statusStats, pendingApprovals, approvedByMe, rejectedByMe] = await Promise.all([
      prisma.expense.findMany({
        where: { employeeId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.expense.groupBy({
        by: ["status"],
        where: { employeeId: userId },
        _count: { _all: true },
      }),
      prisma.approvalAction.findMany({
        where: { approverId: userId, action: "PENDING" },
        orderBy: { createdAt: "desc" },
        include: {
          expense: {
            include: { employee: { select: { name: true, email: true } } },
          },
        },
        take: 10,
      }),
      prisma.approvalAction.count({
        where: { approverId: userId, action: "APPROVED" },
      }),
      prisma.approvalAction.count({
        where: { approverId: userId, action: "REJECTED" },
      }),
    ])

    const statusCounts = statusStats.reduce(
      (acc: Record<string, number>, s: { status: string; _count: { _all: number } }) => {
        acc[s.status] = s._count._all
        return acc
      },
      { PENDING: 0, APPROVED: 0, REJECTED: 0, DRAFT: 0 } as Record<string, number>
    )

    return NextResponse.json({
      role: "MANAGER",
      pendingApprovalCount: pendingApprovals.length,
      approvedByMe,
      rejectedByMe,
      myExpenses: myExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        date: e.date,
        submittedAmount: Number(e.submittedAmount),
        submittedCurrency: e.submittedCurrency,
        convertedAmount: Number(e.convertedAmount),
        status: e.status,
      })),
      pendingApprovals: pendingApprovals.map((a) => ({
        id: a.expense.id,
        description: a.expense.description,
        category: a.expense.category,
        date: a.expense.date,
        submittedAmount: Number(a.expense.submittedAmount),
        submittedCurrency: a.expense.submittedCurrency,
        convertedAmount: Number(a.expense.convertedAmount),
        status: a.expense.status,
        employee: a.expense.employee,
      })),
      pendingCount: statusCounts.PENDING || 0,
      approvedCount: statusCounts.APPROVED || 0,
      rejectedCount: statusCounts.REJECTED || 0,
    })
  }

  const [expenses, stats, draftSum, pendingSum, approvedSum] = await Promise.all([
    prisma.expense.findMany({
      where: { employeeId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.expense.groupBy({
      by: ["status"],
      where: { employeeId: userId },
      _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: { employeeId: userId, status: "DRAFT" },
      _sum: { convertedAmount: true },
    }),
    prisma.expense.aggregate({
      where: { employeeId: userId, status: "PENDING" },
      _sum: { convertedAmount: true },
    }),
    prisma.expense.aggregate({
      where: { employeeId: userId, status: "APPROVED" },
      _sum: { convertedAmount: true },
    }),
  ])

  const statusCounts = stats.reduce(
    (acc: Record<string, number>, s: { status: string; _count: { _all: number } }) => {
      acc[s.status] = s._count._all
      return acc
    },
    { PENDING: 0, APPROVED: 0, REJECTED: 0, DRAFT: 0 } as Record<string, number>
  )

  return NextResponse.json({
    role: "EMPLOYEE",
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      date: e.date,
      submittedAmount: Number(e.submittedAmount),
      submittedCurrency: e.submittedCurrency,
      convertedAmount: Number(e.convertedAmount),
      status: e.status,
    })),
    draftCount: statusCounts.DRAFT || 0,
    pendingCount: statusCounts.PENDING || 0,
    approvedCount: statusCounts.APPROVED || 0,
    rejectedCount: statusCounts.REJECTED || 0,
    toSubmit: Number(draftSum._sum.convertedAmount) || 0,
    underValidation: Number(pendingSum._sum.convertedAmount) || 0,
    toBeReimbursed: Number(approvedSum._sum.convertedAmount) || 0,
  })
}
