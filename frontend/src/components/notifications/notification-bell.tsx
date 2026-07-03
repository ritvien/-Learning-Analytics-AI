"use client"

import * as React from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api, type ApiOpsNotification } from "@/lib/api"

function priorityLabel(priority: string) {
  if (priority === "critical" || priority === "urgent") return "Khẩn cấp"
  if (priority === "high") return "Cao"
  if (priority === "low") return "Thấp"
  return "Trung bình"
}

export function NotificationBell() {
  const [count, setCount] = React.useState(0)
  const [items, setItems] = React.useState<ApiOpsNotification[]>([])

  const reloadCount = React.useCallback(() => {
    void api.getUnreadNotificationCount().then((row) => setCount(row.unread)).catch(() => undefined)
  }, [])

  const reloadItems = React.useCallback(() => {
    void api.getNotifications({ limit: 5 }).then(setItems).catch(() => undefined)
  }, [])

  React.useEffect(() => {
    reloadCount()
    const timer = window.setInterval(reloadCount, 60000)
    return () => window.clearInterval(timer)
  }, [reloadCount])

  async function markRead(item: ApiOpsNotification) {
    if (!item.read_at) {
      await api.markNotificationRead(item.id).catch(() => undefined)
      reloadCount()
      reloadItems()
    }
  }

  async function markAll() {
    await api.markAllNotificationsRead().catch(() => undefined)
    reloadCount()
    reloadItems()
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) reloadItems() }}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="relative" />}>
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
        <span className="sr-only">Thông báo</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Thông báo</div>
          <Button variant="ghost" size="xs" onClick={markAll}>
            <CheckCheck className="size-3" />
            Đã đọc
          </Button>
        </div>
        <DropdownMenuSeparator />
        {items.length ? (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="block cursor-pointer p-2"
              onClick={() => void markRead(item)}
              render={item.link_url ? <Link href={item.link_url} /> : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                </div>
                {!item.read_at ? <span className="mt-1 size-2 rounded-full bg-primary" /> : null}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">{priorityLabel(item.priority)}</div>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Chưa có thông báo.</div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/manager/tasks" />} className="justify-center">
          Mở việc cần xử lý
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
