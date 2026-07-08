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
  ListTodo,
  Settings,
  ShieldCheck,
  Target,
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
import { type ApiUserRole } from "@/lib/api"

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ApiUserRole[]
}

const MANAGEMENT_ROLES: ApiUserRole[] = ["superadmin", "admin", "manager"]
const STAFF_ROLES: ApiUserRole[] = ["superadmin", "admin", "manager", "lecturer"]
const READ_ROLES: ApiUserRole[] = ["superadmin", "admin", "manager", "lecturer", "viewer"]
const STRUCTURE_ROLES: ApiUserRole[] = ["superadmin", "admin", "manager", "lecturer", "viewer"]

const data: { navMain: { title: string; items: NavItem[] }[] } = {
  navMain: [
    {
      title: "Ra quyết định",
      items: [
        { title: "Tổng quan học vụ", url: "/manager/analytics", icon: Layers, roles: MANAGEMENT_ROLES },
        { title: "Cây đào tạo", url: "/manager", icon: LayoutDashboard, roles: STRUCTURE_ROLES },
        { title: "Phân tích CĐR", url: "/manager/analytics/outcomes", icon: Target, roles: MANAGEMENT_ROLES },
        { title: "Việc cần xử lý", url: "/manager/tasks", icon: ListTodo, roles: STAFF_ROLES },
        { title: "Phân tích môn", url: "/manager/analytics/courses", icon: BookOpen, roles: STAFF_ROLES },
        { title: "Phân tích lớp", url: "/manager/analytics/sections", icon: FileText, roles: STAFF_ROLES },
        { title: "Lớp cố vấn", url: "/manager/analytics/students", icon: UserRound, roles: STAFF_ROLES },
      ],
    },
    {
      title: "Danh mục & Điểm",
      items: [
        { title: "Danh mục sinh viên", url: "/manager/students", icon: Users, roles: READ_ROLES },
        { title: "Giảng viên & phân công", url: "/manager/teachers", icon: GraduationCap, roles: MANAGEMENT_ROLES },
        { title: "Danh mục môn", url: "/manager/courses", icon: BookOpen, roles: READ_ROLES },
        { title: "Danh mục lớp", url: "/manager/sections", icon: FileText, roles: READ_ROLES },
        { title: "Nhập/xem điểm", url: "/manager/grades", icon: FileText, roles: READ_ROLES },
        { title: "Khoa/ngành", url: "/manager/departments", icon: Settings, roles: MANAGEMENT_ROLES },
      ],
    },
    {
      title: "Báo cáo & Hệ thống",
      items: [
        { title: "Trợ lý AI", url: "/chat", icon: MessageSquare, roles: STAFF_ROLES },
        { title: "Trung tâm báo cáo", url: "/manager/reports", icon: FileText, roles: STAFF_ROLES },
        { title: "Tài khoản & phân quyền", url: "/manager/users", icon: ShieldCheck, roles: ["superadmin", "admin"] },
        { title: "Nhật ký hệ thống", url: "/manager/observability", icon: Zap, roles: ["superadmin"] },
        { title: "Quản lý CTĐT", url: "/manager/programs", icon: FileUp, roles: ["superadmin", "admin", "manager"] },
      ],
    },
  ],
}

function canSeeItem(item: NavItem, role?: ApiUserRole | null) {
  return !item.roles || (role != null && item.roles.includes(role))
}

function navTourId(url: string) {
  const ids: Record<string, string> = {
    "/manager/analytics": "nav-overview",
    "/manager": "nav-academic-tree",
    "/manager/analytics/outcomes": "nav-outcomes",
    "/manager/tasks": "nav-tasks",
    "/manager/analytics/courses": "nav-course-analytics",
    "/manager/analytics/sections": "nav-section-analytics",
    "/manager/analytics/students": "nav-advisor",
    "/manager/students": "nav-students",
    "/manager/teachers": "nav-teachers",
    "/manager/courses": "nav-courses",
    "/manager/sections": "nav-sections",
    "/manager/grades": "nav-grades",
    "/manager/departments": "nav-departments",
    "/chat": "nav-chat",
    "/manager/reports": "nav-reports",
    "/manager/users": "nav-users",
    "/manager/observability": "nav-observability",
    "/manager/programs": "nav-programs",
  }
  return ids[url]
}

export function AppSidebar({ userRole, ...props }: React.ComponentProps<typeof Sidebar> & { userRole?: ApiUserRole | null }) {
  const homeUrl = userRole === "lecturer" ? "/manager/analytics/sections" : "/manager/analytics"
  const groups = data.navMain
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeItem(item, userRole)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar variant="inset" data-tour="sidebar" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={homeUrl} prefetch />}
            >
              <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm border border-accent/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 text-[var(--accent)]">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 10c2 0 3-1 4-3 1 2 2 3 4 3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 7v8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 15h4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sm font-bold tracking-tight">EduInsight</span>
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
                          data-tour={navTourId(subItem.url)}
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
            © 2026 EduInsight · EPU
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
