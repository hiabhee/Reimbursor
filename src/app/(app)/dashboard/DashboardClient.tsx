"use client"

import { useState, useEffect } from "react"
import { DashboardContent } from "./DashboardContent"

interface Company {
  id: string
  name: string
  currency: string
}

interface DashboardSession {
  id: string
  name: string
  email: string
  role: string
}

export function DashboardClient({ session }: { session: DashboardSession }) {
  const [company, setCompany] = useState<Company | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  useEffect(() => {
    fetchCompany()
  }, [])

  const fetchCompany = async () => {
    try {
      const res = await fetch("/api/company")
      if (res.ok) {
        const data = await res.json()
        setCompany(data)
      }
    } catch (error) {
      console.error("Failed to fetch company:", error)
    }
  }

  return (
    <DashboardContent
      session={{ user: session }}
      company={company}
      showSetup={showSetup}
      onShowSetupChange={setShowSetup}
    />
  )
}
