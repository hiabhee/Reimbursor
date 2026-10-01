"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { CompanySetupModal } from "@/components/CompanySetupModal"
import { StatusPill } from "@/components/ui/status-pill"
import { AdminDashboard } from "@/components/dashboard/AdminDashboard"
import { ManagerDashboard } from "@/components/dashboard/ManagerDashboard"
import { EmployeeDashboard } from "@/components/dashboard/EmployeeDashboard"
import { Plus, ArrowRight, Clock, CheckCircle2, XCircle, Receipt, TrendingUp } from "lucide-react"

interface Company { id: string; name: string; currency: string }
interface Expense {
  id: string; description: string; category: string
  submittedAmount: number; submittedCurrency: string; status: string
  date?: string; createdAt?: string
  convertedAmount?: number
  employee?: { name: string; email: string }
  isAdminOverride?: boolean
}
interface DashboardData {
  role: string
  expenses: Expense[]
  totalExpenses: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  pendingApprovals: number
  userCount?: number
  approvedTotal?: number
  pendingTotal?: number
  pendingApprovalCount?: number
  approvedByMe?: number
  rejectedByMe?: number
  myExpenses?: Expense[]
  pendingApprovalsList?: Expense[]
  toSubmit?: number
  underValidation?: number
  toBeReimbursed?: number
  draftCount?: number
}
interface Session { user: { id: string; name: string; email: string; role: string } }
interface Props { company: Company | null; showSetup: boolean; onShowSetupChange: (s: boolean) => void }

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

