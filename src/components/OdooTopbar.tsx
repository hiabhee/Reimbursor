"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { NotificationBell } from "@/components/Notifications"
import { LogOut, ChevronDown, User } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export function OdooTopbar() {
  const { data: session } = useSession()
  const [profileOpen, setProfileOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <header className="o-topbar shrink-0">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex h-full w-auto shrink-0 items-center gap-2 border-r px-4 lg:w-[220px]"
        style={{ borderColor: "hsl(var(--topbar-border))" }}
      >
        <div className="app-brand-mark w-6 h-6 rounded flex items-center justify-center">
          <span className="text-[10px] font-bold">R</span>
        </div>
        <span className="text-white font-semibold text-[13px] hidden sm:block">Reimbursor</span>
      </Link>

      {/* Navigation lives in the sidebar. Keep the topbar focused on identity and account actions. */}
      <div className="flex-1" aria-hidden="true" />

      {/* Right side */}
      <div className="flex items-center gap-1 px-3 h-full shrink-0">
        {session && <NotificationBell />}

        {session ? (
          <div className="relative" ref={dropRef}>
            <button
              type="button"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label="Open account menu"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2 h-8 rounded text-[12px] font-medium transition-colors"
              style={{ color: "hsl(var(--topbar-fg))" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--sidebar-item-hover))")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <div className="app-user-mark w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold">
                {session.user.name?.[0] ?? "U"}
              </div>
              <span className="hidden sm:block">{session.user.name?.split(" ")[0]}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 w-52 rounded-md border py-1 z-50"
                style={{ background: "#fff", borderColor: "#dcdcdc", boxShadow: "0 4px 16px rgb(0 0 0 / 0.12)" }}
              >
                <div className="px-3 py-2 border-b" style={{ borderColor: "#ebebeb" }}>
                  <p className="text-[13px] font-semibold text-gray-900">{session.user.name}</p>
                  <p className="text-[11px] text-gray-500">{session.user.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold capitalize">
                    {session.user.role.toLowerCase()}
                  </span>
                </div>
                <Link
                  role="menuitem"
                  href="/notifications"
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50"
                  onClick={() => setProfileOpen(false)}
                >
                  <User className="w-3.5 h-3.5" /> Profile
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="o-toolbar-btn text-[12px]" style={{ color: "hsl(var(--topbar-fg))", border: "none", background: "transparent" }}>
              Sign in
            </Link>
            <Link href="/signup" className="o-toolbar-btn o-toolbar-btn-primary text-[12px]">
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
