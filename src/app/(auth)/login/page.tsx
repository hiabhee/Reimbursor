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
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <span className="text-[16px] font-bold text-gray-900">Reimbursor</span>
      </div>

      <h1 className="text-[18px] font-bold text-gray-900 mb-1">Sign in</h1>
      <p className="text-[12px] text-gray-500 mb-6">Enter your credentials to continue</p>

      {error && (
        <div role="alert" aria-live="polite" className="mb-4 px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-[12px]">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleQuickStart}
        disabled={loading || quickStarting}
        aria-busy={quickStarting}
        className="w-full h-9 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-[13px] font-semibold hover:bg-blue-100 transition-colors disabled:opacity-60"
      >
        {quickStarting ? "Setting up your workspace…" : "Try a demo workspace — no email required"}
      </button>
      <p className="mt-2 text-center text-[10px] text-gray-500">
        Creates a fresh workspace for exploring. Use “Create account” below for permanent access.
      </p>

      <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-gray-400">
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
          className="w-full h-9 rounded-md bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 mt-2"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[12px]">
        <Link href="/forgot-password" className="text-blue-600 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-blue-600 hover:underline">
          Create account
        </Link>
      </div>
    </div>
  )
}
