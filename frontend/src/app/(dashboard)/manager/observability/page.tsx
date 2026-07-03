"use client"

import * as React from "react"
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Cookie,
  Eye,
  Filter,
  GitBranch,
  MousePointerClick,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Terminal,
  User,
  Users,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  api,
  type ApiObservabilityEvent,
  type ApiObservabilitySession,
  type ApiObservabilityUserAggregate,
} from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TabKey = "overview" | "users" | "sessions" | "events"

const FUNNEL_STEPS = [
  { key: "tasks", label: "Mở việc cần xử lý", match: (event: ApiObservabilityEvent) => event.route?.startsWith("/manager/tasks") === true },
  { key: "case", label: "Mở/duyệt hồ sơ", match: (event: ApiObservabilityEvent) => event.event_name.includes("advisor") || event.event_name.includes("case") },
  { key: "assessment", label: "Chốt nhận định", match: (event: ApiObservabilityEvent) => event.event_name.includes("assessment") },
  { key: "notice", label: "Ghi thông báo", match: (event: ApiObservabilityEvent) => event.event_name.includes("notice") || event.event_name.includes("contact") },
  { key: "student", label: "Mở hồ sơ SV", match: (event: ApiObservabilityEvent) => event.route?.startsWith("/manager/analytics/students") === true },
  { key: "closed", label: "Đóng vòng xử lý", match: (event: ApiObservabilityEvent) => event.event_name.includes("closed") || event.route?.includes("/close") === true },
] as const

const EVENT_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"]

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("vi-VN")
  } catch {
    return value
  }
}

