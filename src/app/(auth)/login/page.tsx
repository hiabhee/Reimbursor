"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [quickStarting, setQuickStarting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = await signIn("credentials", { email, password, redirect: false })
    if (result?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  async function handleQuickStart() {
    setQuickStarting(true)
    setError("")
    try {
      const response = await fetch("/api/auth/quick-start", { method: "POST" })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Quick start is temporarily unavailable")
        return
      }

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError("Workspace created, but automatic sign-in failed. Please use the regular sign-in form.")
        return
      }

      router.push("/dashboard")
    } catch {
      setError("Quick start is temporarily unavailable. Please try again.")
    } finally {
      setQuickStarting(false)
    }
  }

  return (
    <div className="o-auth-card">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="auth-brand-mark">
          <span className="font-bold text-sm">R</span>
        </div>
        <span className="auth-brand-name text-[17px] font-bold tracking-tight">Reimbursor</span>
      </div>

      <h1 className="auth-title mb-1 text-[24px] font-semibold tracking-tight">Sign in</h1>
      <p className="auth-subtitle mb-6 text-[13px]">Enter your credentials to continue</p>

      {error && (
        <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleQuickStart}
        disabled={loading || quickStarting}
        aria-busy={quickStarting}
        className="auth-demo-button"
      >
        {quickStarting ? "Setting up your workspace…" : "Try a demo workspace — no email required"}
      </button>
      <p className="auth-helper mt-2 text-center text-[11px] leading-relaxed">
        Creates a fresh workspace for exploring. Use “Create account” below for permanent access.
      </p>

      <div className="auth-divider my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider">
        <span className="h-px flex-1 bg-gray-200" />
        <span>or sign in</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="o-field-label">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            className="o-input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="login-password" className="o-field-label">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="o-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit-button mt-2"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[12px]">
        <Link href="/forgot-password" className="auth-link">
          Forgot password?
        </Link>
        <Link href="/signup" className="auth-link">
          Create account
        </Link>
      </div>
    </div>
  )
}
