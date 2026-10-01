"use client"

import { FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
    <main className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-xl font-semibold">Expense assistant</h1>
        <p className="text-sm text-muted-foreground">Ask how to use reimbursements. The assistant cannot see your expenses or your company’s policy.</p>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border p-4" aria-live="polite">
        {turns.length === 0 && <p className="text-sm text-muted-foreground">Try: “How do I submit an expense?”</p>}
        {turns.map((turn, index) => <div key={index} className="space-y-2 text-sm"><p className="ml-auto max-w-[85%] rounded-lg bg-primary p-3 text-primary-foreground">{turn.question}</p><p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted p-3">{turn.answer}</p></div>)}
        {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <form onSubmit={ask} className="flex gap-2">
        <Input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1500} placeholder="Ask about submitting or tracking expenses…" disabled={busy} />
        <Button type="submit" disabled={busy || !question.trim()}>Ask</Button>
      </form>
    </main>
  )
}
