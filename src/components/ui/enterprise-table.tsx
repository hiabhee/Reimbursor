"use client"

import { ReactNode, useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

/* ─── Types ─────────────────────────────────────────────────── */

export interface EnterpriseColumn<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** px width hint, e.g. "w-[120px]" */
  className?: string
  headerClassName?: string
  sortable?: boolean
  align?: "left" | "right" | "center"
}

export interface EnterpriseTableProps<T> {
  columns: EnterpriseColumn<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  /** Controlled selection */
  selectedKeys?: Set<string>
  onSelectChange?: (keys: Set<string>) => void
  /** Renders inline actions on row hover */
  rowActions?: (row: T) => ReactNode
  emptyMessage?: string
  emptyIcon?: ReactNode
  className?: string
  /** Sticky header — wrap in a container with overflow-auto + max-h */
  stickyHeader?: boolean
  loading?: boolean
}

/* ─── Component ─────────────────────────────────────────────── */

export function EnterpriseTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedKeys,
  onSelectChange,
  rowActions,
  emptyMessage = "No records found",
  emptyIcon,
  className,
  stickyHeader = true,
  loading = false,
}: EnterpriseTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const selectable = !!onSelectChange
  const allSelected = selectable && data.length > 0 && data.every((r) => selectedKeys?.has(keyExtractor(r)))
  const someSelected = selectable && !allSelected && data.some((r) => selectedKeys?.has(keyExtractor(r)))

  function toggleAll() {
    if (!onSelectChange) return
    if (allSelected) {
      onSelectChange(new Set())
    } else {
      onSelectChange(new Set(data.map(keyExtractor)))
    }
  }

  function toggleRow(key: string) {
    if (!onSelectChange || !selectedKeys) return
    const next = new Set(selectedKeys)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    onSelectChange(next)
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const alignClass = (align?: "left" | "right" | "center") =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

  if (loading) {
    return (
      <div className={cn("border border-border rounded-lg overflow-hidden bg-card", className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0 animate-pulse">
            <div className="h-3 bg-muted rounded w-1/4" />
            <div className="h-3 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/5 ml-auto" />
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={cn("border border-border rounded-lg bg-card", className)}>
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
          {emptyIcon && <div className="opacity-40 mb-1">{emptyIcon}</div>}
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className={cn(
              "bg-[hsl(var(--surface-container-high))] border-b border-border",
              stickyHeader && "thead-sticky"
            )}>
              {selectable && (
                  <th className="w-12 px-5 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-5 py-4 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none",
                    alignClass(col.align),
                    col.sortable && "cursor-pointer hover:text-foreground transition-colors",
                    col.headerClassName
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="opacity-50">
                        {sortKey === col.key ? (
                          sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {rowActions && <th className="w-1 px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const key = keyExtractor(row)
              const isSelected = selectedKeys?.has(key) ?? false
              return (
                <tr
                  key={key}
                  className={cn(
                    "group border-b border-border last:border-0 transition-colors",
                    onRowClick && "cursor-pointer",
                    isSelected
                      ? "bg-primary/[0.04] hover:bg-primary/[0.07]"
                      : "hover:bg-[hsl(var(--surface-container-low))]"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td
                      className="w-12 px-5 py-4"
                      onClick={(e) => { e.stopPropagation(); toggleRow(key) }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-5 py-4 align-middle",
                        alignClass(col.align),
                        col.className
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td
                      className="px-4 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="row-actions flex items-center justify-end gap-0.5">
                        {rowActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
