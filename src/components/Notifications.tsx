"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  Bell, 
  Check, 
  X, 
  Clock, 
  CheckCircle2
} from "lucide-react"

type NotificationType = "INFO" | "EXPENSE_SUBMITTED" | "APPROVAL_REQUIRED" | "APPROVAL_ACTION" | "EXPENSE_APPROVED" | "EXPENSE_REJECTED" | "SYSTEM" | "STEP_ACTIVATED" | "STEP_COMPLETED"

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
  expense?: {
    id: string
    description: string
  }
  metadata?: Record<string, unknown>
}

function getTypeConfig(type: NotificationType) {
  switch (type) {
    case "EXPENSE_APPROVED":
      return { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100", label: "Approved" }
    case "EXPENSE_REJECTED":
      return { icon: X, color: "text-red-600 bg-red-100", label: "Rejected" }
    case "APPROVAL_REQUIRED":
    case "EXPENSE_SUBMITTED":
      return { icon: Clock, color: "text-amber-600 bg-amber-100", label: "Pending" }
    default:
      return { icon: Bell, color: "text-blue-600 bg-blue-100", label: "Info" }
  }
}

export function NotificationBell() {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount)
        setNotifications(data.notifications.slice(0, 5))
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  const markAllRead = async () => {
    setLoading(true)
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      })
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        })
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        ))
      } catch (error) {
        console.error("Failed to mark as read:", error)
      }
    }
    
    if (notification.expense) {
      router.push(`/expenses/${notification.expense.id}`)
    }
    setShowDropdown(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={showDropdown}
        aria-haspopup="menu"
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          "relative p-2.5 rounded-xl transition-all duration-200",
          showDropdown ? "bg-surface-highest" : "hover:bg-surface"
        )}
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] text-white font-bold leading-none animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 rounded-2xl surface shadow-elevation-4 border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-headline">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllRead}
                disabled={loading}
                className="text-xs h-8"
              >
                <Check className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface mx-auto mb-3 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = getTypeConfig(notification.type)
                const Icon = config.icon
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full p-4 text-left transition-all duration-200 hover:bg-surface",
                      !notification.read ? "bg-primary/[0.02]" : ""
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", config.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm truncate",
                          !notification.read ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
          
          <div className="p-3 border-t border-border/50">
            <Link href="/notifications">
              <Button variant="ghost" className="w-full justify-center" size="sm">
                View all notifications
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter()
  const [markingId, setMarkingId] = useState<string | null>(null)

  const markAsRead = async (notificationId: string) => {
    setMarkingId(notificationId)
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      })
      router.refresh()
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    } finally {
      setMarkingId(null)
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center surface rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-surface-high flex items-center justify-center mb-4">
          <Bell className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-headline">All caught up!</h3>
        <p className="text-sm text-muted-foreground mt-1">You have no notifications at the moment</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => {
        const config = getTypeConfig(notification.type)
        const Icon = config.icon
        return (
          <div
            key={notification.id}
            className={cn(
              "flex items-start gap-4 p-4 rounded-2xl surface transition-all duration-200",
              !notification.read && "bg-primary/[0.02] border border-primary/10"
            )}
          >
            <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", config.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  "text-sm",
                  !notification.read ? "font-semibold text-foreground" : "text-muted-foreground"
                )}>
                  {notification.title}
                </p>
                <Badge variant="gray" className="text-xs">
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                {formatRelativeTime(notification.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead(notification.id)}
                  disabled={markingId === notification.id}
                  className="h-8"
                >
                  <Check className="w-4 h-4" />
                </Button>
              )}
              {notification.expense && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id)
                    }
                    router.push(`/expenses/${notification.expense!.id}`)
                  }}
                  className="h-8"
                >
                  View
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
