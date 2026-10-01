"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

type ReviewResult = Record<string, unknown>

export function AiExpenseReview({ expenseId }: { expenseId: string }) {
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function run(feature: "VALIDATION" | "APPROVAL_SUMMARY") {
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const response = await fetch(`/api/ai/expenses/${expenseId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "AI review failed")
      setResult(data.result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI review failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="o-container p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">AI review (advisory)</h2>
        <p className="text-xs text-muted-foreground">AI findings do not approve or reject this expense. Verify the evidence yourself.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("VALIDATION")}>{busy ? "Working…" : "Check expense"}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("APPROVAL_SUMMARY")}>Summarize for approval</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>}
    </section>
  )
}
