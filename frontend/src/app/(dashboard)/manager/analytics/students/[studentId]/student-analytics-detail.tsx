"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  ListTodo,
  MessageSquareText,
  Phone,
  Search,
  Target,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api, type ApiHomeroomStudentAnalytics, type ApiInterventionContact, type ApiStudentSupportProfile } from "@/lib/api"

function riskPresentation(level: ApiHomeroomStudentAnalytics["risk"]["level"]) {
  if (level === "high") return { label: "Cần ưu tiên", className: "border-red-200 bg-red-50 text-red-700", icon: AlertTriangle }
  if (level === "watch") return { label: "Cần theo dõi", className: "border-amber-200 bg-amber-50 text-amber-700", icon: Target }
  return { label: "Ổn định", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 }
}

function resultLabel(value: boolean | null) {
  if (value === true) return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">Đạt</Badge>
  if (value === false) return <Badge variant="destructive">Chưa đạt</Badge>
  return <Badge variant="secondary">Chưa có điểm</Badge>
}

function studentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "Đang học",
    graduated: "Đã tốt nghiệp",
    suspended: "Tạm đình chỉ",
    expelled: "Buộc thôi học",
    dropout: "Đã thôi học",
    inactive: "Không hoạt động",
  }
  return labels[value.toLowerCase()] ?? value
}

function channelLabel(value: string) {
  const labels: Record<string, string> = {
    email: "Email",
    phone: "Điện thoại",
    meeting: "Hẹn gặp",
    in_person: "Trao đổi trực tiếp",
    other: "Khác",
  }
  return labels[value] ?? value
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    drafted: "Bản nháp",
    logged: "Đã ghi nhận",
    emailed: "Đã gửi email",
    failed: "Gửi lỗi",
  }
  return labels[value] ?? value
}

function contactScopeLabel(item: ApiInterventionContact) {
  if (item.section_id) return `Lớp học phần #${item.section_id}`
  if (item.class_code) return `Lớp cố vấn ${item.class_code}`
  return "Hồ sơ sinh viên"
}

function contactTitle(item: ApiInterventionContact) {
  return item.subject || (item.channel === "internal" ? "Thông báo nội bộ" : "Nhận xét học tập")
}

