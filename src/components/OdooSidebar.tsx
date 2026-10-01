"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, Receipt, CheckSquare, Settings, Bot,
  FileText, Users, Workflow, ChevronRight,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  section?: string
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",       label: "Dashboard",    icon: LayoutDashboard },
  { href: "/expenses",        label: "Expenses",     icon: Receipt },
  { href: "/assistant",       label: "Expense Assistant", icon: Bot },
  { href: "/approvals",       label: "Approvals",    icon: CheckSquare,  roles: ["MANAGER", "ADMIN"] },
  { href: "/admin/expenses",  label: "All Expenses", icon: FileText,     roles: ["ADMIN"], section: "Admin" },
  { href: "/admin/users",     label: "Users",        icon: Users,        roles: ["ADMIN"], section: "Admin" },
  { href: "/admin/workflow",  label: "Workflow",     icon: Workflow,     roles: ["ADMIN"], section: "Admin" },
  { href: "/admin/approval-rules", label: "Approval Rules", icon: CheckSquare, roles: ["ADMIN"], section: "Admin" },
  { href: "/admin/settings",  label: "Settings",     icon: Settings,     roles: ["ADMIN"], section: "Admin" },
]

export function OdooSidebar({ userRole }: { userRole?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const filtered = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true
    return userRole && item.roles.includes(userRole)
  })

  const mainItems  = filtered.filter((i) => !i.section)
  const adminItems = filtered.filter((i) => i.section === "Admin")

  return (
    <aside className="o-sidebar hidden lg:flex flex-col shrink-0">
      <nav className="flex-1 py-2 overflow-y-auto">
        {mainItems.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} onIntent={() => router.prefetch(item.href)} />
        ))}

        {adminItems.length > 0 && (
          <>
            <div className="o-nav-section mt-2">Admin</div>
            {adminItems.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} onIntent={() => router.prefetch(item.href)} />
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}

function SidebarLink({ item, pathname, onIntent }: { item: NavItem; pathname: string; onIntent: () => void }) {
  const Icon = item.icon
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

  return (
    <Link href={item.href} onMouseEnter={onIntent} onFocus={onIntent} className={`o-nav-item ${isActive ? "active" : ""}`}>
      <Icon className="w-4 h-4 shrink-0 opacity-80" />
      <span className="flex-1">{item.label}</span>
      {isActive && <ChevronRight className="w-3 h-3 opacity-40" />}
    </Link>
  )
}
