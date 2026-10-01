"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"
import { PageIntro, PageShell } from "@/components/ui/page-shell"

const TABLES = [
  { key: "users", label: "Users" },
  { key: "expenses", label: "Expenses" },
  { key: "approvalRules", label: "Approval Rules" },
  { key: "notifications", label: "Notifications" },
  { key: "chatMessages", label: "Chat Messages" },
]

export default function DbViewerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTable, setActiveTable] = useState("users")
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && session.user.role !== "ADMIN") router.push("/dashboard")
  }, [status, session, router])

  const fetchTable = useCallback(async (table: string) => {
    setLoading(true)
    const res = await fetch(`/api/admin/db?table=${table}`)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTable(activeTable)
  }, [activeTable, fetchTable])

  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  function renderCell(value: unknown): string {
    if (value === null || value === undefined) return "—"
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  }

  return (
    <PageShell>
        <PageIntro
          eyebrow="Administration"
          title="Database Viewer"
          description="Live view of your company data."
          actions={
            <Button variant="outline" className="h-10 gap-2 px-4" onClick={() => fetchTable(activeTable)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
            </Button>
          }
        />

      {/* Table tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABLES.map((t) => (
          <Button
            key={t.key}
            variant={activeTable === t.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTable(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Row count */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{rows.length} rows</Badge>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t hover:bg-muted/50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 max-w-xs truncate" title={renderCell(row[col])}>
                    {renderCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={columns.length || 1} className="px-4 py-8 text-center text-muted-foreground">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
