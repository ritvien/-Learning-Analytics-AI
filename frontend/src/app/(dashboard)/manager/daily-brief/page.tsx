"use client"

import * as React from "react"
import {
  AlertTriangle,
  BookOpen,
  Building2,
  ChevronRight,
  GraduationCap,
  Info,
  ListTodo,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  UserRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api, type ApiBriefItem, type ApiDailyBrief } from "@/lib/api"

const SCOPE_ICON: Record<string, React.ElementType> = {
  department: Building2,
  program: GraduationCap,
  course: BookOpen,
  student: UserRound,
  school: ListTodo,
}

const SEVERITY_STYLE: Record<string, string> = {
  high: "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30",
  medium: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30",
  low: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
}

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
}

const SEVERITY_LABEL: Record<string, string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
}

const DRILL_DOWN_HREF: Record<string, (id: number | null) => string> = {
  department: (id) => id ? `/manager/analytics/departments?id=${id}` : "/manager/analytics",
  program: (id) => id ? `/manager/analytics/programs?id=${id}` : "/manager/analytics/programs",
  course: (id) => id ? `/manager/analytics/courses?id=${id}` : "/manager/analytics/courses",
  student: () => "/manager/analytics/students",
  school: () => "/manager/analytics",
}

function BriefItemCard({ item }: { item: ApiBriefItem }) {
  const Icon = SCOPE_ICON[item.scope_type] ?? Info

  const drillHref =
    DRILL_DOWN_HREF[item.scope_type]?.(item.scope_id) ??
    "/manager/analytics"

  const agentQuery = encodeURIComponent(
    `Phân tích: ${item.title}. Chỉ số: ${item.metric_key} = ${item.value}. ${item.formula ?? ""}`
  )

  return (
    <Card className={`border ${SEVERITY_STYLE[item.severity] ?? ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-white/60 p-1.5 dark:bg-black/20">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[item.severity] ?? ""}`}
              >
                {SEVERITY_LABEL[item.severity] ?? item.severity}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{item.scope_type}</span>
            </div>
            <p className="text-sm font-medium leading-snug">{item.title}</p>
            {item.formula && (
              <p className="mt-1 text-xs text-muted-foreground">{item.formula}</p>
            )}
            {item.sample_size != null && (
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                Mẫu: {item.sample_size.toLocaleString("vi-VN")} bản ghi
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.actions.includes("drill_down") && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
              <a href={drillHref}>
                <ChevronRight className="size-3" />
                Xem chi tiết
              </a>
            </Button>
          )}
          {item.actions.includes("ask_agent") && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
              <a href={`/chat?q=${agentQuery}`}>
                <MessageSquare className="size-3" />
                Hỏi AI
              </a>
            </Button>
          )}
          {item.actions.includes("create_task") && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="size-3" />
              Tạo task
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DailyBriefPage() {
  const [brief, setBrief] = React.useState<ApiDailyBrief | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .getDailyBrief()
      .then(setBrief)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu hôm nay")
      )
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const highItems = brief?.items.filter((i) => i.severity === "high") ?? []
  const otherItems = brief?.items.filter((i) => i.severity !== "high") ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Việc cần làm hôm nay</h1>
          <p className="text-sm text-muted-foreground">
            Hệ thống tự động phát hiện và ưu tiên các vấn đề cần chú ý.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Làm mới
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !brief && (
        <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang phân tích dữ liệu học vụ...
        </div>
      )}

      {brief && brief.items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Info className="size-8" />
            <p className="text-sm font-medium">Không có vấn đề nổi bật hôm nay</p>
            <p className="text-xs">Tất cả chỉ số đang trong vùng bình thường.</p>
          </CardContent>
        </Card>
      )}

      {brief && brief.items.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              Hôm nay có{" "}
              <span className="text-foreground">{brief.items.length} việc cần chú ý</span>
            </span>
            {highItems.length > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                {highItems.length} ưu tiên cao
              </Badge>
            )}
          </div>

          {highItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                Ưu tiên cao — cần xử lý sớm
              </h2>
              {highItems.map((item) => (
                <BriefItemCard key={item.id} item={item} />
              ))}
            </section>
          )}

          {otherItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Theo dõi thêm
              </h2>
              {otherItems.map((item) => (
                <BriefItemCard key={item.id} item={item} />
              ))}
            </section>
          )}

          <p className="text-xs text-muted-foreground/60">
            Cập nhật lúc:{" "}
            {brief.generated_at
              ? new Date(brief.generated_at).toLocaleString("vi-VN")
              : "—"}
          </p>
        </>
      )}
    </div>
  )
}
