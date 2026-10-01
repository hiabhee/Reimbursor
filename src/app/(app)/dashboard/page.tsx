import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <DashboardClient
      session={{
        id: session.user.id,
        name: session.user.name || "",
        email: session.user.email || "",
        role: session.user.role,
      }}
    />
  )
}