function formatDuration(ms?: number | null) {
  if (ms == null) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function durationBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(diff) || diff < 0) return "—"
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return `${Math.max(1, Math.round(diff / 1000))}s`
  if (minutes < 60) return `${minutes} phút`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function maskId(value?: string | null, head = 8, tail = 4) {
  if (!value) return "—"
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

function eventTone(event: ApiObservabilityEvent) {
  if (event.status === "error" || event.error_code) return "destructive" as const
  if (event.event_name.includes("denied") || event.event_name.includes("forbidden")) return "destructive" as const
  if (event.event_name.includes("agent") || event.event_name.includes("tool") || event.event_name.includes("retrieval")) return "secondary" as const
  return "outline" as const
}

function eventIcon(event: ApiObservabilityEvent) {
  if (event.status === "error" || event.error_code) return AlertTriangle
  if (event.event_name.includes("agent") || event.event_name.includes("tool") || event.event_name.includes("retrieval")) return Bot
  if (event.event_name.includes("click") || event.event_name.includes("filter")) return MousePointerClick
  if (event.event_name.includes("request") || event.route) return Route
  return Terminal
}

function eventLabel(event: ApiObservabilityEvent) {
  const labels: Record<string, string> = {
    page_view: "Mở trang",
    filter_change: "Đổi bộ lọc",
    button_clicked: "Bấm nút",
    http_request_completed: "API request",
    chat_message_submitted: "Gửi chat",
    agent_run_started: "Agent bắt đầu",
    agent_run_completed: "Agent hoàn tất",
    tool_call_started: "Tool bắt đầu",
    tool_call_completed: "Tool hoàn tất",
  }
  return labels[event.event_name] ?? event.event_name
}

function routeFromEvent(event: ApiObservabilityEvent) {
  const path = event.route ?? (typeof event.payload.path === "string" ? event.payload.path : null)
  return path ?? "—"
}

function uniqueCount<T>(items: T[], getter: (item: T) => string | null | undefined) {
  return new Set(items.map(getter).filter(Boolean)).size
}

function eventCategory(event: ApiObservabilityEvent) {
  if (event.status === "error" || event.error_code) return "Lỗi"
  if (event.event_name.includes("agent") || event.event_name.includes("tool") || event.event_name.includes("retrieval")) return "Agent/tool"
  if (event.event_name.includes("page") || event.event_name.includes("route")) return "Page view"
  if (event.event_name.includes("click") || event.event_name.includes("filter")) return "UI action"
  if (event.event_name.includes("request") || event.route?.startsWith("/api")) return "API"
  return "Khác"
}

function shortRoute(value: string) {
  if (value.length <= 42) return value
  return `${value.slice(0, 18)}…${value.slice(-20)}`
}

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = React.useState<TabKey>("overview")
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [userAggs, setUserAggs] = React.useState<ApiObservabilityUserAggregate[]>([])
  const [sessions, setSessions] = React.useState<ApiObservabilitySession[]>([])
  const [events, setEvents] = React.useState<ApiObservabilityEvent[]>([])
  const [userIdFilter, setUserIdFilter] = React.useState("")
  const [sessionIdFilter, setSessionIdFilter] = React.useState("")
  const [eventNameFilter, setEventNameFilter] = React.useState("")
  const [routeFilter, setRouteFilter] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [selectedEvent, setSelectedEvent] = React.useState<ApiObservabilityEvent | null>(null)
  const [selectedSession, setSelectedSession] = React.useState<ApiObservabilitySession | null>(null)

  const queryParams = React.useMemo(() => ({
    user_id: userIdFilter.trim() || undefined,
    session_id: sessionIdFilter.trim() || undefined,
    event_name: eventNameFilter.trim() || undefined,
    route: routeFilter.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  }), [eventNameFilter, routeFilter, sessionIdFilter, statusFilter, userIdFilter])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [usersRes, sessionsRes, eventsRes] = await Promise.all([
        api.getObservabilityUserAggregates({ ...queryParams, limit: 200 }),
        api.getObservabilitySessions({ ...queryParams, limit: 300 }),
        api.getObservabilityEvents({ ...queryParams, limit: 500 }),
      ])
      setUserAggs(usersRes.items)
      setSessions(sessionsRes.items)
      setEvents(eventsRes.items)
      setSelectedSession((current) => {
        if (!current) return sessionsRes.items[0] ?? null
        return sessionsRes.items.find((item) => item.session_id === current.session_id) ?? sessionsRes.items[0] ?? null
      })
      setSelectedEvent((current) => current && eventsRes.items.some((item) => item.id === current.id) ? current : eventsRes.items[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu theo dõi hành vi người dùng.")
    } finally {
      setIsLoading(false)
    }
  }, [queryParams])

  React.useEffect(() => {
    void fetchData()
  }, [fetchData])

  const selectedSessionEvents = React.useMemo(() => {
    if (!selectedSession) return []
    return events
      .filter((event) => event.session_id === selectedSession.session_id)
      .sort((left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime())
  }, [events, selectedSession])

  const recentErrors = React.useMemo(
    () => events.filter((event) => event.status === "error" || event.error_code).slice(0, 8),
    [events],
  )

  const topRoutes = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      const route = routeFromEvent(event)
      if (route === "—") continue
      counts.set(route, (counts.get(route) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [events])

  const routeChartData = React.useMemo(
    () => topRoutes.map(([route, count]) => ({ route, label: shortRoute(route), count })),
    [topRoutes],
  )

  const funnel = React.useMemo(() => FUNNEL_STEPS.map((step) => ({
    ...step,
    count: uniqueCount(events.filter(step.match), (event) => event.session_id ?? event.trace_id ?? String(event.id)),
  })), [events])

  const funnelChartData = React.useMemo(
    () => funnel.map((step, index) => {
      const previous = index === 0 ? step.count : Math.max(1, funnel[index - 1]?.count ?? 1)
      const conversion = index === 0 ? 100 : Math.min(100, Math.round((step.count / previous) * 100))
      return { name: step.label, count: step.count, conversion }
    }),
    [funnel],
  )

  const eventTrend = React.useMemo(() => {
    const sorted = [...events].sort((left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime())
    if (!sorted.length) return []
    const first = new Date(sorted[0].occurred_at).getTime()
    const last = new Date(sorted[sorted.length - 1].occurred_at).getTime()
    const bucketCount = Math.min(12, Math.max(4, Math.ceil(sorted.length / 35)))
    const bucketMs = Math.max(1, Math.ceil((last - first + 1) / bucketCount))
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(first + index * bucketMs)
      return {
        bucket: start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        events: 0,
        errors: 0,
        latency: 0,
        latencyCount: 0,
      }
    })
    for (const event of sorted) {
      const index = Math.min(bucketCount - 1, Math.floor((new Date(event.occurred_at).getTime() - first) / bucketMs))
      buckets[index].events += 1
      if (event.status === "error" || event.error_code) buckets[index].errors += 1
      if (event.duration_ms != null) {
        buckets[index].latency += event.duration_ms
        buckets[index].latencyCount += 1
      }
    }
    return buckets.map((bucket) => ({
      bucket: bucket.bucket,
      events: bucket.events,
      errors: bucket.errors,
      avgLatency: bucket.latencyCount ? Math.round(bucket.latency / bucket.latencyCount) : 0,
    }))
  }, [events])

  const eventMix = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      const category = eventCategory(event)
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({ name, value, fill: EVENT_COLORS[index % EVENT_COLORS.length] }))
  }, [events])

  const totalRequests = events.filter((event) => event.event_name === "http_request_completed").length
  const totalErrors = events.filter((event) => event.status === "error" || event.error_code).length
  const errorRate = events.length ? Math.round((totalErrors / events.length) * 1000) / 10 : 0
  const avgLatency = events.length
    ? events.reduce((sum, event) => sum + (event.duration_ms ?? 0), 0) / Math.max(1, events.filter((event) => event.duration_ms != null).length)
    : null
  const agentEvents = events.filter((event) => event.event_name.includes("agent") || event.event_name.includes("tool") || event.event_name.includes("retrieval")).length

  function openSession(session: ApiObservabilitySession) {
    setSelectedSession(session)
    setSessionIdFilter(session.session_id)
    setActiveTab("sessions")
  }

  function inspectUser(user: ApiObservabilityUserAggregate) {
    setUserIdFilter(user.user_id)
    setSessionIdFilter("")
    setActiveTab("sessions")
  }

  function clearFilters() {
    setUserIdFilter("")
    setSessionIdFilter("")
    setEventNameFilter("")
    setRouteFilter("")
    setStatusFilter("all")
  }

  return (
    <div className="flex flex-col gap-5 p-1">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Eye className="h-6 w-6 text-primary" />
            Theo dõi hành vi người dùng
          </h1>
          <p className="text-sm text-muted-foreground">
            Điều tra session, cookie định danh, event stream, API trace và hành trình thao tác của từng actor.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Tải lại
        </Button>
      </div>

      {error ? <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-3 text-sm text-destructive">{error}</CardContent></Card> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-8 w-8 rounded-full bg-primary/10 p-2 text-primary" /><div><p className="text-xs text-muted-foreground">Active users</p><p className="text-2xl font-bold">{userAggs.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Cookie className="h-8 w-8 rounded-full bg-sky-100 p-2 text-sky-700" /><div><p className="text-xs text-muted-foreground">Sessions/cookie</p><p className="text-2xl font-bold">{sessions.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Activity className="h-8 w-8 rounded-full bg-emerald-100 p-2 text-emerald-700" /><div><p className="text-xs text-muted-foreground">Events</p><p className="text-2xl font-bold">{events.length}</p></div></CardContent></Card>
        <Card className={totalErrors ? "border-red-200 bg-red-50/40" : ""}><CardContent className="flex items-center gap-3 p-4"><ShieldAlert className={`h-8 w-8 rounded-full p-2 ${totalErrors ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`} /><div><p className="text-xs text-muted-foreground">Error rate</p><p className={`text-2xl font-bold ${totalErrors ? "text-red-700" : ""}`}>{errorRate}%</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock className="h-8 w-8 rounded-full bg-amber-100 p-2 text-amber-700" /><div><p className="text-xs text-muted-foreground">Avg latency</p><p className="text-2xl font-bold">{formatDuration(avgLatency)}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4" />Bộ lọc điều tra</CardTitle>
          <CardDescription>Lọc theo user/session/route/event để nối từ cookie → session → event → API trace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">User ID</Label>
            <Input value={userIdFilter} onChange={(event) => setUserIdFilter(event.target.value)} className="h-9 text-xs" placeholder="uuid user..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Session ID / cookie</Label>
            <Input value={sessionIdFilter} onChange={(event) => setSessionIdFilter(event.target.value)} className="h-9 text-xs" placeholder="ei_session_id..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Route</Label>
            <Input value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} className="h-9 text-xs" placeholder="/manager/tasks" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Event name</Label>
            <Input value={eventNameFilter} onChange={(event) => setEventNameFilter(event.target.value)} className="h-9 text-xs" placeholder="page_view, http..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Trạng thái</Label>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={clearFilters}>Xóa</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="users">Người dùng</TabsTrigger>
          <TabsTrigger value="sessions">Session journey</TabsTrigger>
          <TabsTrigger value="events">Event explorer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />Event volume & lỗi theo thời gian</CardTitle>
                <CardDescription>Nhìn nhanh nhịp sử dụng, spike lỗi và latency trung bình trong tập event đang tải.</CardDescription>
              </CardHeader>
              <CardContent>
                {eventTrend.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={eventTrend} margin={{ left: 0, right: 18, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="errorsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                      <YAxis yAxisId="latency" orientation="right" tick={{ fontSize: 11 }} width={42} />
                      <Tooltip
                        formatter={(value, name) => [
                          name === "avgLatency" ? formatDuration(Number(value)) : value,
                          name === "events" ? "Events" : name === "errors" ? "Errors" : "Latency TB",
                        ]}
                        labelFormatter={(label) => `Mốc ${label}`}
                        contentStyle={{ borderRadius: 10, fontSize: 12 }}
                      />
                      <Area yAxisId="count" type="monotone" dataKey="events" stroke="#2563eb" strokeWidth={2.5} fill="url(#eventsFill)" name="events" />
                      <Area yAxisId="count" type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} fill="url(#errorsFill)" name="errors" />
                      <Area yAxisId="latency" type="monotone" dataKey="avgLatency" stroke="#f59e0b" strokeWidth={2} fill="transparent" name="avgLatency" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="py-24 text-center text-sm text-muted-foreground">Chưa có event để vẽ timeline.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4" />Cơ cấu event</CardTitle>
                <CardDescription>Phân nhóm event giúp biết log đang nghiêng về UI, API hay agent/tool.</CardDescription>
              </CardHeader>
              <CardContent>
                {eventMix.length ? (
                  <div className="grid items-center gap-3 sm:grid-cols-[180px_1fr] xl:grid-cols-1">
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie data={eventMix} innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" nameKey="name">
                          {eventMix.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip formatter={(value, name) => [value, name]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {eventMix.map((item) => (
                        <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />{item.name}</span>
                          <span className="font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="py-16 text-center text-sm text-muted-foreground">Chưa có event để phân loại.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" />Funnel nghiệp vụ</CardTitle>
                <CardDescription>Đếm session/trace đi qua các bước cố vấn xử lý sinh viên rủi ro.</CardDescription>
              </CardHeader>
              <CardContent>
                {funnelChartData.length ? (
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart data={funnelChartData} margin={{ left: 0, right: 16, top: 8, bottom: 54 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-22} textAnchor="end" height={64} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                      <Tooltip
                        formatter={(value, name, item) => [
                          name === "conversion" ? `${value}%` : value,
                          name === "count" ? "Sessions/traces" : `Chuyển đổi từ bước trước (${item.payload.conversion}%)`,
                        ]}
                        contentStyle={{ borderRadius: 10, fontSize: 12 }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {funnelChartData.map((entry, index) => (
                          <Cell key={entry.name} fill={index < 2 ? "#2563eb" : index < 4 ? "#8b5cf6" : "#10b981"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="py-24 text-center text-sm text-muted-foreground">Chưa có dữ liệu funnel.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Route className="h-4 w-4" />Top routes</CardTitle>
                <CardDescription>Route nhiều event nhất; bấm vào thanh để lọc route đó.</CardDescription>
              </CardHeader>
              <CardContent>
                {routeChartData.length ? (
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart data={routeChartData} layout="vertical" margin={{ left: 8, right: 22, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [value, "Events"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.route ?? ""} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                      <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]}>
                        {routeChartData.map((entry, index) => (
                          <Cell key={entry.route} fill={EVENT_COLORS[index % EVENT_COLORS.length]} onClick={() => setRouteFilter(entry.route)} className="cursor-pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="py-24 text-center text-sm text-muted-foreground">Chưa có route trong event log.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tín hiệu agent/chat</CardTitle>
                <CardDescription>Nối dashboard với agent/tool/retrieval trace.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Agent/tool</p><p className="mt-1 text-2xl font-bold">{agentEvents}</p></div>
                <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">API</p><p className="mt-1 text-2xl font-bold">{totalRequests}</p></div>
                <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Trace</p><p className="mt-1 text-2xl font-bold">{uniqueCount(events, (event) => event.trace_id)}</p></div>
              </CardContent>
            </Card>

            <Card className={recentErrors.length ? "border-red-200" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" />Lỗi & RBAC gần đây</CardTitle>
                <CardDescription>Ưu tiên các event có status error/error_code để debug quyền và API.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {recentErrors.length ? recentErrors.slice(0, 6).map((event) => (
                  <button key={event.id} type="button" onClick={() => { setSelectedEvent(event); setActiveTab("events") }} className="rounded-md border border-red-200 bg-red-50/50 p-3 text-left text-sm hover:bg-red-50">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium text-red-700">{eventLabel(event)}</span><Badge variant="destructive">{event.error_code ?? "error"}</Badge></div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{routeFromEvent(event)} · {formatTime(event.occurred_at)}</div>
                  </button>
                )) : <p className="py-8 text-center text-sm text-muted-foreground md:col-span-2">Chưa thấy lỗi trong tập event đang tải.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />Actor activity</CardTitle>
              <CardDescription>Bấm “Xem journey” để lọc session/event của actor đó.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-y bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-left">Người dùng</th><th className="px-3 py-3 text-left">Role</th><th className="px-3 py-3 text-center">Sessions</th><th className="px-3 py-3 text-center">Events</th><th className="px-3 py-3 text-center">Requests</th><th className="px-3 py-3 text-center">Errors</th><th className="px-3 py-3 text-center">Latency TB</th><th className="px-4 py-3 text-left">Last seen</th><th className="px-4 py-3 text-right">Hành động</th></tr></thead>
                <tbody className="divide-y">
                  {isLoading ? <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">Đang tải...</td></tr> : null}
                  {!isLoading && !userAggs.length ? <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">Không có dữ liệu user phù hợp.</td></tr> : null}
                  {userAggs.map((user) => (
                    <tr key={user.user_id} className="hover:bg-muted/30">
                      <td className="px-4 py-3"><div className="font-medium">{user.full_name || "N/A"}</div><div className="text-xs text-muted-foreground">{user.email || user.user_id}</div></td>
                      <td className="px-3 py-3"><Badge variant="outline">{user.user_role ?? "guest"}</Badge></td>
                      <td className="px-3 py-3 text-center font-medium">{user.session_count}</td>
                      <td className="px-3 py-3 text-center">{user.event_count}</td>
                      <td className="px-3 py-3 text-center">{user.request_count}</td>
                      <td className="px-3 py-3 text-center">{user.error_count ? <Badge variant="destructive">{user.error_count}</Badge> : "0"}</td>
                      <td className="px-3 py-3 text-center font-mono text-xs">{formatDuration(user.avg_duration_ms)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatTime(user.last_seen_at)}</td>
                      <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => inspectUser(user)}>Xem journey</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Cookie className="h-4 w-4" />Browser/app sessions</CardTitle>
                <CardDescription>`ei_session_id` nối page view và API request trong cùng trình duyệt; không hiển thị raw cookie/token.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessions.map((session) => (
                  <button key={session.session_id} type="button" onClick={() => setSelectedSession(session)} className={`w-full rounded-lg border p-3 text-left hover:bg-muted/40 ${selectedSession?.session_id === session.session_id ? "border-primary bg-primary/5" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{maskId(session.session_id)}</span>
                      {session.error_count ? <Badge variant="destructive">{session.error_count} lỗi</Badge> : <Badge variant="secondary">OK</Badge>}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {session.user_role ?? "guest"} · {maskId(session.user_id, 6, 4)} · {durationBetween(session.first_seen_at, session.last_seen_at)}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                      <span className="rounded bg-muted px-2 py-1">{session.event_count} events</span>
                      <span className="rounded bg-muted px-2 py-1">{session.request_count} API</span>
                      <span className="rounded bg-muted px-2 py-1">{formatDuration(session.avg_duration_ms)}</span>
                    </div>
                  </button>
                ))}
                {!sessions.length && !isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Không có session phù hợp.</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" />Session timeline</CardTitle>
                    <CardDescription>{selectedSession ? `Session ${maskId(selectedSession.session_id)} · ${selectedSessionEvents.length} event trong tập đang tải` : "Chọn một session để xem journey."}</CardDescription>
                  </div>
                  {selectedSession ? <Button size="sm" variant="outline" onClick={() => openSession(selectedSession)}>Lọc session này</Button> : null}
                </div>
              </CardHeader>
              <CardContent>
                {selectedSessionEvents.length ? (
                  <div className="space-y-3">
                    {selectedSessionEvents.map((event, index) => {
                      const Icon = eventIcon(event)
                      return (
                        <div key={event.id} className="grid grid-cols-[28px_1fr] gap-3">
                          <div className="flex flex-col items-center">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-background"><Icon className="h-3.5 w-3.5" /></span>
                            {index < selectedSessionEvents.length - 1 ? <span className="h-full min-h-5 w-px bg-border" /> : null}
                          </div>
                          <button type="button" onClick={() => { setSelectedEvent(event); setActiveTab("events") }} className="rounded-lg border p-3 text-left hover:bg-muted/40">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium">{eventLabel(event)}</div>
                              <Badge variant={eventTone(event)}>{event.status ?? (event.error_code ? "error" : "event")}</Badge>
                            </div>
                            <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{routeFromEvent(event)}</div>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{formatTime(event.occurred_at)}</span>
                              <span>{formatDuration(event.duration_ms)}</span>
                              <span>trace {maskId(event.trace_id, 6, 4)}</span>
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="py-16 text-center text-sm text-muted-foreground">Chưa có event timeline cho session này trong tập đang tải. Bấm “Lọc session này” để tải đúng session.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4" />Raw event explorer</CardTitle>
                <CardDescription>Dành cho debug sâu theo trace/session/request; payload đã được backend sanitize.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-y bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-left">Thời gian</th><th className="px-3 py-3 text-left">Event / route</th><th className="px-3 py-3 text-left">Session</th><th className="px-3 py-3 text-left">Trace</th><th className="px-3 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Latency</th></tr></thead>
                  <tbody className="divide-y">
                    {events.map((event) => (
                      <tr key={event.id} onClick={() => setSelectedEvent(event)} className={`cursor-pointer hover:bg-muted/30 ${selectedEvent?.id === event.id ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatTime(event.occurred_at)}</td>
                        <td className="px-3 py-3"><div className="font-medium">{eventLabel(event)}</div><div className="max-w-[340px] truncate font-mono text-xs text-muted-foreground">{routeFromEvent(event)}</div></td>
                        <td className="px-3 py-3 font-mono text-xs">{maskId(event.session_id, 6, 4)}</td>
                        <td className="px-3 py-3 font-mono text-xs">{maskId(event.trace_id, 6, 4)}</td>
                        <td className="px-3 py-3 text-center"><Badge variant={eventTone(event)}>{event.error_code ?? event.status ?? "event"}</Badge></td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{formatDuration(event.duration_ms)}</td>
                      </tr>
                    ))}
                    {!events.length && !isLoading ? <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Không có event phù hợp bộ lọc.</td></tr> : null}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" />Event detail</CardTitle>
                <CardDescription>Correlation IDs để nối frontend → API → agent/tool.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedEvent ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Event ID</p><p className="font-mono font-semibold">{selectedEvent.id}</p></div>
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Version</p><p className="font-mono font-semibold">{selectedEvent.event_version}</p></div>
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Session cookie</p><p className="truncate font-mono" title={selectedEvent.session_id ?? ""}>{selectedEvent.session_id ?? "—"}</p></div>
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Request ID</p><p className="truncate font-mono" title={selectedEvent.request_id ?? ""}>{selectedEvent.request_id ?? "—"}</p></div>
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Trace ID</p><p className="truncate font-mono" title={selectedEvent.trace_id ?? ""}>{selectedEvent.trace_id ?? "—"}</p></div>
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Agent/tool</p><p className="truncate font-mono">{selectedEvent.agent_run_id ?? selectedEvent.tool_call_id ?? "—"}</p></div>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Route / module</p>
                      <p className="break-all font-mono text-xs">{routeFromEvent(selectedEvent)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selectedEvent.module ?? "module —"} · {selectedEvent.entity_type ?? "entity —"} {selectedEvent.entity_id ?? ""}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Payload JSON</p>
                      <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted p-3 text-[11px]">{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
                    </div>
                  </div>
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">Chọn event để xem payload và correlation IDs.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
