"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { DashboardPreloader } from "@/components/layout/dashboard-preloader"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { api, clearAccessToken, getAccessToken, getCachedCurrentUser, startPageTrace, type ApiUser } from "@/lib/api"
import { OnboardingTour } from "@/components/onboarding-tour"
import { GlobalChatShell } from "@/components/layout/global-chat-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<ApiUser | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login")
      return
    }

    const cachedUser = getCachedCurrentUser()
    if (cachedUser) {
      setTimeout(() => {
        setUser(cachedUser)
        setIsChecking(false)
      }, 0)
      return
    }

    api.me()
      .then((freshUser) => {
        setUser(freshUser)
        setIsChecking(false)
      })
      .catch(() => {
        clearAccessToken()
        router.replace("/login")
      })
      .finally(() => {
        setIsChecking(false)
      })
  }, [router])

  useEffect(() => {
    if (isChecking || !user || !pathname) return

    if (pathname.startsWith("/manager/users")) {
      if (user.role !== "superadmin" && user.role !== "admin") {
        router.replace("/forbidden")
      }
    } else if (pathname.startsWith("/manager/programs")) {
      if (user.role !== "superadmin" && user.role !== "admin" && user.role !== "manager") {
        router.replace("/forbidden")
      }
    } else if (pathname.startsWith("/manager/observability")) {
      if (user.role !== "superadmin") {
        router.replace("/forbidden")
      }
    }
  }, [pathname, user, isChecking, router])

  function logout() {
    clearAccessToken()
    router.replace("/login")
  }

  useEffect(() => {
    if (!user || !pathname) return
    const traceId = startPageTrace(pathname)
    void api.trackEvent({
      event_name: "page_view",
      route: pathname,
      module: pathname.includes("/manager/analytics")
        ? "analytics"
        : pathname.includes("/manager/reports")
          ? "reports"
          : "manager",
      status: "ok",
      payload: {
        trace_id: traceId,
        user_role: user.role,
      },
    }).catch(() => undefined)
  }, [pathname, user])

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar userRole={user?.role ?? null} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden font-semibold text-foreground/80 sm:inline-block">VinUniversity</span>
              <span className="hidden sm:inline-block">/</span>
              <span>Hệ thống Quản lý</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="hidden text-right text-xs sm:block">
                <div className="font-medium text-foreground">{user.full_name}</div>
                <div className="text-muted-foreground">{user.role}</div>
              </div>
            ) : null}
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout}>
              Đăng xuất
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <OnboardingTour />
          <DashboardPreloader userRole={user?.role ?? null} />
          {children}
          <GlobalChatShell />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
