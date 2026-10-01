"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Section } from "@/components/ui/page-header"
import { PageIntro, PageShell } from "@/components/ui/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { Users, Shield, UserCheck, User as UserIcon, Plus, Pencil, Trash2, Send } from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  role: "ADMIN" | "MANAGER" | "EMPLOYEE"
  managerId: string | null
  manager: { id: string; name: string } | null
  _count?: { expenses: number }
  createdAt: string
}

const roleAvatarStyle: Record<string, string> = {
  ADMIN:    "bg-red-100 text-red-600",
  MANAGER:  "bg-amber-100 text-amber-600",
  EMPLOYEE: "bg-blue-100 text-blue-600",
}

const EMPTY_FORM = { name: "", email: "", role: "EMPLOYEE" as const, managerId: "none" }

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers]           = useState<User[]>([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]     = useState<User | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")
  const [sendingPw, setSendingPw]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && session.user.role !== "ADMIN") router.push("/dashboard")
  }, [status, session, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/users")
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const managers = users.filter((u) => u.role === "MANAGER" || u.role === "ADMIN")

  const roleStats = {
    ADMIN:    users.filter((u) => u.role === "ADMIN").length,
    MANAGER:  users.filter((u) => u.role === "MANAGER").length,
    EMPLOYEE: users.filter((u) => u.role === "EMPLOYEE").length,
  }

  const statCards = [
    { label: "Administrators", value: roleStats.ADMIN,    icon: Shield,    iconBg: "bg-red-50",   iconColor: "text-red-600" },
    { label: "Managers",       value: roleStats.MANAGER,  icon: UserCheck, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
    { label: "Employees",      value: roleStats.EMPLOYEE, icon: UserIcon,  iconBg: "bg-blue-50",  iconColor: "text-blue-600" },
  ]

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setError("")
    setShowCreate(true)
  }

  function openEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role as typeof EMPTY_FORM.role,
      managerId: user.managerId ?? "none",
    })
    setError("")
    setEditUser(user)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        role: form.role,
        managerId: form.managerId === "none" ? undefined : form.managerId,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Failed to create user"); setSaving(false); return }
    setShowCreate(false)
    fetchUsers()
    setSaving(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)
    setError("")
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        role: form.role,
        managerId: form.managerId === "none" ? null : form.managerId,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Failed to update user"); setSaving(false); return }
    setEditUser(null)
    fetchUsers()
    setSaving(false)
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return
    setDeleting(user.id)
    await fetch(`/api/users/${user.id}`, { method: "DELETE" })
    setDeleting(null)
    fetchUsers()
  }

  async function handleSendPassword(user: User) {
    setSendingPw(user.id)
    await fetch(`/api/users?id=${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sendPassword" }),
    })
    setSendingPw(null)
    alert(`Password sent to ${user.email}`)
  }

  const UserFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Full Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" required />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Reports To (Manager)</Label>
          <Select value={form.managerId} onValueChange={(v) => setForm({ ...form, managerId: v })}>
            <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No manager —</SelectItem>
              {managers
                .filter((m) => !editUser || m.id !== editUser.id)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} ({m.role.toLowerCase()})</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )

  return (
    <PageShell>
      <PageIntro
        eyebrow="Administration"
        title="User Management"
        description="Manage employees, managers, and admin roles."
        actions={
          <Button className="h-10 gap-2 px-4" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="text-label">{stat.label}</p>
                    <p className="text-metric">{stat.value}</p>
                  </div>
                  <div className={cn("mt-0.5 p-2.5 rounded-lg shrink-0", stat.iconBg)}>
                    <Icon className={cn("w-5 h-5", stat.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* User list */}
      <Section title="All Users" description={`${users.length} total member${users.length !== 1 ? "s" : ""}`}>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
            ) : users.length === 0 ? (
              <EmptyState
                icon={<Users className="w-8 h-8" />}
                title="No users yet"
                description="Add your first team member"
                action={{ label: "Add User", onClick: openCreate }}
              />
            ) : (
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 hover:bg-surface transition-colors group">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={cn("text-sm font-semibold", roleAvatarStyle[user.role] ?? "bg-surface text-muted-foreground")}>
                          {user.name?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-tight text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {user.manager && (
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Reports to</p>
                          <p className="text-xs font-medium">{user.manager.name}</p>
                        </div>
                      )}
                      <Badge
                        variant={user.role === "ADMIN" ? "destructive" : user.role === "MANAGER" ? "warning" : "secondary"}
                      >
                        {user.role.toLowerCase()}
                      </Badge>

                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Edit user"
                          onClick={() => openEdit(user)}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Send password"
                          disabled={sendingPw === user.id}
                          onClick={() => handleSendPassword(user)}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-blue-600 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        {user.id !== session?.user?.id && (
                          <button
                            type="button"
                            title="Delete user"
                            disabled={deleting === user.id}
                            onClick={() => handleDelete(user)}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* Create user dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <UserFormFields />
            <p className="text-xs text-muted-foreground">
              A temporary password will be auto-generated and emailed to the user.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create User"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User — {editUser?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <UserFormFields />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
