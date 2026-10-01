import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Building2, Bell, Shield, Workflow, ChevronRight } from "lucide-react"
import { PageIntro, PageShell } from "@/components/ui/page-shell"

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } })

  const settings = [
    { title: "Company Settings",   description: "Manage company name, currency, and preferences", icon: Building2, href: "/dashboard" },
    { title: "Notifications",      description: "Configure notification preferences",              icon: Bell,      href: "/notifications" },
    { title: "User Management",    description: "Manage user roles and permissions",               icon: Shield,    href: "/admin/users" },
    { title: "Approval Workflow",  description: "Configure expense approval workflows",            icon: Workflow,  href: "/admin/workflow" },
  ]

  return (
    <PageShell>
      <div className="max-w-3xl space-y-5">
        <PageIntro
          eyebrow="Administration"
          title="Settings"
          description="Manage workspace configuration and administrative tools."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {settings.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.title} href={s.href} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-gray-900">{s.title}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p className="text-[12px] text-gray-500 mt-0.5">{s.description}</p>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <span className="text-sm font-semibold text-slate-800">Company Information</span>
          </div>
          {[
            { label: "Company Name",    value: company?.name || "Not set" },
            { label: "Default Currency", value: company?.currency || "USD" },
            { label: "Company ID",      value: company?.id.slice(0, 8) + "..." },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-0">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className="text-sm font-medium text-slate-900">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
