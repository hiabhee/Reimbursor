"use client"

import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface TablePaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  className?: string
}

export function TablePagination({ page, pageSize, total, onPageChange, className }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const btn = (label: React.ReactNode, onClick: () => void, disabled: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-6 w-6 flex items-center justify-center rounded-md border border-border text-[12px] transition-colors",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-muted cursor-pointer"
      )}
    >
      {label}
    </button>
  )

  return (
    <div className={cn("flex items-center justify-between px-3 py-2 border-t border-border text-[12px] text-muted-foreground bg-[hsl(var(--surface-container-low))]", className)}>
      <span>
        {total === 0 ? "No records" : `${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        {btn(<ChevronLeft className="w-3 h-3" />, () => onPageChange(page - 1), page <= 1)}
        <span className="px-2 text-foreground font-medium">{page} / {totalPages}</span>
        {btn(<ChevronRight className="w-3 h-3" />, () => onPageChange(page + 1), page >= totalPages)}
      </div>
    </div>
  )
}
