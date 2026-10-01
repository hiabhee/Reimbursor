"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { NotificationBell } from "@/components/Notifications"
import { LogOut, Bell, ChevronDown } from "lucide-react"

export function Navbar() {
  const { data: session } = useSession()

  /* ── Unauthenticated top bar ── */
  if (!session) {
    return (
      <header className="glass sticky top-0 z-40 border-b border-border/60 h-16 flex items-center">
        <div className="flex-1 flex items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-headline tracking-tight">
            Reimbursor
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>
    )
  }

  /* ── Authenticated utility top bar — NO nav links ── */
  return (
    <header className="glass sticky top-0 z-40 border-b border-border/60 h-16 flex items-center">
      <div className="flex-1 flex items-center justify-end gap-2 px-6">
        {/* Notifications */}
        <NotificationBell />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-3 h-9 rounded-lg"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {session.user.name?.[0] ?? "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium">
                {session.user.name?.split(" ")[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-60 rounded-xl p-2" align="end" forceMount>
            <DropdownMenuLabel className="p-2">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">{session.user.email}</p>
                <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium w-fit capitalize">
                  {session.user.role.toLowerCase()}
                </span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="my-1.5" />

            <Link href="/notifications" className="block">
              <DropdownMenuItem className="rounded-lg cursor-pointer gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </DropdownMenuItem>
            </Link>

            <DropdownMenuSeparator className="my-1.5" />

            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
              className="rounded-lg cursor-pointer gap-2 text-red-600 focus:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
