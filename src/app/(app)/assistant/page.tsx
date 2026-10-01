"use client"

import { FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bot, ArrowUpRight, Sparkles } from "lucide-react"

type Turn = { question: string; answer: string }

export default function AssistantPage() {
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function ask(event: FormEvent) {
    event.preventDefault()
    const current = question.trim()
    if (!current || busy) return
    setBusy(true)
    setError("")
    setQuestion("")
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: current }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Assistant is unavailable")
      setTurns((old) => [...old, { question: current, answer: data.result.answer }])
    } catch (cause) {
      setQuestion(current)
      setError(cause instanceof Error ? cause.message : "Assistant is unavailable")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full min-h-0 flex-1 max-w-4xl flex-col gap-3 overflow-hidden px-4 py-4 sm:px-6">
      <header className="shrink-0">
        <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Reimbursor guide</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Expense assistant</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Get help using reimbursements. The assistant can’t access your expenses or company policy.</p>
      </header>
      <div className="flex min-h-[220px] max-h-[680px] flex-1 flex-col overflow-y-auto rounded-2xl border border-border bg-card/70 p-4 sm:p-6" style={{ maxHeight: "min(60dvh, 680px)" }} aria-live="polite" aria-label="Conversation">
        {turns.length === 0 ? (
          <div className="m-auto flex w-full max-w-xl flex-col items-center py-5 text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Bot className="h-6 w-6" /></div>
            <h2 className="text-base font-semibold">What can I help with?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ask a question or start with one of these.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {["How do I submit an expense?", "Where can I track a claim?"].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)} className="group inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent sm:text-sm">
                  {suggestion}<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
            {turns.map((turn, index) => <div key={index} className="space-y-3 text-sm"><p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">{turn.question}</p><p className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-4 py-3 leading-relaxed text-foreground">{turn.answer}</p></div>)}
            {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
          </div>
        )}
      </div>
      {error && <p role="alert" className="shrink-0 text-sm text-red-400">{error}</p>}
      <form onSubmit={ask} className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
        <Input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1500} placeholder="Ask about submitting or tracking expenses…" disabled={busy} className="h-11 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0" />
        <Button type="submit" disabled={busy || !question.trim()} className="h-11 shrink-0 gap-2 rounded-xl px-4">{busy ? "Sending…" : "Ask"}<ArrowUpRight className="h-4 w-4" /></Button>
      </form>
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">General guidance only · No access to your company’s private data</p>
    </div>
  )
}
