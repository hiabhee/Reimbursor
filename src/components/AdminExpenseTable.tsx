"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdminOverrideDialog } from "@/components/AdminOverrideDialog"
import { ExpenseAmountCell } from "@/components/ExpenseAmountCell"
import { cn } from "@/lib/utils"
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flag,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Check,
  X,
  Eye,
  FileText
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
  employee: { name: string; email: string }
  isAdminOverride: boolean
  adminOverrideAt: string | null
  adminOverrideComment: string | null
}

interface AdminExpenseTableProps {
  expenses: Expense[]
  companyCurrency: string
  employees: { id: string; name: string; email: string }[]
}

const ITEMS_PER_PAGE = 10

export function AdminExpenseTable({ expenses, companyCurrency, employees }: AdminExpenseTableProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null)
  const [overrideDialog, setOverrideDialog] = useState<{
    open: boolean
    expenseId: string
    expenseDescription: string
    action: "APPROVE" | "REJECT"
  }>({ open: false, expenseId: "", expenseDescription: "", action: "APPROVE" })

  const stats = useMemo(() => ({
    total: expenses.length,
    pending: expenses.filter(e => e.status === "PENDING").length,
    overridden: expenses.filter(e => e.isAdminOverride).length,
    flagged: expenses.filter(e => e.status === "PENDING" && e.isAdminOverride).length,
  }), [expenses])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!expense.description.toLowerCase().includes(query) && 
            !expense.employee.name.toLowerCase().includes(query) &&
            !expense.employee.email.toLowerCase().includes(query)) {
          return false
        }
      }
      if (statusFilter !== "ALL") {
        if (statusFilter === "OVERRIDE" && !expense.isAdminOverride) return false
        if (statusFilter !== "OVERRIDE" && expense.status !== statusFilter) return false
      }
      if (employeeFilter !== "ALL" && expense.employee.email !== employeeFilter) return false
      if (dateFrom && new Date(expense.date) < new Date(dateFrom)) return false
      if (dateTo && new Date(expense.date) > new Date(dateTo)) return false
      return true
    })
  }, [expenses, searchQuery, statusFilter, employeeFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE)
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const resetFilters = () => {
    setSearchQuery("")
    setStatusFilter("ALL")
    setEmployeeFilter("ALL")
    setDateFrom("")
    setDateTo("")
    setCurrentPage(1)
    setSelectedExpenses(new Set())
  }

  const hasActiveFilters = searchQuery || statusFilter !== "ALL" || employeeFilter !== "ALL" || dateFrom || dateTo

  const toggleSelectAll = () => {
    if (selectedExpenses.size === paginatedExpenses.length) {
      setSelectedExpenses(new Set())
    } else {
      setSelectedExpenses(new Set(paginatedExpenses.map(e => e.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedExpenses)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedExpenses(newSet)
  }

  const exportToCSV = () => {
    const headers = ["Employee", "Email", "Description", "Category", "Date", "Amount", "Currency", "Converted Amount", "Status", "Admin Override"]
    const rows = filteredExpenses.map(e => [
      e.employee.name,
      e.employee.email,
      e.description,
      e.category,
      new Date(e.date).toLocaleDateString(),
      e.submittedAmount,
      e.submittedCurrency,
      e.convertedAmount,
      e.status,
      e.isAdminOverride ? "Yes" : "No"
    ])
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusBadge = (status: string, isAdminOverride: boolean) => {
    if (isAdminOverride) {
      return <Badge variant="secondary" className="gap-1"><Flag className="w-3 h-3" /> Overridden</Badge>
    }

    const config = {
      DRAFT: { variant: "gray" as const, label: "Draft", color: "text-gray-600 bg-gray-100" },
      PENDING: { variant: "warning" as const, label: "Pending", color: "text-amber-600 bg-amber-100" },
      APPROVED: { variant: "success" as const, label: "Approved", color: "text-emerald-600 bg-emerald-100" },
      REJECTED: { variant: "destructive" as const, label: "Rejected", color: "text-red-600 bg-red-100" },
    }

    const style = config[status as keyof typeof config] || config.DRAFT
    return (
      <Badge variant={style.variant} className={cn("gap-1", style.color)}>
        {status === "PENDING" && <Clock className="w-3 h-3" />}
        {status === "APPROVED" && <CheckCircle2 className="w-3 h-3" />}
        {status === "REJECTED" && <X className="w-3 h-3" />}
        {style.label}
      </Badge>
    )
  }

  const handleOverrideSuccess = () => {
    router.refresh()
  }

  const handleBulkAction = async (action: "APPROVE" | "REJECT") => {
    if (selectedExpenses.size === 0) return
    
    setBulkActionLoading(action)
    try {
      const response = await fetch("/api/admin/expenses/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: Array.from(selectedExpenses),
          action,
        }),
      })

      if (response.ok) {
        setSelectedExpenses(new Set())
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to perform bulk action")
      }
    } catch (error) {
      console.error("Bulk action error:", error)
      alert("Failed to perform bulk action")
    } finally {
      setBulkActionLoading(null)
    }
  }

  const openApproveDialog = (expense: Expense) => {
    setOverrideDialog({
      open: true,
      expenseId: expense.id,
      expenseDescription: expense.description,
      action: "APPROVE",
    })
  }

  const openRejectDialog = (expense: Expense) => {
    setOverrideDialog({
      open: true,
      expenseId: expense.id,
      expenseDescription: expense.description,
      action: "REJECT",
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="group cursor-pointer border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md" onClick={() => setStatusFilter("ALL")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label text-muted-foreground">Total Expenses</p>
                <p className="text-3xl font-bold text-headline mt-1">{stats.total}</p>
              </div>
              <div className="rounded-md bg-indigo-100 p-3 text-indigo-600 transition-transform group-hover:scale-110">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md" onClick={() => setStatusFilter("PENDING")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-headline mt-1">{stats.pending}</p>
              </div>
              <div className="rounded-md bg-amber-100 p-3 text-amber-600 transition-transform group-hover:scale-110">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md" onClick={() => setStatusFilter("OVERRIDE")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label text-muted-foreground">Admin Overridden</p>
                <p className="text-3xl font-bold text-headline mt-1">{stats.overridden}</p>
              </div>
              <div className="rounded-md bg-purple-100 p-3 text-purple-600 transition-transform group-hover:scale-110">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer border-slate-200 shadow-sm transition-shadow duration-200 hover:shadow-md" onClick={() => setStatusFilter("REJECTED")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label text-muted-foreground">Rejected</p>
                <p className="text-3xl font-bold text-headline mt-1">
                  {expenses.filter(e => e.status === "REJECTED").length}
                </p>
              </div>
              <div className="rounded-md bg-red-100 p-3 text-red-600 transition-transform group-hover:scale-110">
                <X className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              Filters
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses, employees..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="OVERRIDE">Overridden</SelectItem>
              </SelectContent>
            </Select>

            <Select value={employeeFilter} onValueChange={(v) => { setEmployeeFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.email} value={emp.email}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
                className="w-36"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
                className="w-36"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedExpenses.size > 0 && (
        <Card className="border-primary/50 bg-primary/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedExpenses.size} expense{selectedExpenses.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="success" 
                  className="gap-1"
                  disabled={bulkActionLoading !== null}
                  onClick={() => handleBulkAction("APPROVE")}
                >
                  {bulkActionLoading === "APPROVE" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Bulk Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="gap-1"
                  disabled={bulkActionLoading !== null}
                  onClick={() => handleBulkAction("REJECT")}
                >
                  {bulkActionLoading === "REJECT" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Bulk Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-surface">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-headline">No expenses found</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                {hasActiveFilters 
                  ? "No expenses match your current filters. Try adjusting your search criteria."
                  : "Get started by submitting your first expense report."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedExpenses.size === paginatedExpenses.length && paginatedExpenses.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExpenses.map((expense) => (
                    <TableRow 
                      key={expense.id}
                      className={cn(
                        "group cursor-pointer transition-all duration-200",
                        selectedExpenses.has(expense.id) && "bg-primary/[0.02]"
                      )}
                    >
                      <TableCell onClick={(e) => { e.stopPropagation(); toggleSelect(expense.id) }}>
                        <input
                          type="checkbox"
                          checked={selectedExpenses.has(expense.id)}
                          onChange={() => toggleSelect(expense.id)}
                          className="rounded border-border"
                        />
                      </TableCell>
                      <TableCell onClick={() => router.push(`/expenses/${expense.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-high flex items-center justify-center text-sm font-semibold">
                            {expense.employee.name[0]}
                          </div>
                          <div>
                            <p className="font-medium group-hover:text-primary transition-colors">
                              {expense.employee.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {expense.employee.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => router.push(`/expenses/${expense.id}`)}>
                        <span className="group-hover:text-primary transition-colors line-clamp-1">
                          {expense.description}
                        </span>
                      </TableCell>
                      <TableCell onClick={() => router.push(`/expenses/${expense.id}`)}>
                        <Badge variant="secondary" className="text-xs">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={() => router.push(`/expenses/${expense.id}`)}>
                        {new Date(expense.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell onClick={() => router.push(`/expenses/${expense.id}`)}>
                        <ExpenseAmountCell
                          convertedAmount={expense.convertedAmount}
                          companyCurrency={companyCurrency}
                          submittedAmount={expense.submittedAmount}
                          submittedCurrency={expense.submittedCurrency}
                          viewerRole="ADMIN"
                        />
                      </TableCell>
                      <TableCell onClick={() => router.push(`/expenses/${expense.id}`)}>
                        {getStatusBadge(expense.status, expense.isAdminOverride)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/expenses/${expense.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          {!expense.isAdminOverride && expense.status !== "APPROVED" && expense.status !== "REJECTED" ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openApproveDialog(expense)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => openRejectDialog(expense)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredExpenses.length)} of {filteredExpenses.length} expenses
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-3">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AdminOverrideDialog
        expenseId={overrideDialog.expenseId}
        expenseDescription={overrideDialog.expenseDescription}
        action={overrideDialog.action}
        open={overrideDialog.open}
        onClose={() => setOverrideDialog({ ...overrideDialog, open: false })}
        onSuccess={handleOverrideSuccess}
      />
    </div>
  )
}
