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
  BarChart3,
  Building2,
  BookMarked,
  AlertTriangle,
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

// Dữ liệu mẫu cho navigation (Sẽ thay thế bằng role-based logic sau)
const data = {
  navMain: [
    {
      title: "Quản lý chung",
      items: [
        {
          title: "Dashboard",
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
      title: "Phân tích",
      items: [
        {
          title: "Tổng quan toàn trường",
          url: "/manager/analytics",
          icon: BarChart3,
        },
        {
          title: "Ngành đào tạo",
          url: "/manager/analytics/programs",
          icon: Building2,
        },
        {
          title: "Môn học",
          url: "/manager/analytics/courses",
          icon: BookMarked,
        },
        {
          title: "Lớp học phần",
          url: "/manager/analytics/sections",
          icon: AlertTriangle,
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
            <SidebarMenuButton size="lg" render={<a href="#" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">EPU Analytics</span>
                <span className="">v1.0.0</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton render={<a href={item.url} />}>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
         {/* User dropdown will go here */}
      </SidebarFooter>
    </Sidebar>
  )
}
