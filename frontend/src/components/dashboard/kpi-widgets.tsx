"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Activity, TrendingUp, AlertTriangle, Target, Users } from "lucide-react"

interface KpiWidgetsProps {
  healthScore: number
  gpaAvg: number
  failRate: number
  cloAttainment: number
  totalStudents: number
}

export function KpiWidgets({ healthScore, gpaAvg, failRate, cloAttainment, totalStudents }: KpiWidgetsProps) {
  const kpis = [
    {
      label: "Health Score",
      value: `${healthScore.toFixed(0)}/100`,
      icon: Activity,
      color: "text-emerald-500",
      trend: "+2.5% so với kỳ trước",
      trendColor: "text-emerald-500"
    },
    {
      label: "GPA Trung Bình",
      value: gpaAvg.toFixed(2),
      icon: TrendingUp,
      color: "text-blue-500",
      trend: "+0.15 điểm",
      trendColor: "text-emerald-500"
    },
    {
      label: "Tỷ lệ Trượt (Fail Rate)",
      value: `${failRate.toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-rose-500",
      trend: "-1.2% (cải thiện)",
      trendColor: "text-emerald-500"
    },
    {
      label: "CLO Attainment",
      value: `${cloAttainment.toFixed(1)}%`,
      icon: Target,
      color: "text-amber-500",
      trend: "+3.4% so với kỳ trước",
      trendColor: "text-emerald-500"
    },
    {
      label: "Tổng Sinh Viên",
      value: totalStudents.toLocaleString("vi-VN"),
      icon: Users,
      color: "text-indigo-500",
      trend: "Hoạt động",
      trendColor: "text-muted-foreground"
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
              <p className={`text-xs mt-1 font-medium ${kpi.trendColor}`}>
                {kpi.trend}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
