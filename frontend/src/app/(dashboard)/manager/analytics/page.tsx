"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Users, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, BookOpen,
  ArrowUp, ArrowDown, Minus, GraduationCap,
} from "lucide-react"
import { api, type ApiSection, type ApiSemester, type ApiProgram, type ApiDepartment, type ApiCourse, type ApiStudent, type ApiEnrollment } from "@/lib/api"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from "recharts"

/* ─── types ─── */
type Raw = {
  students:    ApiStudent[]
  enrollments: ApiEnrollment[]
  courses:     ApiCourse[]
  sections:    ApiSection[]
  semesters:   ApiSemester[]
  programs:    ApiProgram[]
  departments: ApiDepartment[]
}

type SemStats = {
  id: number; code: string; name: string
  enrolled: number; passed: number; failed: number
  passRate: number; avgGrade: number
  atRisk: number; warnSections: number
}

type DeptStats = {
  id: number; name: string
  enrolled: number; passRate: number; avgGrade: number; atRisk: number
}

/* ─── helpers ─── */
function shortName(name: string) {
  return name.replace(/^Khoa\s+/i, "").replace(/\s*-\s*/g, " - ")
}

function deptColor(rate: number) {
  if (rate >= 85) return "#22c55e"
  if (rate >= 70) return "#84cc16"
  if (rate >= 55) return "#f59e0b"
  return "#ef4444"
}

type DeltaVal = { d: number; up: boolean } | null
function calcDelta(cur: number, prev: number): DeltaVal {
  if (!prev) return null
  return { d: +(cur - prev).toFixed(1), up: cur >= prev }
}

