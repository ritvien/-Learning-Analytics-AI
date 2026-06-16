import * as React from "react"
import {
  BookOpen,
  LayoutDashboard,
  Users,
  GraduationCap,
  Settings,
  MessageSquare,
  FileText,
  FileUp,
  Layers,
  Zap,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"

// Navigation data
const data = {
  navMain: [
    {
      title: "Quản lý chung",
      items: [
        {
          title: "Cơ cấu đào tạo",
          url: "/manager",
          icon: LayoutDashboard,
        },
        {
          title: "Sinh viên",
          url: "/manager/students",
          icon: Users,
        },
        {
          title: "Giảng viên",
          url: "/manager/teachers",
          icon: GraduationCap,
        },
      ],
    },
    {
      title: "Phân tích",
      items: [
        {
          title: "Tổng quan toàn trường",
          url: "/manager/analytics",
          icon: Layers,
        },
        {
          title: "Phân tích khoa/ngành",
          url: "/manager/analytics/departments",
          icon: Settings,
        },
        {
          title: "Phân tích môn học",
          url: "/manager/analytics/courses",
          icon: BookOpen,
        },
        {
          title: "Phân tích lớp học phần",
          url: "/manager/analytics/sections",
          icon: FileText,
        },
      ],
    },
    {
      title: "Đào tạo",
      items: [
        {
          title: "Môn học",
          url: "/manager/courses",
          icon: BookOpen,
        },
        {
          title: "Điểm số",
          url: "/manager/grades",
          icon: FileText,
        },
        {
          title: "Khoa & Ngành",
          url: "/manager/departments",
          icon: Settings,
        },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        {
          title: "Chat AI",
          url: "/chat",
          icon: MessageSquare,
        },
        {
          title: "Upload CTĐT (PDF)",
          url: "/manager/programs",
          icon: FileUp,
        },
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
              {/* EPU Logo Badge */}
              <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1B3A5C] to-[#2A5280] text-white shadow-md">
                <Zap className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold text-sm tracking-tight" style={{ fontFamily: 'var(--font-heading), Montserrat, sans-serif' }}>
                  ĐH Điện Lực
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  EPU Analytics
                </span>
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
          <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">Hệ thống hoạt động</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2 font-medium">
            © 2026 Trường ĐH Điện Lực
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
