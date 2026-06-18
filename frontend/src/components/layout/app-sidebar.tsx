import * as React from "react"
import {
  AlertTriangle,
  BookOpen,
  Building2,
  ClipboardList,
  FileBarChart2,
  FileText,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  School,
  ShieldCheck,
  Users,
  UserRound,
  Zap,
  BriefcaseBusiness,
  ListTodo,
  Database,
  BarChart3,
  FlaskConical,
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

const data = {
  navMain: [
    {
      title: "Tổng quan",
      items: [
        { title: "Việc cần làm hôm nay", url: "/manager/daily-brief", icon: LayoutDashboard },
        { title: "Nhà trường", url: "/manager/analytics", icon: School },
        { title: "Khoa", url: "/manager/analytics/departments", icon: Building2 },
        { title: "Ngành", url: "/manager/analytics/programs", icon: BriefcaseBusiness },
        { title: "Môn học", url: "/manager/analytics/courses", icon: BookOpen },
        { title: "Lớp học phần", url: "/manager/analytics/sections", icon: ClipboardList },
        { title: "Sinh viên rủi ro", url: "/manager/analytics/students", icon: UserRound },
      ],
    },
    {
      title: "Workflow",
      items: [
        { title: "Can thiệp & Task", url: "/manager/tasks", icon: ListTodo },
        { title: "Báo cáo & AI", url: "/manager/reports", icon: FileBarChart2 },
        { title: "Chat AI", url: "/chat", icon: MessageSquare },
      ],
    },
    {
      title: "Chuẩn đầu ra",
      items: [
        { title: "CLO/PLO (Thử nghiệm)", url: "/manager/analytics/outcomes", icon: FlaskConical },
      ],
    },
    {
      title: "Quản lý dữ liệu",
      items: [
        { title: "Sinh viên", url: "/manager/students", icon: Users },
        { title: "Giảng viên", url: "/manager/teachers", icon: GraduationCap },
        { title: "Khoa & Ngành", url: "/manager/departments", icon: Building2 },
        { title: "Môn học", url: "/manager/courses", icon: BookOpen },
        { title: "Điểm số", url: "/manager/grades", icon: FileText },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        { title: "Tài khoản & phân quyền", url: "/manager/users", icon: ShieldCheck },
        { title: "Upload CTĐT", url: "/manager/programs", icon: FileUp },
        { title: "Quản trị dữ liệu", url: "/manager/data-quality", icon: Database },
        { title: "Audit log", url: "/manager/audit", icon: BarChart3 },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/manager" />}>
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
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((subItem) => (
                  <SidebarMenuItem key={subItem.title}>
                    <SidebarMenuButton render={<a href={subItem.url} />}>
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
