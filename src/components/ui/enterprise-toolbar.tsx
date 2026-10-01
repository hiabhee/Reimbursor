"use client"

import { ReactNode, useRef } from "react"
import { cn } from "@/lib/utils"
import { Search, X } from "lucide-react"

interface EnterpriseToolbarProps {
  /** Left side: primary actions (New button, etc.) */
  actions?: ReactNode
  /** Search value */
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  /** Right side: filter dropdowns, export, etc. */
  filters?: ReactNode
  /** Bulk action bar — shown when selection is non-empty */
  bulkActions?: ReactNode
  selectionCount?: number
  className?: string
}

export function EnterpriseToolbar({
  actions,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  bulkActions,
  selectionCount = 0,
  className,
}: EnterpriseToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (selectionCount > 0 && bulkActions) {
    return (
      <div className={cn("enterprise-toolbar bg-primary/[0.04] border-primary/20", className)}>
        <span className="text-xs font-semibold text-primary mr-1">
          {selectionCount} selected
        </span>
        <div className="flex items-center gap-1 ml-1">
          {bulkActions}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("enterprise-toolbar gap-3 p-3 sm:p-4", className)}>
      {actions && <div className="flex items-center gap-1">{actions}</div>}

      {onSearchChange !== undefined && (
        <div className="relative w-full max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-8 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {filters && (
        <div className="ml-auto flex items-center gap-2">
          {filters}
        </div>
      )}
    </div>
  )
}
