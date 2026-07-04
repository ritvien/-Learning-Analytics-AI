"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3 rounded-sm", className)} />
}

function SkeletonKpis({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <SkeletonLine className="w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
            <SkeletonLine className="mt-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SkeletonChart({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-64 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className="flex h-72 items-end gap-3">
          {[48, 72, 56, 88, 64, 78, 52, 68].map((height, index) => (
            <Skeleton key={index} className="flex-1 rounded-t-sm" style={{ height: `${height}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonRows({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid border-b bg-muted/40 p-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonLine key={index} className="w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid border-b p-3 last:border-b-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLine key={colIndex} className={colIndex === 0 ? "w-28" : "w-16"} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageLoadingProgress({
  message = "Đang tải dữ liệu...",
  value,
  className,
}: {
  message?: string
  value?: number
  className?: string
}) {
  const [fallbackValue, setFallbackValue] = React.useState(18)

  React.useEffect(() => {
    if (typeof value === "number") return
    const id = window.setInterval(() => {
      setFallbackValue((current) => (current >= 92 ? 34 : current + 7))
    }, 500)
    return () => window.clearInterval(id)
  }, [value])

  const progressValue = Math.max(0, Math.min(100, typeof value === "number" ? value : fallbackValue))

  return (
    <div className={cn("grid min-h-28 place-items-center rounded-md border bg-card px-4 py-6 text-sm text-muted-foreground shadow-sm", className)}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative grid h-16 w-16 place-items-center">
          <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-primary" />
          <span className="text-sm font-semibold tabular-nums text-foreground">{Math.round(progressValue)}%</span>
        </div>
        <span>{message}</span>
      </div>
    </div>
  )
}

export function DashboardOverviewSkeleton({ message = "Đang tải tổng quan..." }: { message?: string }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <SkeletonLine className="w-[420px] max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-52" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <PageLoadingProgress message={message} />
      <SkeletonKpis />
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <Card>
        <CardHeader>
          <SkeletonLine className="w-44" />
        </CardHeader>
        <CardContent>
          <SkeletonRows rows={5} columns={6} />
        </CardContent>
      </Card>
    </div>
  )
}

export function AnalyticsTableSkeleton({ message = "Đang tải bảng phân tích...", kpis = 4 }: { message?: string; kpis?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <PageLoadingProgress message={message} />
      <SkeletonKpis count={kpis} />
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonChart className="xl:col-span-2" />
        <SkeletonChart />
      </div>
      <Card>
        <CardHeader>
          <SkeletonLine className="w-48" />
        </CardHeader>
        <CardContent>
          <SkeletonRows rows={7} columns={7} />
        </CardContent>
      </Card>
    </div>
  )
}

export function CrudListSkeleton({ message = "Đang tải danh sách...", columns = 6 }: { message?: string; columns?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <PageLoadingProgress message={message} />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-md border p-3">
            <SkeletonLine className="w-24" />
            <Skeleton className="mt-2 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
      <SkeletonRows rows={8} columns={columns} />
    </div>
  )
}

export function DetailPageSkeleton({ message = "Đang tải chi tiết..." }: { message?: string }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonLine className="w-28" />
          <Skeleton className="h-8 w-44" />
          <SkeletonLine className="w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <PageLoadingProgress message={message} />
      <SkeletonKpis />
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonChart className="xl:col-span-2" />
        <SkeletonChart />
      </div>
      <SkeletonRows rows={6} columns={6} />
    </div>
  )
}

export function ReportWorkspaceSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <PageLoadingProgress message="Đang tải trung tâm báo cáo..." />
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-3">
              <SkeletonLine className="w-48" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <SkeletonLine className="w-96 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-5">
          <SkeletonKpis count={3} />
          <SkeletonChart />
          <SkeletonRows rows={6} columns={4} />
        </CardContent>
      </Card>
    </div>
  )
}

export function ReportPreviewSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <PageLoadingProgress message="Đang tải báo cáo..." />
        <Skeleton className="h-8 w-64" />
        <SkeletonLine className="w-96 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-5">
        <SkeletonKpis count={3} />
        <SkeletonChart />
        <SkeletonRows rows={6} columns={4} />
      </CardContent>
    </Card>
  )
}
