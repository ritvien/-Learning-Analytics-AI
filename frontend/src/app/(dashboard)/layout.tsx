"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { api, clearAccessToken, getAccessToken, type ApiUser } from "@/lib/api"
import { OnboardingTour } from "@/components/onboarding-tour"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<ApiUser | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login")
      return
    }

    api.me()
      .then(setUser)
      .catch(() => {
        clearAccessToken()
        router.replace("/login")
      })
      .finally(() => setIsChecking(false))
  }, [router])

  function logout() {
    clearAccessToken()
    router.replace("/login")
  }

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden font-semibold text-foreground/80 sm:inline-block">Đại học Điện Lực</span>
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
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
