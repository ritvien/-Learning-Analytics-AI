"use client"

import * as React from "react"
import { api, ApiHealthScore } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, BookOpen, CheckCircle, GraduationCap, TrendingUp, AlertCircle } from "lucide-react"

interface CourseAnalyticsDialogProps {
  courseId: number | null
  courseCode: string
  courseName: string
  isOpen: boolean
  onClose: () => void
}

export function CourseAnalyticsDialog({
  courseId,
  courseCode,
  courseName,
  isOpen,
  onClose,
}: CourseAnalyticsDialogProps) {
  const [data, setData] = React.useState<ApiHealthScore | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen && courseId) {
      setIsLoading(true)
      setError(null)
      api.getCourseHealth(courseId)
        .then((res) => setData(res))
        .catch((err) => setError(err.message || "Failed to load health score"))
        .finally(() => setIsLoading(false))
    } else {
      setData(null)
    }
  }, [isOpen, courseId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Healthy": return "text-emerald-500"
      case "Warning": return "text-amber-500"
      case "Critical": return "text-rose-500"
      default: return "text-slate-500"
    }
  }

  const getProgressColor = (status: string) => {
    switch (status) {
      case "Healthy": return "bg-emerald-500"
      case "Warning": return "bg-amber-500"
      case "Critical": return "bg-rose-500"
      default: return "bg-slate-500"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Activity className="h-6 w-6 text-primary" />
            Course Analytics
          </DialogTitle>
          <DialogDescription className="text-base">
            Health score and performance metrics for <span className="font-semibold text-foreground">{courseCode} - {courseName}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Skeleton className="h-32 w-32 rounded-full" />
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-destructive">
            <AlertCircle className="h-12 w-12 mb-4 opacity-80" />
            <p className="text-lg font-medium">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Overall Health Score Circular Progress / Large Display */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-8 border-muted shadow-inner bg-card">
                {/* A simple ring showing progress */}
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 144 144">
                  <circle
                    className="text-muted-foreground/10"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="64"
                    cx="72"
                    cy="72"
                  />
                  <circle
                    className={getStatusColor(data.status)}
                    strokeWidth="8"
                    strokeDasharray={402.12} // 2 * pi * 64
                    strokeDashoffset={402.12 - (402.12 * data.health_score) / 100}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="64"
                    cx="72"
                    cy="72"
                  />
                </svg>
                <div className="flex flex-col items-center justify-center text-center">
                  <span className={`text-4xl font-extrabold tracking-tighter ${getStatusColor(data.status)}`}>
                    {data.health_score}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                    {data.status}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium pt-2">Overall Health Score</p>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="border-none shadow-md bg-gradient-to-br from-card to-muted/50 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CLO Attainment</CardTitle>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(data.metrics.clo_attainment_rate * 100).toFixed(1)}%</div>
                  <Progress value={data.metrics.clo_attainment_rate * 100} className="h-1.5 mt-3" indicatorClassName="bg-emerald-500" />
                  <p className="text-xs text-muted-foreground mt-2">Weight: 40%</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-gradient-to-br from-card to-muted/50 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{((1 - data.metrics.fail_rate) * 100).toFixed(1)}%</div>
                  <Progress value={(1 - data.metrics.fail_rate) * 100} className="h-1.5 mt-3" indicatorClassName="bg-blue-500" />
                  <p className="text-xs text-muted-foreground mt-2">Weight: 30%</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-gradient-to-br from-card to-muted/50 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average GPA</CardTitle>
                  <GraduationCap className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.metrics.gpa_avg.toFixed(2)}</div>
                  <Progress value={(data.metrics.gpa_avg / 10) * 100} className="h-1.5 mt-3" indicatorClassName="bg-purple-500" />
                  <p className="text-xs text-muted-foreground mt-2">Weight: 30%</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
