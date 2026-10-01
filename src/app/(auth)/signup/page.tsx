"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const CURRENCIES = ["USD","EUR","GBP","INR","JPY","CAD","AUD","SGD","AED","CHF"]

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name:"", email:"", password:"", companyName:"", companyCurrency:"USD" })
  const [error, setError]   = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters")
        setLoading(false)
        return
      }
      if (!/[A-Z]/.test(form.password)) {
        setError("Password must contain at least one uppercase letter")
        setLoading(false)
        return
      }
      if (!/[a-z]/.test(form.password)) {
        setError("Password must contain at least one lowercase letter")
        setLoading(false)
        return
      }
      if (!/[0-9]/.test(form.password)) {
        setError("Password must contain at least one number")
        setLoading(false)
        return
      }

      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Signup failed"); setLoading(false); return }
      
      const r = await signIn("credentials", { email: form.email, password: form.password, redirect: false })
      if (r?.error) {
        setError("Account created! Please sign in with your credentials.")
        router.push("/login")
      } else {
        router.push("/dashboard")
      }
    } catch { setError("An error occurred."); setLoading(false) }
  }

  return (
    <div className="o-auth-card" style={{ maxWidth: 440 }}>
      <div className="flex items-center gap-2 mb-6">
        <div className="auth-brand-mark">
          <span className="font-bold text-sm">R</span>
        </div>
        <span className="auth-brand-name text-[17px] font-bold tracking-tight">Reimbursor</span>
      </div>
      <h1 className="auth-title mb-1 text-[24px] font-semibold tracking-tight">Create account</h1>
      <p className="auth-subtitle mb-6 text-[13px]">Set up your company workspace</p>
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="o-field-label">Your Name</label>
            <input type="text" className="o-input" placeholder="Jane Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="o-field-label">Email</label>
            <input type="email" className="o-input" placeholder="you@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="o-field-label">Password</label>
            <input type="password" className="o-input" placeholder="Create a strong password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          <p className="mt-1 text-[10px] text-gray-500">Must contain 8+ characters with uppercase, lowercase, and a number</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="o-field-label">Company Name</label>
            <input type="text" className="o-input" placeholder="Acme Inc." value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          </div>
          <div>
            <label className="o-field-label">Currency</label>
            <select className="o-input" value={form.companyCurrency} onChange={(e) => setForm({ ...form, companyCurrency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className="auth-submit-button mt-1">
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>
      <p className="auth-helper mt-4 text-center text-[12px]">
        Already have an account?{" "}
        <Link href="/login" className="auth-link">Sign in</Link>
      </p>
    </div>
  )
}