export function DashboardContent({ company, showSetup, onShowSetupChange }: Props) {
  const [data, setData]       = useState<DashboardData | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const handleShowSetupChange = useCallback((s: boolean) => onShowSetupChange(s), [onShowSetupChange])

  useEffect(() => {
    Promise.all([fetch("/api/auth/session"), fetch("/api/dashboard/data")])
      .then(async ([sr, dr]) => {
        if (sr.ok) setSession(await sr.json())
        if (dr.ok) {
          const dashboardData = await dr.json()
          setData(dashboardData)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (company && session?.user?.role === "ADMIN") {
      if (!company.name || company.name === "New Company") handleShowSetupChange(true)
    }
  }, [company, session, handleShowSetupChange])

  if (loading || !session) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const isManagerOrAdmin = session.user.role === "MANAGER" || session.user.role === "ADMIN"
  const totalExpenses = data?.expenses?.length ?? data?.totalExpenses ?? 0

  const stats = [
    { label: "Total Submitted", value: totalExpenses, icon: Receipt,      color: "#526c43", bg: "#f0f4e6" },
    { label: "Pending Review",  value: data?.pendingCount ?? 0,  icon: Clock,        color: "#c2410c", bg: "#fff7ed" },
    { label: "Approved",        value: data?.approvedCount ?? 0, icon: CheckCircle2, color: "#15803d", bg: "#f0fdf4" },
    { label: "Rejected",        value: data?.rejectedCount ?? 0, icon: XCircle,      color: "#dc2626", bg: "#fef2f2" },
  ]

  const pendingApprovals = data?.pendingApprovals ?? data?.pendingApprovalCount ?? 0

  if (session.user.role === "ADMIN" && data) {
    return (
      <AdminDashboard
        userName={session.user.name}
        currency={company?.currency || "USD"}
        userCount={data.userCount || 0}
        pendingCount={data.pendingCount || 0}
        approvedTotal={data.approvedTotal || 0}
        pendingTotal={data.pendingTotal || 0}
        expenses={(data.expenses || []).map(e => ({
          id: e.id,
          description: e.description,
          category: e.category,
          date: e.date || e.createdAt || "",
          submittedAmount: e.submittedAmount,
          submittedCurrency: e.submittedCurrency,
          convertedAmount: e.convertedAmount || 0,
          status: e.status,
          employee: e.employee || { name: "Unknown", email: "" },
          isAdminOverride: e.isAdminOverride || false,
        }))}
      />
    )
  }

  if (session.user.role === "MANAGER" && data) {
    return (
      <ManagerDashboard
        userName={session.user.name}
        currency={company?.currency || "USD"}
        pendingApprovalCount={data.pendingApprovalCount || data.pendingApprovals || 0}
        approvedByMe={data.approvedByMe || 0}
        rejectedByMe={data.rejectedByMe || 0}
        myExpenses={(data.myExpenses || data.expenses || []).map(e => ({
          id: e.id,
          description: e.description,
          category: e.category,
          date: e.date || e.createdAt || "",
          submittedAmount: e.submittedAmount,
          submittedCurrency: e.submittedCurrency,
          convertedAmount: e.convertedAmount || 0,
          status: e.status,
        }))}
        pendingApprovals={(data.pendingApprovalsList || []).map(e => ({
          id: e.id,
          description: e.description,
          category: e.category,
          date: e.date || e.createdAt || "",
          submittedAmount: e.submittedAmount,
          submittedCurrency: e.submittedCurrency,
          convertedAmount: e.convertedAmount || 0,
          status: e.status,
          employee: e.employee || { name: "Employee", email: "" },
        }))}
      />
    )
  }

  if (session.user.role === "EMPLOYEE" && data) {
    return (
      <EmployeeDashboard
        userName={session.user.name}
        currency={company?.currency || "USD"}
        toSubmit={data.toSubmit || 0}
        underValidation={data.underValidation || 0}
        toBeReimbursed={data.toBeReimbursed || 0}
        expenses={(data.expenses || []).map(e => ({
          id: e.id,
          description: e.description,
          category: e.category,
          date: e.date || e.createdAt || "",
          submittedAmount: e.submittedAmount,
          submittedCurrency: e.submittedCurrency,
          convertedAmount: e.convertedAmount || 0,
          status: e.status,
        }))}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb / page header */}
      <div className="o-breadcrumb">
        <span className="text-gray-400 text-[12px]">Home</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-[13px] font-semibold text-gray-800">Dashboard</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/expenses/new">
            <button className="o-toolbar-btn o-toolbar-btn-primary">
              <Plus className="w-3.5 h-3.5" /> New Expense
            </button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Welcome */}
        <div>
          <h1 className="o-page-title">Welcome back, {session.user.name?.split(" ")[0]}</h1>
          <p className="o-muted mt-0.5">Here&rsquo;s your expense overview for today.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="o-stat-card flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="o-label">{s.label}</p>
                  <p className="text-[20px] font-bold text-gray-900 leading-none mt-0.5">{s.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Content grid */}
        <div className={`grid gap-4 ${isManagerOrAdmin ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
          {/* Recent expenses table */}
          <div className={`o-container overflow-hidden ${isManagerOrAdmin ? "lg:col-span-2" : ""}`}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#dcdcdc" }}>
              <span className="text-[13px] font-semibold text-gray-800">Recent Expenses</span>
              <Link href="/expenses" className="text-[12px] text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {!data?.expenses?.length ? (
              <div className="o-empty">
                <Receipt className="w-8 h-8 opacity-30" />
                <p className="text-[13px]">No expenses yet</p>
                <Link href="/expenses/new" className="text-[12px] text-blue-600 hover:underline">Create one</Link>
              </div>
            ) : (
              <table className="o-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.slice(0, 8).map((e) => (
                    <tr key={e.id} className="cursor-pointer" onClick={() => window.location.href = `/expenses/${e.id}`}>
                      <td className="font-medium text-gray-900 max-w-[200px] truncate">{e.description}</td>
                      <td className="text-gray-500">{e.category}</td>
                      <td className="text-right font-semibold tabular-nums">
                        {e.submittedCurrency} {e.submittedAmount.toFixed(2)}
                      </td>
                      <td><StatusPill status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending approvals panel */}
          {isManagerOrAdmin && (
            <div className="o-container overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#dcdcdc" }}>
                <span className="text-[13px] font-semibold text-gray-800">Pending Approvals</span>
                <Link href="/approvals" className="text-[12px] text-blue-600 hover:underline flex items-center gap-1">
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center px-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: pendingApprovals > 0 ? "#fff7ed" : "#f0fdf4" }}
                >
                  {pendingApprovals > 0
                    ? <Clock className="w-6 h-6 text-orange-600" />
                    : <CheckCircle2 className="w-6 h-6 text-green-600" />}
                </div>
                <div>
                  <p className="text-[28px] font-bold text-gray-900 leading-none">{pendingApprovals}</p>
                  <p className="text-[12px] text-gray-500 mt-1">
                    {pendingApprovals > 0 ? "waiting for your review" : "All caught up!"}
                  </p>
                </div>
                {pendingApprovals > 0 && (
                  <Link href="/approvals">
                    <button className="o-toolbar-btn o-toolbar-btn-primary mt-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Review now
                    </button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CompanySetupModal company={company} open={showSetup} onOpenChange={handleShowSetupChange} />
    </div>
  )
}
