"use client"

import * as React from "react"
import {
  api,
  type ApiObservabilityEvent,
  type ApiObservabilitySession,
  type ApiObservabilityUserAggregate,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Filter,
  RefreshCw,
  Search,
  Terminal,
  User,
} from "lucide-react"

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = React.useState<string>("users")
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  // Data States
  const [userAggs, setUserAggs] = React.useState<ApiObservabilityUserAggregate[]>([])
  const [sessions, setSessions] = React.useState<ApiObservabilitySession[]>([])
  const [events, setEvents] = React.useState<ApiObservabilityEvent[]>([])

  // Filter States
  const [userIdFilter, setUserIdFilter] = React.useState<string>("")
  const [sessionIdFilter, setSessionIdFilter] = React.useState<string>("")
  const [eventNameFilter, setEventNameFilter] = React.useState<string>("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [selectedEvent, setSelectedEvent] = React.useState<ApiObservabilityEvent | null>(null)

  // Fetching Data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (activeTab === "users") {
        const res = await api.getObservabilityUserAggregates({
          user_id: userIdFilter || undefined,
          limit: 100,
        })
        setUserAggs(res.items)
      } else if (activeTab === "sessions") {
        const res = await api.getObservabilitySessions({
          user_id: userIdFilter || undefined,
          session_id: sessionIdFilter || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          limit: 100,
        })
        setSessions(res.items)
      } else if (activeTab === "events") {
        const res = await api.getObservabilityEvents({
          user_id: userIdFilter || undefined,
          session_id: sessionIdFilter || undefined,
          event_name: eventNameFilter || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          limit: 100,
        })
        setEvents(res.items)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu nhật ký hệ thống")
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, userIdFilter, sessionIdFilter, eventNameFilter, statusFilter])

  React.useEffect(() => {
    void fetchData()
  }, [fetchData])

  const formatTime = (timeStr: string) => {
    try {
      return new Date(timeStr).toLocaleString("vi-VN")
    } catch {
      return timeStr
    }
  }

  const formatDuration = (ms?: number | null) => {
    if (ms == null) return "-"
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="flex flex-col gap-5 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Nhật ký & Giám sát Hệ thống (Observability)
          </h1>
          <p className="text-sm text-muted-foreground">
            Bảng điều khiển dành riêng cho Superadmin để theo dõi hành vi người dùng, session và API trace.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Tải lại
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <User className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase">Tổng số người dùng hoạt động</div>
            <div className="text-2xl font-bold mt-1">{userAggs.length}</div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase">Phiên truy cập tải về (Sessions)</div>
            <div className="text-2xl font-bold mt-1">{sessions.length || "-"}</div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="rounded-full bg-amber-100 p-3 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase">Sự kiện tải về (Event Logs)</div>
            <div className="text-2xl font-bold mt-1">{events.length || "-"}</div>
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="rounded-lg border bg-card p-4 shadow-sm flex flex-col gap-3">
        <div className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" /> Bộ lọc nhanh
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">User ID</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Lọc theo User ID..."
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>

          {(activeTab === "sessions" || activeTab === "events") && (
            <div className="space-y-1">
              <Label className="text-xs">Session ID</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Lọc theo Session ID..."
                  value={sessionIdFilter}
                  onChange={(e) => setSessionIdFilter(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>
          )}

          {activeTab === "events" && (
            <div className="space-y-1">
              <Label className="text-xs">Tên sự kiện</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Ví dụ: chat_message_sent..."
                  value={eventNameFilter}
                  onChange={(e) => setEventNameFilter(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>
          )}

          {(activeTab === "sessions" || activeTab === "events") && (
            <div className="space-y-1">
              <Label className="text-xs">Trạng thái</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="success">Thành công (success)</SelectItem>
                  <SelectItem value="error">Lỗi (error)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-[450px]">
          <TabsTrigger value="users">Người dùng</TabsTrigger>
          <TabsTrigger value="sessions">Phiên truy cập</TabsTrigger>
          <TabsTrigger value="events">Sự kiện chi tiết</TabsTrigger>
        </TabsList>

        {/* Tab 1: User Aggregates */}
        <TabsContent value="users" className="mt-4">
          <div className="rounded-md border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left border-b text-muted-foreground font-medium text-xs">
                <tr>
                  <th className="p-3">User ID / Thông tin</th>
                  <th className="p-3">Quyền hạn (Role)</th>
                  <th className="p-3 text-center">Số Sessions</th>
                  <th className="p-3 text-center">Số Events</th>
                  <th className="p-3 text-center">Số API Requests</th>
                  <th className="p-3 text-center">Lỗi phát sinh</th>
                  <th className="p-3 text-center">Latency TB</th>
                  <th className="p-3">Hoạt động cuối</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground animate-pulse">
                      Đang tải dữ liệu người dùng...
                    </td>
                  </tr>
                ) : userAggs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Không tìm thấy dữ liệu hoạt động của người dùng nào.
                    </td>
                  </tr>
                ) : (
                  userAggs.map((agg) => (
                    <tr key={agg.user_id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-semibold">{agg.full_name || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">{agg.email || agg.user_id}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="capitalize">{agg.user_role}</Badge>
                      </td>
                      <td className="p-3 text-center font-medium">{agg.session_count}</td>
                      <td className="p-3 text-center text-muted-foreground">{agg.event_count}</td>
                      <td className="p-3 text-center text-muted-foreground">{agg.request_count}</td>
                      <td className="p-3 text-center">
                        {agg.error_count > 0 ? (
                          <Badge variant="destructive" className="font-mono">{agg.error_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-xs">{formatDuration(agg.avg_duration_ms)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatTime(agg.last_seen_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab 2: Sessions */}
        <TabsContent value="sessions" className="mt-4">
          <div className="rounded-md border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left border-b text-muted-foreground font-medium text-xs">
                <tr>
                  <th className="p-3">Session ID</th>
                  <th className="p-3">Người dùng</th>
                  <th className="p-3">Bắt đầu lúc</th>
                  <th className="p-3">Cuối cùng lúc</th>
                  <th className="p-3 text-center">Tổng sự kiện</th>
                  <th className="p-3 text-center">API calls</th>
                  <th className="p-3 text-center">Số lỗi</th>
                  <th className="p-3 text-center">Phản hồi TB</th>
                  <th className="p-3">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground animate-pulse">
                      Đang tải danh sách phiên truy cập...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Không tìm thấy phiên truy cập nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  sessions.map((sess) => (
                    <tr key={sess.session_id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs text-primary">{sess.session_id.substring(0, 18)}...</td>
                      <td className="p-3">
                        <div className="text-xs font-semibold">{sess.user_id || "Anonymous"}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{sess.user_role || "guest"}</div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{formatTime(sess.first_seen_at)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatTime(sess.last_seen_at)}</td>
                      <td className="p-3 text-center font-medium">{sess.event_count}</td>
                      <td className="p-3 text-center text-muted-foreground">{sess.request_count}</td>
                      <td className="p-3 text-center">
                        {sess.error_count > 0 ? (
                          <Badge variant="destructive" className="font-mono">{sess.error_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-xs">{formatDuration(sess.avg_duration_ms)}</td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setSessionIdFilter(sess.session_id)
                            setActiveTab("events")
                          }}
                        >
                          Xem Events
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab 3: Detailed Event Log */}
        <TabsContent value="events" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-md border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left border-b text-muted-foreground font-medium text-xs">
                  <tr>
                    <th className="p-3">Thời gian</th>
                    <th className="p-3">Sự kiện / Route</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-center">Thời gian</th>
                    <th className="p-3">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">
                        Đang tải danh sách sự kiện...
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Không tìm thấy sự kiện nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    events.map((evt) => (
                      <tr
                        key={evt.id}
                        className={`hover:bg-muted/30 cursor-pointer ${
                          selectedEvent?.id === evt.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                        }`}
                        onClick={() => setSelectedEvent(evt)}
                      >
                        <td className="p-3 text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatTime(evt.occurred_at)}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <Terminal className="h-3 w-3 text-muted-foreground" /> {evt.event_name}
                          </div>
                          {evt.route && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5 max-w-[280px] truncate">
                              {evt.route}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {evt.status === "error" || evt.error_code ? (
                            <Badge variant="destructive" className="text-[10px] h-5 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Error
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] h-5">Success</Badge>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-xs">{formatDuration(evt.duration_ms)}</td>
                        <td className="p-3">
                          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2">
                            Xem Payload
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Sidebar Event Payload Detail */}
            <div className="rounded-md border bg-card p-4 flex flex-col gap-3 min-h-[400px]">
              <div className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" /> Chi tiết Payload Sự kiện
              </div>
              {selectedEvent ? (
                <div className="flex-1 flex flex-col gap-3 text-xs overflow-hidden">
                  <div className="grid grid-cols-2 gap-2 border-b pb-3 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">ID Sự kiện:</span>
                      <span className="block font-mono font-bold">{selectedEvent.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trace ID:</span>
                      <span className="block font-mono text-primary select-all truncate" title={selectedEvent.trace_id ?? ""}>
                        {selectedEvent.trace_id || "N/A"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Session ID:</span>
                      <span className="block font-mono select-all text-xs truncate" title={selectedEvent.session_id ?? ""}>
                        {selectedEvent.session_id || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Module / Entity:</span>
                      <span className="block font-semibold">
                        {selectedEvent.module || "N/A"} / {selectedEvent.entity_type || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Error Code:</span>
                      <span className="block font-semibold text-destructive">
                        {selectedEvent.error_code || "None"}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <span className="text-muted-foreground mb-1">Payload JSON:</span>
                    <pre className="flex-1 bg-muted p-3 rounded-md font-mono text-[11px] overflow-auto border select-all max-h-[350px]">
                      {JSON.stringify(selectedEvent.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-muted-foreground text-xs p-4">
                  Chọn một sự kiện từ danh sách bên cạnh để kiểm tra chi tiết cấu trúc payload & trace context.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
