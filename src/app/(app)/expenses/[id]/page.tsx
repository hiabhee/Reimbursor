import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { ApprovalAction, User } from "@prisma/client"
import Link from "next/link"
import { formatCurrency } from "@/lib/formatCurrency"
import { SubmitExpenseButton } from "@/components/SubmitExpenseButton"
import { ResubmitExpenseButton } from "@/components/ResubmitExpenseButton"
import { WorkflowTimeline } from "@/components/WorkflowTimeline"
import { AiExpenseReview } from "@/components/AiExpenseReview"
import { AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react"

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
    include: {
      employee: true,
      approvalActions: {
        include: { approver: true },
        orderBy: { stepOrder: "asc" },
      },
      adminOverrideBy: true,
    },
  })

  if (!expense) {
    notFound()
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { currency: true },
  })

  const canView =
    expense.employeeId === session.user.id ||
    session.user.role === "ADMIN" ||
    session.user.role === "MANAGER"

  const isOwner = expense.employeeId === session.user.id

  if (!canView) {
    redirect("/expenses")
  }

  const workflow = await prisma.approvalWorkflow.findFirst({
    where: {
      companyId: session.user.companyId,
      isActive: true,
    },
    include: {
      steps: {
        orderBy: { stepOrder: "asc" },
      },
    },
  })

  const stepGroups = new Map<number, (ApprovalAction & { approver: User })[]>()
  for (const action of expense.approvalActions) {
    const existing = stepGroups.get(action.stepOrder) || []
    existing.push(action)
    stepGroups.set(action.stepOrder, existing)
  }

  const timelineSteps: Array<{
    order: number
    name: string
    status: "ACTIVE" | "COMPLETED" | "PENDING"
    actions: Array<{
      approverId: string
      approverName: string
      action: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED"
      comment?: string
      actedAt?: string
    }>
  }> = Array.from(stepGroups.entries()).map(([order, actions]) => ({
    order,
    name: workflow?.steps.find(s => s.stepOrder === order)?.name || `Step ${order + 1}`,
    status:
      order === expense.currentWorkflowStep
        ? "ACTIVE"
        : order < expense.currentWorkflowStep
        ? "COMPLETED"
        : "PENDING",
    actions: actions.map(a => ({
      approverId: a.approver.id,
      approverName: a.approver.name,
      action: a.action,
      comment: a.comment || undefined,
      actedAt: a.actedAt?.toISOString(),
    })),
  }))

  const getStatusDisplay = () => {
    const statusConfig = {
      DRAFT: { label: "Draft", icon: Clock, color: "gray", bg: "bg-gray-100", text: "text-gray-700" },
      PENDING: { label: "Pending Approval", icon: Clock, color: "amber", bg: "bg-amber-100", text: "text-amber-700" },
      APPROVED: { label: "Approved", icon: CheckCircle2, color: "emerald", bg: "bg-emerald-100", text: "text-emerald-700" },
      REJECTED: { label: "Rejected", icon: XCircle, color: "red", bg: "bg-red-100", text: "text-red-700" },
    }
    const config = statusConfig[expense.status as keyof typeof statusConfig]
    const Icon = config.icon
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="o-breadcrumb">
        <Link href="/expenses" className="text-gray-400 text-[12px] hover:text-blue-600">Expenses</Link>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-[13px] font-semibold text-gray-800 truncate max-w-xs">{expense.description}</span>
        <div className="ml-auto flex items-center gap-2">
          {expense.status === "DRAFT" && isOwner && (
            <SubmitExpenseButton expenseId={expense.id} isDraft={true} />
          )}
          {expense.status === "REJECTED" && isOwner && (
            <ResubmitExpenseButton expenseId={expense.id} />
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 max-w-4xl space-y-4">

      {(session.user.role === "ADMIN" || session.user.role === "MANAGER") && expense.status === "PENDING" && (
        <AiExpenseReview expenseId={expense.id} />
      )}

      {expense.isAdminOverride && (
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800 text-[12px]">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Overridden by admin on {expense.adminOverrideAt?.toLocaleDateString()}.
            {expense.adminOverrideComment && <span> &ldquo;{expense.adminOverrideComment}&rdquo;</span>}
          </span>
        </div>
      )}

      {expense.status === "REJECTED" && (
        <div className="flex items-start gap-3 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-red-800 text-[12px]">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">This expense was rejected.</span>
            <p className="mt-1">
              You can edit the expense details and resubmit for approval.
            </p>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="o-container overflow-hidden">
        <div className="px-3 py-2 border-b" style={{ borderColor: "#dcdcdc", background: "#f7f7f7" }}>
          <span className="text-[12px] font-semibold text-gray-700">Expense Details</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x" style={{ borderColor: "#ebebeb" }}>
          {[
            { label: "Category", value: expense.category },
            { label: "Date", value: expense.date.toLocaleDateString() },
            { label: "Status", value: getStatusDisplay() },
            { label: "Submitted By", value: expense.employee.name },
          ].map((f) => (
            <div key={f.label} className="p-3">
              <p className="o-label mb-1">{f.label}</p>
              <p className="text-[13px] font-medium text-gray-900">{f.value}</p>
            </div>
          ))}
        </div>
        <div className="p-3 border-t" style={{ borderColor: "#ebebeb" }}>
          <p className="o-label mb-1">Amount</p>
          <p className="text-[20px] font-bold text-gray-900">
            {formatCurrency(Number(expense.convertedAmount), company?.currency || "USD")}
            <span className="text-[12px] font-normal text-gray-500 ml-2">({company?.currency || "USD"})</span>
          </p>
          {expense.submittedCurrency !== company?.currency && (
            <p className="text-[12px] text-gray-500 mt-0.5">
              Originally: {formatCurrency(Number(expense.submittedAmount), expense.submittedCurrency)}
            </p>
          )}
        </div>
      </div>

      {/* Approval Timeline */}
      {(expense.status === "PENDING" || expense.status === "APPROVED" || expense.status === "REJECTED") && (
        <div className="o-container overflow-hidden">
          <div className="px-3 py-2 border-b" style={{ borderColor: "#dcdcdc", background: "#f7f7f7" }}>
            <span className="text-[12px] font-semibold text-gray-700">Approval Workflow</span>
          </div>
          <div className="p-4">
            <WorkflowTimeline 
              steps={timelineSteps} 
              currentStep={expense.currentWorkflowStep}
              totalSteps={workflow?.steps.length || 0}
            />
          </div>
        </div>
      )}

      {/* Approval history */}
      {expense.status === "DRAFT" && (
        <div className="o-container overflow-hidden">
          <div className="px-3 py-2 border-b" style={{ borderColor: "#dcdcdc", background: "#f7f7f7" }}>
            <span className="text-[12px] font-semibold text-gray-700">Approval History</span>
          </div>
          <div className="o-empty">
            <Clock className="w-6 h-6 opacity-30" />
            <p className="text-[12px]">Submit this expense to start the approval process</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
