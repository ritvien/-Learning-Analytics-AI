"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbArrow,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  parseAnalyticsFilters,
  serializeAnalyticsFilters,
  validateAnalyticsDateRange,
  type AnalyticsFilterState,
} from "@/lib/analytics-filters"
import {
  api,
  type ApiCourse,
  type ApiDashboardSections,
  type ApiDepartment,
  type ApiProgram,
  type ApiSemester,
  type ApiTeacher,
  type ApiUser,
} from "@/lib/api"
import {
  dataQualitySummary,
  drillSectionHierarchy,
  sectionActionLabel,
  sectionHierarchyLabel,
  sectionPriorityLabel,
  sectionRiskActionLabel,
  sectionRiskLabel,
} from "@/lib/section-analytics"

const PAGE_SIZE = 50
const RISK_COLORS: Record<string, string> = { high: "#dc2626", watch: "#f59e0b", pending: "#64748b", normal: "#16a34a" }
const EMPTY_SUMMARY: ApiDashboardSections["summary"] = {
  total_sections: 0,
  total_students: 0,
  needs_action_sections: 0,
  average_pass_rate: 0,
  missing_grade_count: 0,
  prediction_coverage: 0,
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function chartPayloadId(value: unknown) {
  const payload = value as { id?: unknown; payload?: { id?: unknown } }
  const parsed = Number(payload.payload?.id ?? payload.id)
  return Number.isFinite(parsed) ? parsed : null
}

function riskBadge(level: string) {
  if (level === "high") return <Badge variant="destructive">Ưu tiên</Badge>
  if (level === "watch") return <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700" variant="outline">Theo dõi</Badge>
  if (level === "pending") return <Badge variant="secondary">Thiếu điểm</Badge>
  return <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700" variant="outline">Ổn định</Badge>
}

function KpiCard({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: "danger" | "warning" }) {
  return <Card className={tone === "danger" ? "border-red-500/30" : tone === "warning" ? "border-amber-500/30" : ""}>
    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
    <CardContent><div className="text-2xl font-bold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent>
  </Card>
}

function buildSectionsSearch(filters: AnalyticsFilterState, riskLevel: string, query: string, teacherId: string, offset: number) {
  const params = new URLSearchParams(serializeAnalyticsFilters(filters))
  if (riskLevel !== "all") params.set("risk_level", riskLevel)
  if (query.trim()) params.set("q", query.trim())
  if (teacherId !== "all") params.set("teacher_id", teacherId)
  if (offset) params.set("offset", String(offset))
  return params.toString()
}

function TooltipShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border bg-background/95 p-3 text-xs shadow-lg">{children}</div>
}

function HierarchyTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return <TooltipShell><div className="font-medium">{String(row.label ?? row.name ?? "")}</div><p className="mt-1 text-muted-foreground">{sectionPriorityLabel(String(row.primary_reason ?? "normal"))} · nên drill xuống để chọn lớp cụ thể.</p><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground"><span>Tổng lớp</span><span className="text-right">{numberValue(row.section_count)}</span><span>Can thiệp</span><span className="text-right text-red-600">{numberValue(row.high_sections)}</span><span>Theo dõi</span><span className="text-right text-amber-600">{numberValue(row.watch_sections)}</span><span>Chờ điểm</span><span className="text-right">{numberValue(row.pending_sections)}</span><span>Tỷ lệ đạt</span><span className="text-right">{numberValue(row.pass_rate).toFixed(1)}%</span></div></TooltipShell>
}

function RiskTooltip({ active, payload, total }: { active?: boolean; payload?: Array<{ payload?: { label?: string; value?: number } }>; total: number }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return <TooltipShell><div className="font-medium">{row.label}</div><p className="mt-1 text-muted-foreground">{numberValue(row.value)} lớp · {total ? Math.round((numberValue(row.value) / total) * 100) : 0}% phạm vi hiện tại</p></TooltipShell>
}

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return <TooltipShell><div className="font-medium">{String(row.section_code ?? "")}</div><div className="text-muted-foreground">{String(row.course_code ?? "")} - {String(row.course_name ?? "")}</div><p className="mt-1 text-red-600">{sectionPriorityLabel(String(row.primary_reason ?? "normal"))}</p><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground"><span>Sinh viên</span><span className="text-right">{numberValue(row.student_count)}</span><span>Tỷ lệ đạt</span><span className="text-right">{numberValue(row.pass_rate).toFixed(1)}%</span><span>Điểm TB</span><span className="text-right">{numberValue(row.avg_grade).toFixed(2)}</span><span>Trượt</span><span className="text-right text-red-600">{numberValue(row.failed_count)}</span><span>Thiếu điểm</span><span className="text-right">{numberValue(row.missing_grade_count)}</span><span>Hành động</span><span className="text-right">{sectionActionLabel(String(row.recommended_action ?? "no_action"))}</span></div></TooltipShell>
}

