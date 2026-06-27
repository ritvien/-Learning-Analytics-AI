"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Activity, TrendingUp, AlertTriangle, BookOpen, Users } from "lucide-react"

interface KpiWidgetsProps {
  healthScore: number
  gpaAvg: number
  failRate: number
  totalStudents: number
  totalCourses: number
  scopeLabel?: string
}

export function KpiWidgets({ healthScore, gpaAvg, failRate, totalStudents, totalCourses, scopeLabel = "phạm vi hiện tại" }: KpiWidgetsProps) {
  const kpis = [
    {
      label: "Health Score",
      value: `${healthScore.toFixed(0)}/100`,
      icon: Activity,
      color: "text-emerald-500",
      trend: "Tổng hợp từ GPA và tỷ lệ đạt",
    },
    {
      label: "GPA Trung Bình",
      value: gpaAvg.toFixed(2),
      icon: TrendingUp,
      color: "text-blue-500",
      trend: "Thang điểm 4",
    },
    {
      label: "Tỷ lệ Trượt (Fail Rate)",
      value: `${failRate.toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-rose-500",
      trend: "Trên các lượt học đã có kết quả",
    },
    {
      label: "Môn học",
      value: totalCourses.toLocaleString("vi-VN"),
      icon: BookOpen,
      color: "text-amber-500",
      trend: `Trong ${scopeLabel}`,
    },
    {
      label: "Tổng Sinh Viên",
      value: totalStudents.toLocaleString("vi-VN"),
      icon: Users,
      color: "text-indigo-500",
      trend: `Trong ${scopeLabel}`,
    }
  ]

  return (
    <div id="kpi-widgets" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
      {kpis.map((kpi, index) => (
        <Card 
          key={index} 
          className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <div className={`p-2 rounded-lg bg-muted/50 transition-colors group-hover:bg-primary/10 ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {kpi.trend}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
