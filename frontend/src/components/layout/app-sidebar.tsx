import * as React from "react"
import Link from "next/link"
import {
  BookOpen,
  FileText,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Zap,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { api, type ApiUserRole } from "@/lib/api"

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ApiUserRole[]
}

const data: { navMain: { title: string; items: NavItem[] }[] } = {
  navMain: [
    {
      title: "Quản lý chung",
      items: [
        { title: "Cơ cấu đào tạo", url: "/manager", icon: LayoutDashboard },
        { title: "Sinh viên", url: "/manager/students", icon: Users },
        { title: "Giảng viên", url: "/manager/teachers", icon: GraduationCap },
      ],
    },
    {
      title: "Phân tích",
      items: [
        { title: "Tổng quan toàn trường", url: "/manager/analytics", icon: Layers },
        { title: "Ngành đào tạo", url: "/manager/analytics/programs", icon: Settings },
        { title: "Môn học", url: "/manager/analytics/courses", icon: BookOpen },
        { title: "Lớp học phần", url: "/manager/analytics/sections", icon: FileText },
        { title: "Sinh viên", url: "/manager/analytics/students", icon: UserRound },
      ],
    },
    {
      title: "Đào tạo",
      items: [
        { title: "Môn học", url: "/manager/courses", icon: BookOpen },
        { title: "Điểm số", url: "/manager/grades", icon: FileText },
        { title: "Khoa & Ngành", url: "/manager/departments", icon: Settings },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        { title: "Chat AI", url: "/chat", icon: MessageSquare },
        { title: "Báo cáo", url: "/manager/reports", icon: FileText },
        { title: "Tài khoản & phân quyền", url: "/manager/users", icon: ShieldCheck, roles: ["superadmin", "admin"] },
        { title: "Upload CTĐT", url: "/manager/programs", icon: FileUp, roles: ["superadmin", "admin", "manager"] },
      ],
    },
  ],
}

function canSeeItem(item: NavItem, role?: ApiUserRole | null) {
  return !item.roles || (role != null && item.roles.includes(role))
}

function prefetchNavData(url: string) {
  if (url === "/manager") {
    void api.getTree().catch(() => undefined)
    return
  }
  if (url === "/manager/analytics") {
    void api.getDashboardOverview().catch(() => undefined)
    return
  }
  if (url === "/manager/analytics/departments") {
    void api.getDashboardDepartments().catch(() => undefined)
    return
  }
  if (url === "/manager/analytics/programs") {
    void api.getPrograms({ limit: 100 })
      .then((programs) => {
        const firstProgramId = programs[0]?.id
        if (firstProgramId) return api.getDashboardProgram(firstProgramId)
        return undefined
      })
      .catch(() => undefined)
    return
  }
  if (url === "/manager/reports") {
    void api.getReports({ limit: 50 }).catch(() => undefined)
  }
}

export function AppSidebar({ userRole, ...props }: React.ComponentProps<typeof Sidebar> & { userRole?: ApiUserRole | null }) {
  const groups = data.navMain
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeItem(item, userRole)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/manager" prefetch onMouseEnter={() => prefetchNavData("/manager")} onFocus={() => prefetchNavData("/manager")} />}
            >
              <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-[#1B3A5C] text-white shadow-sm">
                <Zap className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sm font-bold tracking-tight">ĐH Điện Lực</span>
                <span className="text-xs font-medium text-muted-foreground">EPU Analytics</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((subItem) => (
                  <SidebarMenuItem key={subItem.title}>
                    <SidebarMenuButton
                      render={(
                        <Link
                          href={subItem.url}
                          prefetch
                          onMouseEnter={() => prefetchNavData(subItem.url)}
                          onFocus={() => prefetchNavData(subItem.url)}
                        />
                      )}
                    >
                      <subItem.icon className="size-4" />
                      <span>{subItem.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 rounded-md bg-accent/50 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground">Hệ thống hoạt động</span>
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-muted-foreground/50">
            © 2026 Trường ĐH Điện Lực
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
