"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, BarChart3, BookOpen, Users } from "lucide-react"

interface DetailPanelProps {
  title: string
  subtitle: string
  studentCount: number
  averageGpa: number
  failRate: number
  courseCount: number
  topInsights: string[]
}

export function DetailPanel({
  title,
  subtitle,
  studentCount,
  averageGpa,
  failRate,
  courseCount,
  topInsights,
}: DetailPanelProps) {
  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Sinh viên</p>
                <p className="text-3xl font-semibold">{studentCount}</p>
              </div>
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">GPA trung bình</p>
                <p className="text-3xl font-semibold">{averageGpa.toFixed(2)}</p>
              </div>
              <ArrowUpRight className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tỷ lệ trượt</p>
                <p className="text-3xl font-semibold">{failRate.toFixed(1)}%</p>
              </div>
              <Badge variant={failRate > 15 ? "destructive" : "secondary"}>{failRate > 15 ? "Cao" : "Ổn định"}</Badge>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Môn học</p>
                <p className="text-3xl font-semibold">{courseCount}</p>
              </div>
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Insight chính</p>
            <Badge variant="outline">{topInsights.length} mục</Badge>
          </div>
          <div className="space-y-2">
            {topInsights.map((insight) => (
              <div key={insight} className="rounded-2xl border border-border bg-background p-3 text-sm">
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
