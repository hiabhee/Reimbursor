"use client"

import { useSession } from "next-auth/react"
import { OdooTopbar } from "@/components/OdooTopbar"
import { OdooSidebar } from "@/components/OdooSidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  return (
    <div className="app-shell flex flex-col min-h-screen" style={{ background: "#fbfcf8" }}>
      {/* Global topbar */}
      <OdooTopbar />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <OdooSidebar userRole={session?.user?.role} />

        {/* Main content */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