function DataStateNotice({ status, error, onRetry }: { status?: string; error?: string; onRetry: () => void }) {
  if (error) return <Card className="border-destructive/40"><CardContent className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-destructive"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span><Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Thử lại</Button></CardContent></Card>
  if (status === "empty") return <Card><CardContent className="py-5 text-sm text-muted-foreground">Không có lớp học phần trong phạm vi/bộ lọc hiện tại. Hãy đổi học kỳ, risk bucket hoặc bỏ bớt bộ lọc nâng cao.</CardContent></Card>
  if (status === "stale") return <Card className="border-amber-500/30"><CardContent className="flex items-center gap-2 py-5 text-sm text-amber-800"><TriangleAlert className="h-4 w-4" />Dữ liệu cần được làm mới trước khi chốt quyết định chính thức.</CardContent></Card>
  return null
}

function EmptyVisual({ title, note }: { title: string; note: string }) {
  return <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center"><div className="text-sm font-medium">{title}</div><p className="mt-2 max-w-sm text-xs text-muted-foreground">{note}</p></div>
}

export default function SectionsAnalyticsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialFilters = React.useMemo(() => parseAnalyticsFilters(searchParams), [searchParams])
  const [filters, setFilters] = React.useState<AnalyticsFilterState>(initialFilters)
  const [riskLevel, setRiskLevel] = React.useState(searchParams.get("risk_level") ?? "all")
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "")
  const [teacherId, setTeacherId] = React.useState(searchParams.get("teacher_id") ?? "all")
  const [offset, setOffset] = React.useState(Number(searchParams.get("offset") ?? 0) || 0)
  const [advanced, setAdvanced] = React.useState(false)
  const [user, setUser] = React.useState<ApiUser | null>(null)
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [programs, setPrograms] = React.useState<ApiProgram[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [semesters, setSemesters] = React.useState<ApiSemester[]>([])
  const [teachers, setTeachers] = React.useState<ApiTeacher[]>([])
  const [data, setData] = React.useState<ApiDashboardSections | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [reloadKey, setReloadKey] = React.useState(0)
  const pendingUrlSync = React.useRef<string | null>(null)

  React.useEffect(() => {
    let active = true
    Promise.all([
      api.me(), api.getDepartments({ limit: 100 }), api.getPrograms({ limit: 500 }),
      api.getCourses({ limit: 500 }), api.getSemesters(), api.getTeachers({ limit: 500 }),
    ]).then(([me, nextDepartments, nextPrograms, nextCourses, nextSemesters, nextTeachers]) => {
      if (!active) return
      setUser(me); setDepartments(nextDepartments); setPrograms(nextPrograms); setCourses(nextCourses)
      setSemesters(nextSemesters); setTeachers(nextTeachers)
      if ((me.role === "manager" || me.role === "lecturer") && me.department_id) {
        setFilters((current) => ({ ...current, department_id: me.department_id ?? undefined }))
      }
      if (me.role === "lecturer") setTeacherId("all")
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Không tải được danh mục bộ lọc.") })
    return () => { active = false }
  }, [])

  React.useEffect(() => {
    const current = searchParams.toString()
    if (pendingUrlSync.current === current) {
      pendingUrlSync.current = null
      return
    }
    setFilters(parseAnalyticsFilters(searchParams))
    setRiskLevel(searchParams.get("risk_level") ?? "all")
    setQuery(searchParams.get("q") ?? "")
    setTeacherId(searchParams.get("teacher_id") ?? "all")
    setOffset(Number(searchParams.get("offset") ?? 0) || 0)
  }, [searchParams])

  React.useEffect(() => {
    const next = buildSectionsSearch(filters, riskLevel, query, teacherId, offset)
    if (next !== searchParams.toString()) {
      pendingUrlSync.current = next
      router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false })
    }
  }, [filters, offset, pathname, query, riskLevel, router, searchParams, teacherId])

  React.useEffect(() => {
    if (!user) return
    const dateError = validateAnalyticsDateRange(filters)
    if (dateError) { setError(dateError); setData(null); setLoading(false); return }
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true); setError("")
      api.getDashboardSections({
        ...filters, q: query.trim() || undefined, teacher_id: teacherId === "all" ? undefined : Number(teacherId),
        risk_level: riskLevel === "all" ? undefined : riskLevel, limit: PAGE_SIZE, offset,
      }).then((payload) => { if (active) setData(payload) }).catch((reason: unknown) => {
        if (!active) return
        const message = reason instanceof Error ? reason.message : "Không tải được phân tích lớp học phần."
        setError(message.includes("403") ? "Bộ lọc nằm ngoài phạm vi tài khoản." : message); setData(null)
      }).finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [filters, offset, query, reloadKey, riskLevel, teacherId, user])

  const scoped = user?.role === "manager" || user?.role === "lecturer"
  const filteredPrograms = filters.department_id ? programs.filter((row) => row.department_id === filters.department_id) : programs
  const filteredCourses = courses.filter((course) => (!filters.department_id || course.department_id === filters.department_id)
    && (!filters.program_id || course.program_ids.includes(filters.program_id)))
  const filteredTeachers = filters.department_id ? teachers.filter((row) => row.department_id === filters.department_id) : teachers
  const update = (patch: Partial<AnalyticsFilterState>) => { setOffset(0); setFilters((current) => ({ ...current, ...patch })) }
  const currentSearch = buildSectionsSearch(filters, riskLevel, query, teacherId, offset)
  const openSection = (id: number) => {
    const params = new URLSearchParams(currentSearch)
    params.set("section_id", String(id))
    params.set("source", "sections")
    router.push(`/manager/analytics/sections/${id}?${params.toString()}`)
  }
  const drillHierarchy = (id: number) => {
    if (!hierarchy) return
    setOffset(0); setFilters((current) => drillSectionHierarchy(current, hierarchy.level, id))
  }
  const summary = data ? (data.summary ?? EMPTY_SUMMARY) : null
  const hierarchy = data?.hierarchy ?? null
  const riskData = (data?.risk_distribution ?? []).map((row) => ({ ...row, label: sectionRiskActionLabel(row.risk_level) }))
  const matrixData = (data?.section_matrix ?? []).map((row) => ({ ...row, x: numberValue(row.pass_rate), y: numberValue(row.avg_grade), z: Math.max(60, row.student_count * 8) }))
  const topHotspots = matrixData.slice(0, 3)
  const needsActionTotal = riskData.filter((row) => row.risk_level !== "normal").reduce((sum, row) => sum + row.value, 0)
  const showStatusBadge = data?.data_status === "stale"

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <button disabled={scoped} className="hover:text-primary disabled:cursor-default" onClick={() => update({ department_id: undefined, program_id: undefined, course_id: undefined })}>Toàn trường</button>
        {filters.department_id ? <><BreadcrumbArrow className="h-3 w-3" /><button className="hover:text-primary" onClick={() => update({ program_id: undefined, course_id: undefined })}>{departments.find((row) => row.id === filters.department_id)?.name ?? `Khoa #${filters.department_id}`}</button></> : null}
        {filters.program_id ? <><BreadcrumbArrow className="h-3 w-3" /><button className="hover:text-primary" onClick={() => update({ course_id: undefined })}>{programs.find((row) => row.id === filters.program_id)?.name ?? `Ngành #${filters.program_id}`}</button></> : null}
        {filters.course_id ? <><BreadcrumbArrow className="h-3 w-3" /><span>{courses.find((row) => row.id === filters.course_id)?.name ?? `Môn #${filters.course_id}`}</span></> : null}
      </div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Lớp & sinh viên cần chú ý</h1>{showStatusBadge ? <Badge variant="secondary">Cần làm mới</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">Xác định nơi cần can thiệp và đi tới bằng chứng sinh viên trong tối đa hai click.</p></div>
      <Button variant="outline" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button>
    </div>

    <Card><CardContent className="space-y-3 pt-6"><div className="flex flex-wrap gap-2">
      <Select value={filters.semester_code ?? "all"} onValueChange={(value) => update({ semester_code: !value || value === "all" ? undefined : value, section_id: undefined })}><SelectTrigger className="w-52"><span>{semesters.find((row) => row.code === filters.semester_code)?.name ?? "Tất cả học kỳ"}</span></SelectTrigger><SelectContent><SelectItem value="all">Tất cả học kỳ</SelectItem>{semesters.map((row) => <SelectItem key={row.id} value={row.code}>{row.name}</SelectItem>)}</SelectContent></Select>
      <Select disabled={scoped} value={filters.department_id ? String(filters.department_id) : "all"} onValueChange={(value) => update({ department_id: !value || value === "all" ? undefined : Number(value), program_id: undefined, course_id: undefined, section_id: undefined })}><SelectTrigger className="w-52"><span>{departments.find((row) => row.id === filters.department_id)?.name ?? "Tất cả khoa"}</span></SelectTrigger><SelectContent><SelectItem value="all">Tất cả khoa</SelectItem>{departments.map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.name}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.course_id ? String(filters.course_id) : "all"} onValueChange={(value) => update({ course_id: !value || value === "all" ? undefined : Number(value), section_id: undefined })}><SelectTrigger className="w-56"><span>{courses.find((row) => row.id === filters.course_id)?.name ?? "Tất cả môn"}</span></SelectTrigger><SelectContent><SelectItem value="all">Tất cả môn</SelectItem>{filteredCourses.map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.code} - {row.name}</SelectItem>)}</SelectContent></Select>
      <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => { setOffset(0); setQuery(event.target.value) }} placeholder="Tìm mã lớp, mã môn hoặc tên môn..." /></div>
      <Select value={riskLevel} onValueChange={(value) => { setOffset(0); setRiskLevel(value ?? "all") }}><SelectTrigger className="w-44"><span>{riskLevel === "all" ? "Mọi mức rủi ro" : sectionRiskLabel(riskLevel)}</span></SelectTrigger><SelectContent><SelectItem value="all">Mọi mức rủi ro</SelectItem><SelectItem value="high">Ưu tiên</SelectItem><SelectItem value="watch">Theo dõi</SelectItem><SelectItem value="pending">Thiếu điểm</SelectItem><SelectItem value="normal">Ổn định</SelectItem></SelectContent></Select>
      <Button variant="outline" onClick={() => setAdvanced((value) => !value)}><SlidersHorizontal className="mr-2 h-4 w-4" />Bộ lọc nâng cao</Button>
    </div>{advanced ? <div className="flex flex-wrap gap-2 border-t pt-3">
      <Select value={filters.program_id ? String(filters.program_id) : "all"} onValueChange={(value) => update({ program_id: !value || value === "all" ? undefined : Number(value), course_id: undefined, section_id: undefined })}><SelectTrigger className="w-52"><span>{programs.find((row) => row.id === filters.program_id)?.name ?? "Tất cả ngành"}</span></SelectTrigger><SelectContent><SelectItem value="all">Tất cả ngành</SelectItem>{filteredPrograms.map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.name}</SelectItem>)}</SelectContent></Select>
      {user?.role === "lecturer" ? <div className="flex h-10 w-52 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">Giảng viên của tôi</div> : <Select value={teacherId} onValueChange={(value) => { setOffset(0); setTeacherId(value ?? "all") }}><SelectTrigger className="w-52"><span>{teachers.find((row) => String(row.id) === teacherId)?.full_name ?? "Tất cả giảng viên"}</span></SelectTrigger><SelectContent><SelectItem value="all">Tất cả giảng viên</SelectItem>{filteredTeachers.map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.full_name}</SelectItem>)}</SelectContent></Select>}
      <Input type="date" className="w-40" value={filters.date_from?.slice(0, 10) ?? ""} onChange={(event) => update({ date_from: event.target.value || undefined })} aria-label="Từ ngày" /><Input type="date" className="w-40" value={filters.date_to?.slice(0, 10) ?? ""} onChange={(event) => update({ date_to: event.target.value || undefined })} aria-label="Đến ngày" />
    </div> : null}</CardContent></Card>

    <DataStateNotice status={data?.data_status} error={error} onRetry={() => setReloadKey((value) => value + 1)} />
    {loading && !data ? <div className="py-20 text-center text-sm text-muted-foreground">Đang tổng hợp dashboard can thiệp...</div> : null}
    {summary ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><KpiCard label="Tổng lớp" value={summary.total_sections} note={`${summary.total_students} sinh viên trong phạm vi`} /><KpiCard label="Cần can thiệp" value={summary.needs_action_sections} note="Ưu tiên, theo dõi hoặc thiếu điểm" tone="danger" /><KpiCard label="Tỷ lệ đạt" value={`${numberValue(summary.average_pass_rate).toFixed(1)}%`} note="Trên toàn bộ lớp đã lọc" /><KpiCard label="Thiếu điểm" value={summary.missing_grade_count} note="Bản ghi chưa có điểm tổng kết" tone="warning" /><KpiCard label="Độ phủ ML" value={`${Math.round(numberValue(summary.prediction_coverage) * 100)}%`} note="Sinh viên có prediction" /></div> : null}

    <Card className="border-red-500/20"><CardHeader><CardTitle className="text-base">Top điểm nóng cần xử lý</CardTitle><p className="text-xs text-muted-foreground">Ba lớp có điểm ưu tiên cao nhất trong phạm vi hiện tại.</p></CardHeader><CardContent className={topHotspots.length ? "grid gap-3 md:grid-cols-3" : ""}>{topHotspots.length ? topHotspots.map((row, index) => <button key={row.id} className="rounded-lg border p-4 text-left transition hover:bg-muted/40" onClick={() => openSection(row.id)}><div className="flex items-center justify-between gap-2"><Badge variant={index === 0 ? "destructive" : "secondary"}>#{index + 1}</Badge><span className="text-xs text-muted-foreground">Score {numberValue(row.priority_score)}</span></div><div className="mt-3 font-semibold">{row.section_code}</div><div className="truncate text-xs text-muted-foreground">{row.course_code} - {row.course_name}</div><div className="mt-3 text-sm text-red-700">{sectionPriorityLabel(row.primary_reason)}</div><div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground"><span>{row.student_count} SV</span><span>{numberValue(row.pass_rate).toFixed(1)}% đạt</span><span>{row.failed_count} trượt</span></div></button>) : <EmptyVisual title="Chưa có điểm nóng" note="Chọn học kỳ/khoa/môn khác hoặc chạy ETL analytics để có section_matrix ưu tiên." />}</CardContent></Card>

    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">{filters.course_id ? "Lớp cần can thiệp trong môn này" : sectionHierarchyLabel(hierarchy?.level ?? "department")}</CardTitle><p className="text-xs text-muted-foreground">Click một thanh để đi sâu xuống cấp tiếp theo.</p></CardHeader><CardContent className="h-[340px]">{hierarchy?.items.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={(hierarchy?.items ?? []).map((row) => ({ ...row, label: `${row.code} · ${row.name}` }))} layout="vertical" margin={{ left: 24, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} /><Tooltip content={<HierarchyTooltip />} /><Legend /><Bar dataKey="high_sections" name="Can thiệp ngay" stackId="risk" fill={RISK_COLORS.high} onClick={(row) => { const id = chartPayloadId(row); if (id) drillHierarchy(id) }} cursor="pointer" /><Bar dataKey="watch_sections" name="Theo dõi sát" stackId="risk" fill={RISK_COLORS.watch} onClick={(row) => { const id = chartPayloadId(row); if (id) drillHierarchy(id) }} cursor="pointer" /><Bar dataKey="pending_sections" name="Chờ điểm" stackId="risk" fill={RISK_COLORS.pending} onClick={(row) => { const id = chartPayloadId(row); if (id) drillHierarchy(id) }} cursor="pointer" /><Bar dataKey="normal_sections" name="Ổn định" stackId="risk" fill={RISK_COLORS.normal} onClick={(row) => { const id = chartPayloadId(row); if (id) drillHierarchy(id) }} cursor="pointer" /></BarChart></ResponsiveContainer> : <EmptyVisual title="Chưa có dữ liệu phân cấp" note="Chart sẽ hiện Khoa/Ngành/Môn sau khi API aggregate trả hierarchy.items." />}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Risk mix & hành động</CardTitle><p className="text-xs text-muted-foreground">Click một nhóm để lọc bảng ưu tiên.</p></CardHeader><CardContent className="h-[340px]">{riskData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><text x="50%" y="45%" textAnchor="middle" className="fill-foreground text-2xl font-bold">{needsActionTotal}</text><text x="50%" y="53%" textAnchor="middle" className="fill-muted-foreground text-xs">lớp cần xử lý</text><Pie data={riskData} dataKey="value" nameKey="label" innerRadius={70} outerRadius={104} paddingAngle={3} onClick={(_, index) => { const selected = riskData[index]?.risk_level; if (selected) { setOffset(0); setRiskLevel(selected === riskLevel ? "all" : selected) } }} cursor="pointer">{riskData.map((row) => <Cell key={row.risk_level} fill={RISK_COLORS[row.risk_level]} stroke={row.risk_level === riskLevel ? "currentColor" : "transparent"} strokeWidth={3} />)}</Pie><Tooltip content={<RiskTooltip total={summary?.total_sections ?? 0} />} /><Legend /></PieChart></ResponsiveContainer> : <EmptyVisual title="Chưa có risk mix" note="Donut sẽ hiện khi aggregate có risk_distribution theo lớp." />}</CardContent></Card>
      <Card className="xl:col-span-3"><CardHeader><CardTitle className="text-base">Ma trận sức khỏe lớp</CardTitle><p className="text-xs text-muted-foreground">Vùng trái/dưới đường ngưỡng là nhóm cần xem trước: tỷ lệ đạt dưới 70% hoặc điểm TB dưới 5.5.</p></CardHeader><CardContent className="h-[360px]">{matrixData.length ? <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="x" name="Tỷ lệ đạt" unit="%" domain={[0, 100]} /><YAxis type="number" dataKey="y" name="Điểm TB" domain={[0, 10]} /><ZAxis type="number" dataKey="z" range={[60, 600]} /><ReferenceLine x={70} stroke="#ef4444" strokeDasharray="4 4" label="70% đạt" /><ReferenceLine y={5.5} stroke="#f59e0b" strokeDasharray="4 4" label="5.5 điểm" /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={<MatrixTooltip />} /><Scatter data={matrixData} onClick={(row) => { const id = chartPayloadId(row); if (id) openSection(id) }} cursor="pointer">{matrixData.map((row) => <Cell key={row.id} fill={RISK_COLORS[row.risk_level]} fillOpacity={row.risk_level === "high" ? 0.95 : 0.65} stroke={row.risk_level === "high" ? "#7f1d1d" : "transparent"} strokeWidth={row.risk_level === "high" ? 2 : 0} />)}</Scatter></ScatterChart></ResponsiveContainer> : <EmptyVisual title="Chưa có lớp để vẽ ma trận" note="Scatter sẽ hiện tối đa 40 lớp ưu tiên khi section_matrix có dữ liệu." />}</CardContent></Card>
    </div>

    <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Lớp cần xử lý trước</CardTitle><p className="mt-1 text-xs text-muted-foreground">Xếp theo mức rủi ro, số lượt trượt và thiếu điểm.</p></div>{data ? <Badge variant="outline">{data.pagination.total} lớp</Badge> : null}</CardHeader><CardContent>
      {!loading && data?.items.length === 0 ? <div className="py-14 text-center text-sm text-muted-foreground">Không có lớp phù hợp với bộ lọc hiện tại.</div> : null}
      {data?.items.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Lớp / môn</th><th className="p-3">Học kỳ</th><th className="p-3">Giảng viên</th><th className="p-3 text-right">SV</th><th className="p-3 text-right">Trượt</th><th className="p-3 text-right">Đạt</th><th className="p-3">Lý do chính</th><th className="p-3">Hành động gợi ý</th><th className="p-3">Trạng thái</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => openSection(row.id)}><td className="p-3"><div className="font-medium">{row.section_code}</div><div className="text-xs text-muted-foreground">{row.course_code} - {row.course_name}</div></td><td className="p-3">{row.semester_name}</td><td className="p-3">{row.teacher_name ?? "Chưa phân công"}</td><td className="p-3 text-right">{row.student_count}</td><td className="p-3 text-right font-medium text-red-600">{row.failed_count}</td><td className="p-3 text-right">{numberValue(row.pass_rate).toFixed(1)}%</td><td className="p-3">{sectionPriorityLabel(row.primary_reason)}</td><td className="p-3"><Badge variant={row.recommended_action === "intervene_now" ? "destructive" : "outline"}>{sectionActionLabel(row.recommended_action)}</Badge></td><td className="p-3">{riskBadge(row.risk_level)}</td></tr>)}</tbody></table></div> : null}
      {data ? <div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{data.pagination.total ? offset + 1 : 0}–{Math.min(offset + data.items.length, data.pagination.total)} / {data.pagination.total}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft className="h-4 w-4" /></Button><Button size="sm" variant="outline" disabled={!data.pagination.has_more} onClick={() => setOffset(offset + PAGE_SIZE)}><ChevronRight className="h-4 w-4" /></Button></div></div> : null}
    </CardContent></Card>
    {data ? <details className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Chất lượng dữ liệu · {dataQualitySummary(data.data_status, data.warnings)}</summary>{data.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-2">Không có lưu ý dữ liệu đáng kể.</p>}</details> : null}
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" />Mọi visual dùng aggregate toàn tập từ DWH/ML; bảng chỉ phân trang 50 lớp.</div>
  </div>
}