function DeltaBadge({ delta, suffix = "", lowerIsBetter = false }: { delta: DeltaVal; suffix?: string; lowerIsBetter?: boolean }) {
  if (!delta) return null
  // For "lower is better" metrics (failures, warnings): positive delta means improvement
  const isGood = lowerIsBetter ? delta.up : delta.up
  const showDown = lowerIsBetter ? delta.up && delta.d !== 0 : !delta.up && delta.d !== 0
  const Icon = delta.d === 0 ? Minus : showDown ? ArrowDown : ArrowUp
  const cls = delta.d === 0 ? "text-muted-foreground" : isGood ? "text-emerald-600" : "text-red-500"
  const label = lowerIsBetter && delta.d !== 0
    ? `${Math.abs(delta.d)}${suffix} ít hơn vs HK trước`
    : `${Math.abs(delta.d)}${suffix} vs HK trước`
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

/* ─── page ─── */
export default function OverviewPage() {
  const [raw, setRaw]           = React.useState<Raw | null>(null)
  const [semester, setSemester] = React.useState("current")

  React.useEffect(() => {
    Promise.all([
      api.getStudents({ limit: 1000 }),
      api.getEnrollments({ limit: 50000 }),
      api.getCourses({ limit: 500 }),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
      api.getPrograms({ limit: 100 }),
      api.getDepartments({ limit: 20 }),
    ]).then(([students, enrollments, courses, sections, semesters, programs, departments]) =>
      setRaw({ students, enrollments, courses, sections, semesters, programs, departments })
    ).catch(console.error)
  }, [])

  const computed = React.useMemo(() => {
    if (!raw) return null
    const { students, enrollments, courses, sections, semesters, programs, departments } = raw

    const secMap    = new Map(sections.map(s    => [s.id, s]))
    const semMap    = new Map(semesters.map(s   => [s.id, s]))
    const courseMap = new Map(courses.map(c     => [c.id, c]))
    const progMap   = new Map(programs.map(p    => [p.id, p]))
    const deptMap   = new Map(departments.map(d => [d.id, d]))

    // course → first-program's department_id
    const courseDeptId = new Map<number, number>()
    for (const c of courses) {
      for (const pid of c.program_ids) {
        const p = progMap.get(pid)
        if (p) { courseDeptId.set(c.id, p.department_id); break }
      }
    }

    // Chronological semesters (oldest → newest)
    const sortedSems = [...semesters].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.term - b.term
    )
    const currentSem = semesters.find(s => s.is_current) ?? sortedSems.at(-1) ?? null

    // Which semester to focus on (for KPI cards + dept chart)
    const focusSemId: number | null =
      semester === "current" ? (currentSem?.id ?? null)
      : semester === "all"   ? null
      : (semesters.find(s => s.code === semester)?.id ?? null)

    /* ── per-semester stats builder ── */
    function semStats(semId: number): SemStats {
      const sem = semMap.get(semId)!
      const rows = enrollments.filter(e => {
        const sec = secMap.get(e.section_id)
        return sec?.semester_id === semId && e.is_passed !== null
      })
      const passed  = rows.filter(e => e.is_passed).length
      const failed  = rows.filter(e => !e.is_passed).length
      const grades  = rows.filter(e => e.final_grade !== null).map(e => e.final_grade!)
      const avgGrade = grades.length ? +(grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2) : 0

      const failStudents = new Set(rows.filter(e => !e.is_passed).map(e => e.student_id))

      // Sections with >40% fail
      const sMap = new Map<number, { t: number; f: number }>()
      for (const e of rows) {
        const s = sMap.get(e.section_id) ?? { t: 0, f: 0 }
        s.t++
        if (!e.is_passed) s.f++
        sMap.set(e.section_id, s)
      }
      const warnSections = [...sMap.values()].filter(s => s.t >= 5 && s.f / s.t > 0.4).length

      return {
        id: semId, code: sem.code, name: sem.name,
        enrolled: rows.length, passed, failed,
        passRate: rows.length ? +(passed / rows.length * 100).toFixed(1) : 0,
        avgGrade,
        atRisk: failStudents.size,
        warnSections,
      }
    }

    // Focus + previous semester stats
    const focusIdx = sortedSems.findIndex(s => s.id === focusSemId)
    const prevSemId = focusIdx > 0 ? sortedSems[focusIdx - 1].id : null

    const cur  = focusSemId ? semStats(focusSemId) : null
    const prev = prevSemId  ? semStats(prevSemId)  : null

    /* ── trend for all semesters ── */
    const trend = sortedSems
      .map(s => {
        const st = semStats(s.id)
        return { hk: s.code, name: s.name, passRate: st.passRate, avgGrade: st.avgGrade, enrolled: st.enrolled }
      })
      .filter(t => t.enrolled > 0)

    // Last 6 semesters for "grade fluctuation" comparison chart
    const last6 = trend.slice(-6)

    /* ── department stats for focused semester ── */
    const focusEnrolls = focusSemId == null
      ? enrollments.filter(e => e.is_passed !== null)
      : enrollments.filter(e => {
          const sec = secMap.get(e.section_id)
          return sec?.semester_id === focusSemId && e.is_passed !== null
        })

    const dAccum = new Map<number, { enr: number; pass: number; gs: number; gc: number; fail: Set<number> }>()
    for (const e of focusEnrolls) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const did = courseDeptId.get(sec.course_id); if (!did) continue
      const a = dAccum.get(did) ?? { enr: 0, pass: 0, gs: 0, gc: 0, fail: new Set() }
      a.enr++
      if (e.is_passed) a.pass++
      else a.fail.add(e.student_id)
      if (e.final_grade !== null) { a.gs += e.final_grade; a.gc++ }
      dAccum.set(did, a)
    }

    const deptStats: DeptStats[] = [...dAccum.entries()]
      .map(([did, a]) => ({
        id:       did,
        name:     deptMap.get(did)?.name ?? `Khoa ${did}`,
        enrolled: a.enr,
        passRate: a.enr ? +(a.pass / a.enr * 100).toFixed(1) : 0,
        avgGrade: a.gc  ? +(a.gs   / a.gc  ).toFixed(2)       : 0,
        atRisk:   a.fail.size,
      }))
      .sort((a, b) => b.passRate - a.passRate)

    /* ── action items ── */
    type ActionItem = { level: "high" | "medium"; unit: string; problem: string; suggestion: string }
    const actions: ActionItem[] = []

    const cStats = new Map<number, { t: number; f: number }>()
    for (const e of focusEnrolls) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const s = cStats.get(sec.course_id) ?? { t: 0, f: 0 }
      s.t++; if (!e.is_passed) s.f++
      cStats.set(sec.course_id, s)
    }
    for (const [cid, s] of cStats) {
      if (s.t < 5) continue
      const rate = s.f / s.t * 100
      const c = courseMap.get(cid); if (!c) continue
      const label = c.name.length > 35 ? c.name.slice(0, 35) + "…" : c.name
      if (rate > 40) actions.push({ level: "high",   unit: label, problem: `Fail rate ${rate.toFixed(0)}%`, suggestion: "Review đề thi / tăng cường hỗ trợ" })
      else if (rate > 25) actions.push({ level: "medium", unit: label, problem: `Fail rate ${rate.toFixed(0)}%`, suggestion: "Rà soát nội dung + tăng cường luyện tập" })
    }
    const nearFail = focusEnrolls.filter(e => e.final_grade !== null && e.final_grade >= 4.5 && e.final_grade < 5.0)
    if (nearFail.length) actions.push({ level: "medium", unit: "Toàn trường", problem: `${nearFail.length} lượt cận trượt (4.5–5.0)`, suggestion: "Gửi cảnh báo đến cố vấn học tập" })
    actions.sort((a, b) => (a.level === "high" ? -1 : 1) - (b.level === "high" ? -1 : 1))

    return { cur, prev, trend, last6, deptStats, actions, currentSem, sortedSems }
  }, [raw, semester])

  const semesters = raw?.semesters
    .slice()
    .sort((a, b) => a.year !== b.year ? b.year - a.year : b.term - a.term) ?? []

  if (!computed) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Đang tải dữ liệu toàn trường…
      </div>
    )
  }

  const { cur, prev, trend, last6, deptStats, actions, currentSem } = computed
  const activeStudents = raw?.students.filter(s => s.status === "active").length ?? 0

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
          <p className="text-sm text-muted-foreground">
            {currentSem ? `Học kỳ hiện tại: ${currentSem.name}` : "Trường Đại học Điện Lực — EPU"}
          </p>
        </div>
        <Select value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Học kỳ hiện tại</SelectItem>
            <SelectItem value="all">Tất cả học kỳ</SelectItem>
            {semesters.map(s => (
              <SelectItem key={s.id} value={s.code}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Semester summary banner ── */}
      {cur && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span className="font-semibold text-primary">{cur.name}</span>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <span><span className="text-2xl font-bold tabular-nums">{cur.enrolled.toLocaleString()}</span> <span className="text-muted-foreground">lượt thi</span></span>
                <span><span className="text-2xl font-bold tabular-nums text-emerald-600">{cur.passed.toLocaleString()}</span> <span className="text-muted-foreground">đạt</span></span>
                <span><span className="text-2xl font-bold tabular-nums text-red-500">{cur.failed.toLocaleString()}</span> <span className="text-muted-foreground">trượt</span></span>
                <span><span className="text-2xl font-bold tabular-nums">{activeStudents.toLocaleString()}</span> <span className="text-muted-foreground">SV đang học</span></span>
              </div>
              {prev && (
                <div className="ml-auto text-xs text-muted-foreground">
                  So với <strong>{prev.name}</strong>: pass rate {prev.passRate.toFixed(1)}% → {cur.passRate.toFixed(1)}%
                  <span className={cur.passRate >= prev.passRate ? " text-emerald-600 font-medium" : " text-red-500 font-medium"}>
                    {" "}({cur.passRate >= prev.passRate ? "▲" : "▼"}{Math.abs(cur.passRate - prev.passRate).toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 5 KPI Cards with delta ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            label: "SV đang học",
            value: activeStudents.toLocaleString(),
            delta: null as DeltaVal,
            lowerIsBetter: false,
            suffix: "",
            icon: <Users className="h-5 w-5 text-muted-foreground" />,
            alert: null as string | null,
          },
          {
            label: "Tỷ lệ qua môn",
            value: cur ? `${cur.passRate}%` : "—",
            delta: cur && prev ? calcDelta(cur.passRate, prev.passRate) : null,
            lowerIsBetter: false,
            suffix: "%",
            icon: <CheckCircle2 className={`h-5 w-5 ${!cur || cur.passRate >= 70 ? "text-emerald-500" : "text-destructive"}`} />,
            alert: cur && cur.passRate < 70 ? "< 70% ⚠" : null,
          },
          {
            label: "Điểm TB học kỳ",
            value: cur ? cur.avgGrade.toFixed(2) : "—",
            delta: cur && prev ? calcDelta(cur.avgGrade, prev.avgGrade) : null,
            lowerIsBetter: false,
            suffix: "",
            icon: <TrendingUp className={`h-5 w-5 ${!cur || cur.avgGrade >= 5.0 ? "text-primary" : "text-destructive"}`} />,
            alert: cur && cur.avgGrade < 5.0 ? "< 5.0 ⚠" : null,
          },
          {
            label: "SV trượt môn",
            value: cur ? cur.atRisk.toLocaleString() : "—",
            delta: cur && prev ? calcDelta(prev.atRisk, cur.atRisk) : null,
            lowerIsBetter: true,
            suffix: "",
            icon: <AlertTriangle className={`h-5 w-5 ${cur && cur.atRisk > 0 ? "text-destructive" : "text-muted-foreground"}`} />,
            alert: cur && cur.atRisk > 50 ? `${cur.atRisk} SV` : null,
          },
          {
            label: "Lớp cảnh báo",
            value: cur ? cur.warnSections.toLocaleString() : "—",
            delta: cur && prev ? calcDelta(prev.warnSections, cur.warnSections) : null,
            lowerIsBetter: true,
            suffix: "",
            icon: <BookOpen className={`h-5 w-5 ${cur && cur.warnSections > 0 ? "text-orange-500" : "text-muted-foreground"}`} />,
            alert: cur && cur.warnSections > 0 ? "Fail > 40%" : null,
          },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">{k.value}</p>
                  <DeltaBadge delta={k.delta} suffix={k.suffix} lowerIsBetter={k.lowerIsBetter} />
                  {k.alert && (
                    <Badge variant="destructive" className="mt-1 text-[10px] h-4 px-1.5">{k.alert}</Badge>
                  )}
                </div>
                <div className="shrink-0 mt-0.5">{k.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Two charts: pass rate trend | grade fluctuation last 6 semesters ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Trend toàn lịch sử */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tỷ lệ qua môn — toàn lịch sử (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ left: 4, right: 20, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hk" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={42} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={36} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Pass rate"]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3"
                  label={{ value: "70%", position: "right", fontSize: 10, fill: "#ef4444" }} />
                <Line type="monotone" dataKey="passRate" stroke="#22c55e" strokeWidth={2}
                  dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Grade fluctuation — last 6 semesters, both metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Biến động điểm TB — 6 học kỳ gần nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={last6} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hk" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={38} />
                <YAxis yAxisId="left"  domain={[0, 10]}  tick={{ fontSize: 10 }} width={28} />
                <YAxis yAxisId="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={38} orientation="right" />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    name === "avgGrade" ? v.toFixed(2) : `${v}%`,
                    name === "avgGrade" ? "Điểm TB" : "Pass rate",
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Legend formatter={v => v === "avgGrade" ? "Điểm TB (thang 10)" : "Pass rate (%)"} wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left"  dataKey="avgGrade" name="avgGrade"  fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="right" dataKey="passRate" name="passRate"  fill="#22c55e" radius={[3, 3, 0, 0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Department ranking ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Hiệu quả đào tạo theo Khoa
              {cur && <span className="font-normal text-muted-foreground ml-1">— {cur.name}</span>}
            </CardTitle>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />≥ 85%</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-lime-500" />≥ 70%</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />≥ 55%</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />{"< 55%"}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {deptStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Không có dữ liệu khoa cho học kỳ này</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Horizontal bar chart */}
              <ResponsiveContainer width="100%" height={deptStats.length * 44 + 20}>
                <BarChart
                  data={deptStats.map(d => ({ ...d, short: shortName(d.name) }))}
                  layout="vertical"
                  margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="short" tick={{ fontSize: 10 }} width={150} />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Pass rate"]}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  />
                  <ReferenceLine x={70} stroke="#ef4444" strokeDasharray="4 3" />
                  <Bar dataKey="passRate" radius={[0, 4, 4, 0]}>
                    {deptStats.map((d, i) => (
                      <Cell key={i} fill={deptColor(d.passRate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Table with ranks */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">#</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Khoa</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Lượt thi</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Pass rate</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Điểm TB</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">SV trượt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deptStats.map((d, i) => (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-xs font-bold text-muted-foreground">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                        </td>
                        <td className="py-2.5 px-2 text-xs font-medium max-w-[160px] leading-tight">
                          {shortName(d.name)}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-right tabular-nums">{d.enrolled.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right">
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: deptColor(d.passRate) + "22", color: deptColor(d.passRate) }}
                          >
                            {d.passRate}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-xs text-right tabular-nums font-medium">{d.avgGrade.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-xs text-right tabular-nums text-red-500">{d.atRisk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Action table ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Vấn đề cần xử lý ngay</CardTitle>
            <Badge
              variant={actions.filter(a => a.level === "high").length > 0 ? "destructive" : "secondary"}
              className="text-[10px]"
            >
              {actions.length} cảnh báo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-6 text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Không có cảnh báo trong học kỳ này
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground w-24">Mức độ</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Đơn vị</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Vấn đề</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Gợi ý xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {actions.map((a, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <Badge
                          variant={a.level === "high" ? "destructive" : "outline"}
                          className={`text-[10px] ${a.level === "medium" ? "border-orange-400 text-orange-600" : ""}`}
                        >
                          {a.level === "high" ? "🔴 Cao" : "🟡 TB"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium max-w-[180px]">{a.unit}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.problem}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
