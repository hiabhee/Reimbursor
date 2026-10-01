"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/formatCurrency"
import { EnterpriseTable, EnterpriseColumn } from "@/components/ui/enterprise-table"
import { EnterpriseToolbar } from "@/components/ui/enterprise-toolbar"
import { TablePagination } from "@/components/ui/table-pagination"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { PageIntro, PageShell } from "@/components/ui/page-shell"
import {
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  X,
} from "lucide-react"

interface Expense {
  id: string
  description: string
  category: string
  date: string
  submittedAmount: number
  submittedCurrency: string
  convertedAmount: number
  status: string
  employee: { id: string; name: string; email: string }
  approvalActions: { id: string; action: string; stepOrder: number; approver: { id: string; name: string } }[]
}

interface ApprovalTableProps {
  approvals: Expense[]
  companyCurrency: string
  viewerRole: "ADMIN" | "MANAGER" | "EMPLOYEE"
}

const PAGE_SIZE = 20

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

const CATEGORY_COLORS: Record<string, string> = {
  Travel:        "bg-violet-100 text-violet-700",
  Meals:         "bg-orange-100 text-orange-700",
  Accommodation: "bg-blue-100 text-blue-700",
  Equipment:     "bg-cyan-100 text-cyan-700",
  Software:      "bg-indigo-100 text-indigo-700",
  Training:      "bg-pink-100 text-pink-700",
  Other:         "bg-gray-100 text-gray-600",
}

function categoryClass(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other
}

export function ApprovalTable({ approvals, companyCurrency }: ApprovalTableProps) {
  const router = useRouter()

  const [search, setSearch]           = useState("")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [page, setPage]               = useState(1)
  const [acting, setActing]           = useState<string | null>(null)

  async function handleAction(expenseId: string, action: "APPROVED" | "REJECTED") {
    setActing(expenseId)
    try {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId, action }),
      })
      router.refresh()
    } finally {
      setActing(null)
    }
  }

  async function handleBulkApprove() {
    if (!confirm(`Approve ${selectedKeys.size} expense(s)?`)) return
    await Promise.all(Array.from(selectedKeys).map((id) => handleAction(id, "APPROVED")))
    setSelectedKeys(new Set())
  }

  async function handleBulkReject() {
    if (!confirm(`Reject ${selectedKeys.size} expense(s)?`)) return
    await Promise.all(Array.from(selectedKeys).map((id) => handleAction(id, "REJECTED")))
    setSelectedKeys(new Set())
  }

  const filtered = useMemo(() => {
    if (!search) return approvals
    const q = search.toLowerCase()
    return approvals.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.employee.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    )
  }, [approvals, search])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: EnterpriseColumn<Expense>[] = [
    {
      key: "employee",
      header: "Employee",
      className: "min-w-[130px]",
      cell: (e) => (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
            {initials(e.employee.name)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">{e.employee.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{e.employee.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "min-w-[160px]",
      cell: (e) => (
        <span className="font-medium text-foreground truncate block">{e.description}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      className: "w-[110px]",
      cell: (e) => (
        <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded", categoryClass(e.category))}>
          {e.category}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      className: "w-[90px] tabular-nums",
      cell: (e) => (
        <span className="text-muted-foreground text-[12px]">
          {new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "w-[110px] tabular-nums",
      cell: (e) => (
        <div className="text-right">
          <span className="font-bold text-foreground">{formatCurrency(e.convertedAmount, companyCurrency)}</span>
          {e.submittedCurrency !== companyCurrency && (
            <div className="text-[11px] text-muted-foreground">
              {formatCurrency(e.submittedAmount, e.submittedCurrency)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[110px]",
      cell: (e) => <StatusPill status={e.status} />,
    },
  ]

  const rowActions = (e: Expense) => (
    <>
      <button
        type="button"
        title="View"
        onClick={() => router.push(`/expenses/${e.id}`)}
        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Approve"
        disabled={acting === e.id}
        onClick={() => handleAction(e.id, "APPROVED")}
        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors disabled:opacity-40"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Reject"
        disabled={acting === e.id}
        onClick={() => handleAction(e.id, "REJECTED")}
        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </>
  )

  return (
    <PageShell>
      {/* Page header */}
      <PageIntro
        eyebrow="Manager workspace"
        title="Pending Approvals"
        description={`${approvals.length} request${approvals.length !== 1 ? "s" : ""} awaiting review`}
        actions={approvals.length > 0 ? (
          <>
            <button
              type="button"
              onClick={handleBulkApprove}
              className="flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve All
            </button>
            <button
              type="button"
              onClick={handleBulkReject}
              className="flex h-10 items-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" /> Reject All
            </button>
          </>
        ) : undefined}
      />

      {/* Table container */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <EnterpriseToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search by employee, description..."
          selectionCount={selectedKeys.size}
          bulkActions={
            <>
              <button
                type="button"
                onClick={handleBulkApprove}
                className="h-6 px-2 text-[12px] rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Approve
              </button>
              <button
                type="button"
                onClick={handleBulkReject}
                className="h-6 px-2 text-[12px] rounded-md border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Reject
              </button>
            </>
          }
        />

        <EnterpriseTable
          columns={columns}
          data={paginated}
          keyExtractor={(e) => e.id}
          onRowClick={(e) => router.push(`/expenses/${e.id}`)}
          selectedKeys={selectedKeys}
          onSelectChange={setSelectedKeys}
          rowActions={rowActions}
          emptyMessage="No pending approvals — you're all caught up"
          emptyIcon={<CheckCircle2 className="w-8 h-8" />}
          className="border-0 rounded-none"
        />

      <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>
    </PageShell>
  )
}