function contactMainText(item: ApiInterventionContact) {
  return item.message || item.subject || item.note || "Đã ghi nhận trao đổi"
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function formatFixed(value: unknown, digits = 1) {
  const numeric = toNumber(value)
  return numeric === null ? "—" : numeric.toFixed(digits)
}

function mergeInterventionHistory(
  current: ApiInterventionContact[],
  incoming: ApiInterventionContact[],
) {
  const byId = new Map<number, ApiInterventionContact>()
  for (const item of [...current, ...incoming]) {
    byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => {
    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return timeDiff || b.id - a.id
  })
}

type StudentAnalyticsDetailSnapshot = {
  data: ApiHomeroomStudentAnalytics | null
  history: ApiInterventionContact[]
  supportProfile: ApiStudentSupportProfile | null
}

const studentAnalyticsDetailCache = new Map<number, StudentAnalyticsDetailSnapshot>()

function updateStudentAnalyticsDetailCache(studentId: number, patch: Partial<StudentAnalyticsDetailSnapshot>) {
  const current = studentAnalyticsDetailCache.get(studentId) ?? {
    data: null,
    history: [],
    supportProfile: null,
  }
  studentAnalyticsDetailCache.set(studentId, { ...current, ...patch })
}

export function StudentAnalyticsDetail({ studentId }: { studentId: number }) {
  const cachedSnapshot = studentAnalyticsDetailCache.get(studentId)
  const [data, setData] = React.useState<ApiHomeroomStudentAnalytics | null>(cachedSnapshot?.data ?? null)
  const [loading, setLoading] = React.useState(!cachedSnapshot?.data)
  const [error, setError] = React.useState("")
  const [semesterFilter, setSemesterFilter] = React.useState("all")
  const [resultFilter, setResultFilter] = React.useState<"all" | "failed" | "passed">("all")
  const [query, setQuery] = React.useState("")
  const [history, setHistory] = React.useState<ApiInterventionContact[]>(cachedSnapshot?.history ?? [])
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [supportProfile, setSupportProfile] = React.useState<ApiStudentSupportProfile | null>(cachedSnapshot?.supportProfile ?? null)

  React.useEffect(() => {
    let active = true
    const cached = studentAnalyticsDetailCache.get(studentId)
    setError("")
    if (cached?.data) {
      setData(cached.data)
      setHistory(cached.history)
      setSupportProfile(cached.supportProfile)
      setLoading(false)
    } else {
      setData(null)
      setHistory([])
      setSupportProfile(null)
      setLoading(true)
    }
    api.getHomeroomStudentAnalytics(studentId)
      .then((response) => {
        if (!active) return
        setData(response)
        updateStudentAnalyticsDetailCache(studentId, { data: response })
      })
      .catch(() => {
        if (active && !cached?.data) {
          setError("Không thể mở phân tích sinh viên này. Hãy kiểm tra lại phạm vi lớp chủ nhiệm.")
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [studentId])

  React.useEffect(() => {
    if (!data) return
    let active = true
    setHistoryLoading(true)
    api.getInterventionHistory(studentId)
      .then((items) => {
        if (!active) return
        setHistory((current) => {
          const next = mergeInterventionHistory(current, items)
          updateStudentAnalyticsDetailCache(studentId, { history: next })
          return next
        })
      })
      .catch(() => {
        if (active) setHistory((current) => current)
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })
    return () => {
      active = false
    }
  }, [data, studentId])

  React.useEffect(() => {
    if (!data?.profile.class_code) return
    let active = true
    api.getStudentSupportProfile(studentId, { class_code: data.profile.class_code })
      .then((profile) => {
        if (!active) return
        setSupportProfile(profile)
        updateStudentAnalyticsDetailCache(studentId, { supportProfile: profile })
        setHistory((current) => {
          const next = mergeInterventionHistory(current, profile?.contact_history ?? [])
          updateStudentAnalyticsDetailCache(studentId, { history: next })
          return next
        })
      })
      .catch(() => {
        if (active) setSupportProfile(null)
      })
    return () => {
      active = false
    }
  }, [data?.profile.class_code, studentId])

  const semesters = React.useMemo(() => {
    if (!data) return []
    return [...new Set(data.course_results.map((row) => row.semester))]
  }, [data])

  const filteredResults = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    return (data?.course_results ?? []).filter((row) => {
      const matchesSemester = semesterFilter === "all" || row.semester === semesterFilter
      const matchesResult = resultFilter === "all"
        || (resultFilter === "failed" && row.is_passed === false)
        || (resultFilter === "passed" && row.is_passed === true)
      const matchesQuery = !normalizedQuery
        || row.course_name.toLocaleLowerCase("vi").includes(normalizedQuery)
        || row.course_code.toLocaleLowerCase("vi").includes(normalizedQuery)
      return matchesSemester && matchesResult && matchesQuery
    })
  }, [data, query, resultFilter, semesterFilter])

  if (loading) {
    return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Đang tổng hợp hồ sơ học tập sinh viên...</div>
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive/70" />
          <div>
            <p className="font-semibold">Không mở được hồ sơ sinh viên</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Link href="/manager/analytics/students" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại lớp chủ nhiệm</Link>
        </CardContent>
      </Card>
    )
  }

  const { profile, kpis, class_benchmark: benchmark, risk } = data
  const riskView = riskPresentation(risk.level)
  const RiskIcon = riskView.icon
  const latestTrend = data.trend.at(-1)
  const previousTrend = data.trend.at(-2)
  const gpaDelta = latestTrend?.gpa_semester !== null && latestTrend?.gpa_semester !== undefined
    && previousTrend?.gpa_semester !== null && previousTrend?.gpa_semester !== undefined
    ? latestTrend.gpa_semester - previousTrend.gpa_semester
    : null
  const creditPrediction = supportProfile?.signals.credit_progress_prediction ?? null
  const courseRiskItems = (supportProfile?.signals.course_predictions ?? [])
    .filter((item) => item.fail_probability !== null)
    .sort((a, b) => (toNumber(b.fail_probability) ?? 0) - (toNumber(a.fail_probability) ?? 0))
    .slice(0, 3)
  const weakCompetencies = [...data.competencies]
    .filter((competency) => (competency.score ?? 10) < 7)
    .sort((a, b) => (a.score ?? 10) - (b.score ?? 10))
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/manager/analytics/students" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-3 mb-2" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />Lớp chủ nhiệm
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{profile.full_name}</h1>
            <Badge variant="outline" className={riskView.className}><RiskIcon className="mr-1 h-3.5 w-3.5" />{riskView.label}</Badge>
            <Badge variant={profile.status === "active" ? "secondary" : "destructive"}>{studentStatusLabel(profile.status)}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{profile.student_code}</span>
            <span>Lớp {profile.class_code}</span>
            <span>{profile.program_name}</span>
            <span>Khóa {profile.cohort_code}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.phone ? <a href={`tel:${profile.phone}`} className={buttonVariants({ size: "sm", variant: "outline" })}><Phone className="mr-2 h-4 w-4" />Liên hệ</a> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "GPA tích lũy", value: profile.gpa_cumulative?.toFixed(2) ?? "—", note: "Thang điểm 4", icon: GraduationCap, tone: "text-primary" },
          { label: "Xếp hạng trong lớp", value: benchmark.gpa_rank ? `${benchmark.gpa_rank}/${benchmark.students_with_gpa}` : "—", note: `GPA lớp: ${benchmark.avg_gpa?.toFixed(2) ?? "—"}`, icon: Award, tone: "text-violet-600" },
          { label: "Tỷ lệ đạt", value: `${kpis.pass_rate.toFixed(1)}%`, note: `${kpis.passed_courses}/${kpis.completed_enrollments} lượt có kết quả`, icon: CheckCircle2, tone: "text-emerald-600" },
          { label: "Tín chỉ đạt", value: kpis.earned_credits, note: `${kpis.attempted_credits} tín chỉ đã có kết quả`, icon: BookOpen, tone: "text-sky-600" },
          { label: "Học phần chưa đạt", value: kpis.failed_courses, note: `${kpis.near_fail_courses} lượt cận ngưỡng`, icon: AlertTriangle, tone: kpis.failed_courses ? "text-red-600" : "text-muted-foreground" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between pb-5 pt-5">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
              </div>
              <item.icon className={`h-5 w-5 ${item.tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="border-amber-200/70">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Tín chỉ có nguy cơ kỳ này</CardTitle>
                <CardDescription>Ước tính từ các tín hiệu học tập hiện có; chưa kết luận chậm tốt nghiệp.</CardDescription>
              </div>
              <Badge variant="outline">{creditPrediction ? creditPrediction.risk_level : "Chưa đủ dữ liệu"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Đăng ký</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{creditPrediction ? formatFixed(creditPrediction.registered_credits) : "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Dự kiến đạt</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600">{creditPrediction ? formatFixed(creditPrediction.expected_passed_credits) : "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Có nguy cơ</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-orange-600">{creditPrediction ? formatFixed(creditPrediction.expected_failed_credits) : "—"}</p>
              </div>
            </div>
            {courseRiskItems.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Học phần kéo rủi ro lên</p>
                {courseRiskItems.map((item) => (
                  <div key={item.enrollment_id} className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm">
                    <div>
                      <p className="font-medium">{item.course_code} · {item.course_name}</p>
                      <p className="text-xs text-muted-foreground">{item.explanation?.reasons?.slice(0, 2).join("; ") || "Tín hiệu course-risk theo quy tắc"}</p>
                    </div>
                    <Badge variant={(toNumber(item.fail_probability) ?? 0) >= 0.6 ? "destructive" : "outline"}>
                      {Math.round((toNumber(item.fail_probability) ?? 0) * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">Chưa có học phần đang học đủ điểm thành phần để ước tính course-risk.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Năng lực cần chú ý</CardTitle>
                <CardDescription>CLO/PLO giúp giải thích yếu ở đâu, không chỉ mức rủi ro tổng.</CardDescription>
              </div>
              <Badge variant="outline">Dữ liệu mô phỏng từ điểm</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {weakCompetencies.length ? weakCompetencies.map((competency) => (
              <div key={competency.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold">{competency.code}</p>
                    <p className="text-xs text-muted-foreground">{competency.name}</p>
                  </div>
                  <span className="font-semibold tabular-nums">{(competency.score ?? 0).toFixed(1)}/10</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={(competency.score ?? 0) >= 5 ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-red-500"} style={{ width: `${Math.min(100, (competency.score ?? 0) * 10)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{competency.evidence_count} bằng chứng CLO · TB lớp {(competency.class_score ?? 0).toFixed(1)}</p>
              </div>
            )) : (
              <p className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">Chưa có CLO/PLO dưới ngưỡng hoặc chưa đủ dữ liệu mapping.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">GPA theo học kỳ</CardTitle>
                <CardDescription>Thang điểm 4; đường cảnh báo tại GPA 2.0.</CardDescription>
              </div>
              {gpaDelta !== null ? (
                <Badge variant={gpaDelta >= 0 ? "secondary" : "destructive"}>
                  {gpaDelta > 0 ? "+" : ""}{gpaDelta.toFixed(2)} so với kỳ trước
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {data.trend.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trend} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 10 }} width={28} />
                  <Tooltip
                    formatter={(value, name, item) => [
                      Number(value).toFixed(2),
                      name === "GPA sinh viên" ? `GPA sinh viên · ${item.payload.attempted_course_count} học phần` : "GPA trung bình lớp",
                    ]}
                    labelFormatter={(label) => `Học kỳ ${label}`}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="5 4" label={{ value: "Cảnh báo 2.0", fontSize: 10 }} />
                  <Line type="monotone" dataKey="gpa_semester" name="GPA sinh viên" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                  <Line type="monotone" dataKey="class_avg_gpa" name="GPA trung bình lớp" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-24 text-center text-sm text-muted-foreground">Chưa có dữ liệu GPA theo học kỳ.</p>
            )}
          </CardContent>
        </Card>

        <Card className={risk.level === "high" ? "border-red-200" : risk.level === "watch" ? "border-amber-200" : "border-emerald-200"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><RiskIcon className="h-4 w-4" />Nhận định cố vấn</CardTitle>
            <CardDescription>Tín hiệu quy tắc từ GPA và kết quả học phần, không phải dự đoán ML.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tín hiệu cần chú ý</p>
              {risk.reasons.length ? (
                <ul className="space-y-2 text-sm">{risk.reasons.map((reason) => <li key={reason} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{reason}</li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">Chưa phát hiện tín hiệu bất thường.</p>}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hành động đề xuất</p>
              <ol className="space-y-2 text-sm">{risk.recommendations.map((recommendation, index) => <li key={recommendation} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{index + 1}</span>{recommendation}</li>)}</ol>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card id="support-history" className="scroll-mt-24 border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><ListTodo className="h-4 w-4 text-primary" />Hỗ trợ học tập</CardTitle>
              <CardDescription>Hồ sơ sinh viên hiển thị lịch sử hỗ trợ đã lưu; Việc cần xử lý chỉ dùng để quản lý tác vụ, lịch hẹn và follow-up.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#support-history" className={buttonVariants({ size: "sm", variant: "outline" })}><MessageSquareText className="mr-2 h-4 w-4" />Xem lịch sử chi tiết</a>
              <Link href={`/manager/tasks?scope_type=homeroom&scope_id=${encodeURIComponent(profile.class_code)}&student_id=${studentId}`} className={buttonVariants({ size: "sm" })}><ListTodo className="mr-2 h-4 w-4" />Mở việc cần xử lý liên quan</Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tín hiệu dùng cho hỗ trợ</p>
            {risk.reasons.length ? (
              <ul className="space-y-2 text-sm">
                {risk.reasons.slice(0, 4).map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có cảnh báo lớn; có thể ghi nhận trao đổi định kỳ.</p>
            )}
          </div>
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lịch sử gần nhất</p>
              <Badge variant="secondary">{history.length} lượt</Badge>
            </div>
            {historyLoading ? (
              <p className="py-5 text-sm text-muted-foreground">Đang tải lịch sử...</p>
            ) : history.length ? (
              <div className="space-y-3">
                {history.slice(0, 3).map((item) => (
                  <details key={item.id} className="group border-l-2 border-primary/40 pl-3 text-sm" open={history.length <= 2}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{contactTitle(item)}</span>
                        <Badge variant="outline" className="text-[10px]">{channelLabel(item.channel)}</Badge>
                        <Badge variant={item.status === "emailed" ? "secondary" : "outline"} className="text-[10px]">{statusLabel(item.status)}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{contactMainText(item)}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{new Date(item.created_at).toLocaleString("vi-VN")}</p>
                      <span className="mt-1 inline-block text-xs font-medium text-primary group-open:hidden">Mở chi tiết</span>
                    </summary>
                    <div className="mt-2 rounded-md bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nội dung trao đổi</p>
                      <p className="mt-1 whitespace-pre-line">{contactMainText(item)}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{contactScopeLabel(item)}</span>
                        {item.actor_name ? <span>· Người ghi: {item.actor_name}</span> : null}
                      </div>
                      {item.note && item.note !== contactMainText(item) ? (
                        <p className="mt-2 rounded bg-background/70 p-2 text-xs text-muted-foreground">Ghi chú hệ thống: {item.note}</p>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="py-5 text-sm text-muted-foreground">Chưa có lượt trao đổi nào được lưu.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiến độ tín chỉ theo học kỳ</CardTitle>
            <CardDescription>Phân biệt tín chỉ đã đạt và chưa đạt để nhận diện nguy cơ chậm tiến độ.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.trend.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.trend} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                  <Tooltip formatter={(value, name) => [value, name === "passed_credits" ? "Tín chỉ đạt" : "Tín chỉ chưa đạt"]} />
                  <Legend formatter={(value) => value === "passed_credits" ? "Tín chỉ đạt" : "Tín chỉ chưa đạt"} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="passed_credits" stackId="credits" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed_credits" stackId="credits" fill="#ef4444" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-20 text-center text-sm text-muted-foreground">Chưa có dữ liệu tín chỉ.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Học phần cần củng cố</CardTitle>
            <CardDescription>So sánh điểm sinh viên với trung bình lớp; bấm cột để lọc lịch sử học phần.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.weak_courses.length ? (
              <ResponsiveContainer width="100%" height={Math.max(260, data.weak_courses.length * 46)}>
                <BarChart data={data.weak_courses} layout="vertical" margin={{ left: 0, right: 16, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="course_name" width={165} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name, item) => [Number(value).toFixed(2), name === "Điểm sinh viên" ? `${item.payload.semester} · ${item.payload.course_code}` : name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="final_grade" name="Điểm sinh viên" fill="#ef4444" radius={[0, 4, 4, 0]}>
                    {data.weak_courses.map((course) => <Cell key={`student-${course.id}`} fill={course.is_passed === false ? "#ef4444" : "#f59e0b"} onClick={() => { setQuery(course.course_code); setSemesterFilter("all") }} className="cursor-pointer" />)}
                  </Bar>
                  <Bar dataKey="class_avg_grade" name="Trung bình lớp" fill="#94a3b8" radius={[0, 4, 4, 0]}>
                    {data.weak_courses.map((course) => <Cell key={`class-${course.id}`} onClick={() => { setQuery(course.course_code); setSemesterFilter("all") }} className="cursor-pointer" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-20 text-center text-sm text-muted-foreground">Chưa có dữ liệu học phần để so sánh.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hồ sơ năng lực theo chuẩn đầu ra</CardTitle>
          <CardDescription>Điểm năng lực PLO tổng hợp từ bằng chứng CLO; vạch đứng là mức trung bình lớp.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.competencies.length ? (
            <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
              {data.competencies.map((competency) => {
                const score = competency.score ?? 0
                const classScore = competency.class_score ?? 0
                return (
                  <div key={competency.id}>
                    <div className="mb-2 flex items-start justify-between gap-3 text-sm">
                      <div><span className="font-semibold">{competency.code}</span><span className="ml-2 text-muted-foreground">{competency.name}</span></div>
                      <span className="shrink-0 font-semibold tabular-nums">{score.toFixed(1)}/10</span>
                    </div>
                    <div className="relative h-3 overflow-visible rounded-full bg-muted">
                      <div className={score >= 7 ? "h-full rounded-full bg-emerald-500" : score >= 5 ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-red-500"} style={{ width: `${Math.min(100, score * 10)}%` }} />
                      <span className="absolute -top-1 h-5 w-0.5 bg-foreground" style={{ left: `${Math.min(100, classScore * 10)}%` }} title={`Trung bình lớp ${classScore.toFixed(1)}`} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>{competency.evidence_count} bằng chứng CLO</span><span>TB lớp {classScore.toFixed(1)}</span></div>
                  </div>
                )
              })}
            </div>
          ) : <p className="py-10 text-center text-sm text-muted-foreground">Chưa có ánh xạ CLO/PLO đủ để tạo hồ sơ năng lực.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tỷ lệ đạt theo học kỳ</CardTitle>
          <CardDescription>Số học phần đạt trên tổng học phần đã có kết quả.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.trend.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} width={38} />
                <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="5 4" />
                <Tooltip formatter={(value, _name, item) => [`${Number(value).toFixed(1)}%`, `${item.payload.passed_course_count}/${item.payload.attempted_course_count} học phần đạt`]} />
                <Bar dataKey="pass_rate" radius={[5, 5, 0, 0]} maxBarSize={64}>
                  {data.trend.map((row) => <Cell key={row.id} fill={row.pass_rate >= 75 ? "#10b981" : row.pass_rate >= 50 ? "#f59e0b" : "#ef4444"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-20 text-center text-sm text-muted-foreground">Chưa có dữ liệu tỷ lệ đạt.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-base">Lịch sử học phần</CardTitle>
            <CardDescription>Tra cứu kết quả, lần học và học kỳ của từng học phần.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã hoặc tên học phần" className="h-9 pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={semesterFilter} onValueChange={(value) => setSemesterFilter(value ?? "all")}>
                <SelectTrigger className="w-40"><span>{semesterFilter === "all" ? "Tất cả học kỳ" : semesterFilter}</span></SelectTrigger>
                <SelectContent><SelectItem value="all">Tất cả học kỳ</SelectItem>{semesters.map((semester) => <SelectItem key={semester} value={semester}>{semester}</SelectItem>)}</SelectContent>
              </Select>
              {([[
                "all", "Tất cả",
              ], [
                "failed", "Chưa đạt",
              ], [
                "passed", "Đã đạt",
              ]] as const).map(([value, label]) => (
                <Button key={value} size="sm" variant={resultFilter === value ? "default" : "outline"} onClick={() => setResultFilter(value)}>{label}</Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-y bg-muted/40 text-xs text-muted-foreground">
              <th className="px-5 py-3 text-left font-medium">Học phần</th>
              <th className="px-3 py-3 text-left font-medium">Học kỳ</th>
              <th className="px-3 py-3 text-right font-medium">Tín chỉ</th>
              <th className="px-3 py-3 text-right font-medium">Điểm hệ 10</th>
              <th className="px-3 py-3 text-right font-medium">Điểm hệ 4</th>
              <th className="px-3 py-3 text-center font-medium">Lần học</th>
              <th className="px-5 py-3 text-right font-medium">Kết quả</th>
            </tr></thead>
            <tbody className="divide-y">
              {filteredResults.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3"><p className="font-medium">{row.course_name}</p><p className="font-mono text-xs text-muted-foreground">{row.course_code}</p></td>
                  <td className="px-3 py-3">{row.semester}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.credits}</td>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${row.is_passed === false ? "text-red-600" : ""}`}>{row.final_grade?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.grade_4?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{row.attempt_number}</td>
                  <td className="px-5 py-3 text-right">{resultLabel(row.is_passed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredResults.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Không có học phần phù hợp bộ lọc.</p> : null}
        </CardContent>
      </Card>

      <div className="text-right text-xs text-muted-foreground">
        Dữ liệu kết quả được tổng hợp từ DWH · {kpis.completed_enrollments} lượt học có kết quả
      </div>
    </div>
  )
}
