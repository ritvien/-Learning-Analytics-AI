"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BookOpen, TrendingUp, Users, CheckCircle2, AlertTriangle } from "lucide-react"
import { api, type ApiSection, type ApiSemester } from "@/lib/api"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis
} from "recharts"

type Raw = {
  departments: Awaited<ReturnType<typeof api.getDepartments>>
  programs:    Awaited<ReturnType<typeof api.getPrograms>>
  courses:     Awaited<ReturnType<typeof api.getCourses>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  sections:    ApiSection[]
  semesters:   ApiSemester[]
  healths:     Awaited<ReturnType<typeof api.getCourseHealthBatch>>
}

const DIST_RANGES = [
  { label: "0–4",   min: 0,  max: 4,  color: "#ef4444" },
  { label: "4–5",   min: 4,  max: 5,  color: "#f97316" },
  { label: "5–6",   min: 5,  max: 6,  color: "#f59e0b" },
  { label: "6–7",   min: 6,  max: 7,  color: "#84cc16" },
  { label: "7–8",   min: 7,  max: 8,  color: "#22c55e" },
  { label: "8–10",  min: 8,  max: 10.1, color: "#10b981" },
]

export default function CourseAnalyticsPage() {
  const [raw, setRaw]         = React.useState<Raw | null>(null)
  const [selDept, setSelDept] = React.useState("all")
  const [selProg, setSelProg] = React.useState("all")
  const [selCourse, setSelCourse] = React.useState("all")

  React.useEffect(() => {
    Promise.all([
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 100 }),
      api.getCourses({ limit: 500 }),
      api.getEnrollments({ limit: 50000 }),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
    ]).then(async ([departments, programs, courses, enrollments, sections, semesters]) => {
      const healths = await api.getCourseHealthBatch(courses.map(c => c.id)).catch(() => [])
      setRaw({ departments, programs, courses, enrollments, sections, semesters, healths })
    }).catch(console.error)
  }, [])

  const maps = React.useMemo(() => {
    if (!raw) return null
    const secMap  = new Map(raw.sections.map(s => [s.id, s]))
    const semMap  = new Map(raw.semesters.map(s => [s.id, s]))
    return { secMap, semMap }
  }, [raw])

  // Filtered programs by dept
  const filteredPrograms = React.useMemo(() => {
    if (!raw) return []
    if (selDept === "all") return raw.programs
    return raw.programs.filter(p => p.department_id === Number(selDept))
  }, [raw, selDept])

  // Filtered courses by program
  const filteredCourses = React.useMemo(() => {
    if (!raw) return []
    if (selDept === "all" && selProg === "all") return raw.courses
    if (selProg !== "all") {
      return raw.courses.filter(c => c.program_ids?.includes(Number(selProg)))
    }
    // by dept: get all programs in dept
    const deptProgIds = new Set(raw.programs.filter(p => p.department_id === Number(selDept)).map(p => p.id))
    return raw.courses.filter(c => c.program_ids?.some(pid => deptProgIds.has(pid)))
  }, [raw, selDept, selProg])

  // All enrollments for selected course
  const courseEnrollments = React.useMemo(() => {
    if (!raw || !maps || selCourse === "all") return null
    const courseId = Number(selCourse)
    const sectionsForCourse = new Set(raw.sections.filter(s => s.course_id === courseId).map(s => s.id))
    return raw.enrollments.filter(e => sectionsForCourse.has(e.section_id))
  }, [raw, maps, selCourse])

  const courseStats = React.useMemo(() => {
    if (!raw || !maps || !courseEnrollments || selCourse === "all") return null
    const { secMap, semMap } = maps

    const valid = courseEnrollments.filter(e => e.is_passed !== null)
    const withGrade = courseEnrollments.filter(e => e.final_grade !== null)

    const totalEnrolls = valid.length
    const passRate     = totalEnrolls ? valid.filter(e => e.is_passed).length / totalEnrolls * 100 : 0
    const avgGrade     = withGrade.length ? withGrade.reduce((s, e) => s + e.final_grade!, 0) / withGrade.length : 0
    const sectionIds   = new Set(courseEnrollments.map(e => e.section_id))

    // Fail rate max
    const semPassMap = new Map<string, { passed: number; total: number; avg: number; cnt: number }>()
    for (const e of valid) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const sem = semMap.get(sec.semester_id); if (!sem) continue
      const t = semPassMap.get(sem.code) ?? { passed: 0, total: 0, avg: 0, cnt: 0 }
      t.total++
      if (e.is_passed) t.passed++
      if (e.final_grade !== null) { t.avg += e.final_grade; t.cnt++ }
      semPassMap.set(sem.code, t)
    }

    const trend = [...semPassMap.entries()]
      .map(([code, t]) => {
        const sem = raw.semesters.find(s => s.code === code)
        return {
          hk: code,
          order: sem ? `${sem.year}-${sem.term}` : code,
          passRate: t.total ? +(t.passed / t.total * 100).toFixed(1) : 0,
          avgGrade: t.cnt ? +(t.avg / t.cnt).toFixed(2) : 0,
        }
      })
      .sort((a, b) => a.order.localeCompare(b.order))

    const maxFailRate = trend.length ? Math.max(...trend.map(t => 100 - t.passRate)) : 0

    // Distribution
    const dist = DIST_RANGES.map(r => ({
      label: r.label,
      count: withGrade.filter(e => e.final_grade! >= r.min && e.final_grade! < r.max).length,
      color: r.color,
    }))

    // Per-section table
    const secTable = new Map<number, { code: string; semLabel: string; total: number; passed: number }>()
    for (const e of valid) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const sem = semMap.get(sec.semester_id)
      const s = secTable.get(e.section_id) ?? { code: sec.section_code, semLabel: sem?.name ?? "—", total: 0, passed: 0 }
      s.total++; if (e.is_passed) s.passed++
      secTable.set(e.section_id, s)
    }
    const overallPassRate = passRate
    const sections = [...secTable.values()]
      .filter(s => s.total >= 3)
      .map(s => ({ ...s, rate: +(s.passed / s.total * 100).toFixed(1), diff: +(s.passed / s.total * 100 - overallPassRate).toFixed(1) }))
      .sort((a, b) => a.rate - b.rate)

    return { totalEnrolls, passRate, avgGrade, sectionCount: sectionIds.size, maxFailRate, trend, dist, sections }
  }, [raw, maps, courseEnrollments, selCourse])

  const programOverview = React.useMemo(() => {
    if (!raw) return null
    const healthMap = new Map(raw.healths.map(h => [h.node_id, h]))
    
    const coursesWithHealth = filteredCourses.map(c => {
      const h = healthMap.get(c.id)
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        health: h?.health_score ?? 0,
        passRate: h?.metrics?.fail_rate !== undefined ? (1 - h.metrics.fail_rate) * 100 : 0,
        cloRate: h?.metrics?.clo_attainment_rate !== undefined ? h.metrics.clo_attainment_rate * 100 : 0,
        status: h?.status ?? "Unknown"
      }
    })

    const scatterData = coursesWithHealth.map(c => ({
      ...c,
      fill: c.status === "Healthy" ? "#22c55e" : c.status === "Warning" ? "#f59e0b" : c.status === "Critical" ? "#ef4444" : "#94a3b8"
    }))

    const sorted = [...coursesWithHealth].filter(c => c.health > 0).sort((a, b) => b.health - a.health)
    const top5 = sorted.slice(0, 5)
    const bottom5 = [...sorted].sort((a, b) => a.health - b.health).slice(0, 5)

    return { scatterData, top5, bottom5 }
  }, [raw, selProg, filteredCourses])

  const selectedCourseName = raw?.courses.find(c => c.id === Number(selCourse))?.name ?? ""

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Phân tích Môn học</h1>
        <p className="text-sm text-muted-foreground">Phân tích sâu một môn học qua nhiều học kỳ</p>
      </div>

      {/* 3-step filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">1</span>
              <Select value={selDept} onValueChange={v => { setSelDept(v ?? "all"); setSelProg("all"); setSelCourse("all") }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Chọn Khoa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả khoa</SelectItem>
                  {raw?.departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">2</span>
              <Select value={selProg} onValueChange={v => { setSelProg(v ?? "all"); setSelCourse("all") }} disabled={selDept === "all"}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Chọn Ngành" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả ngành</SelectItem>
                  {filteredPrograms.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">3</span>
              <Select value={selCourse} onValueChange={v => setSelCourse(v ?? "all")}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Chọn Môn học" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">— Chọn môn học —</SelectItem>
                  {filteredCourses.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selCourse === "all" ? (
        programOverview && filteredCourses.length > 0 ? (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div>
              <h2 className="text-lg font-semibold">
                Tổng quan {selProg !== "all" ? `Ngành: ${raw?.programs.find(p => p.id === Number(selProg))?.name}` : selDept !== "all" ? `Khoa: ${raw?.departments.find(d => d.id === Number(selDept))?.name}` : "Toàn trường"}
              </h2>
              <p className="text-sm text-muted-foreground">Phân tích tương quan {filteredCourses.length} môn học</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Tương quan Pass Rate & CLO</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="passRate" name="Pass Rate" unit="%" domain={[0, 100]} tick={{fontSize: 10}} />
                      <YAxis type="number" dataKey="cloRate" name="CLO" unit="%" domain={[0, 100]} tick={{fontSize: 10}} />
                      <ZAxis type="number" range={[60, 60]} />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-md shadow-md p-3 text-sm">
                                <p className="font-semibold">{data.code} - {data.name}</p>
                                <p className="text-muted-foreground mt-1">Health: <span className="font-medium text-foreground">{data.health}</span></p>
                                <p className="text-muted-foreground">Pass Rate: <span className="font-medium text-foreground">{data.passRate.toFixed(1)}%</span></p>
                                <p className="text-muted-foreground">CLO: <span className="font-medium text-foreground">{data.cloRate.toFixed(1)}%</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter data={programOverview.scatterData} fill="#8884d8">
                        {programOverview.scatterData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4">
                <Card className="flex-1 border-emerald-200/50 bg-emerald-50/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-emerald-800">Top 5 Môn học tốt nhất</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-xs">
                      <tbody className="divide-y">
                        {programOverview.top5.map((c) => (
                          <tr key={c.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium">{c.code}</td>
                            <td className="px-2 py-2.5 truncate max-w-[150px]">{c.name}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{c.health}</td>
                          </tr>
                        ))}
                        {programOverview.top5.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-4 text-muted-foreground italic">Chưa có dữ liệu</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                <Card className="flex-1 border-rose-200/50 bg-rose-50/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-rose-800">Cảnh báo: Top 5 Môn học cần chú ý</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-rose-100/50">
                        {programOverview.bottom5.map((c) => (
                          <tr key={c.id} className="hover:bg-rose-100/20">
                            <td className="px-4 py-2.5 font-medium">{c.code}</td>
                            <td className="px-2 py-2.5 truncate max-w-[150px]">{c.name}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-rose-600">{c.health}</td>
                          </tr>
                        ))}
                        {programOverview.bottom5.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-4 text-muted-foreground italic">Chưa có dữ liệu</td></tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
            <BookOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm">Chọn Khoa → Ngành → Môn học để xem phân tích chi tiết</p>
            {selProg === "all" && <p className="text-xs opacity-70">Bạn cũng có thể chọn Ngành để xem biểu đồ Tổng quan</p>}
          </div>
        )
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold">{selectedCourseName}</h2>
          </div>

          {/* 5 KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Tổng lượt học", value: courseStats?.totalEnrolls ?? "—", icon: <Users className="h-5 w-5 text-muted-foreground" /> },
              {
                label: "Pass rate tổng hợp",
                value: courseStats ? `${courseStats.passRate.toFixed(1)}%` : "—",
                icon: <CheckCircle2 className={`h-5 w-5 ${!courseStats || courseStats.passRate >= 70 ? "text-emerald-500" : "text-destructive"}`} />,
              },
              { label: "Điểm trung bình", value: courseStats ? courseStats.avgGrade.toFixed(2) : "—", icon: <TrendingUp className="h-5 w-5 text-muted-foreground" /> },
              { label: "Số lớp học phần", value: courseStats?.sectionCount ?? "—", icon: <BookOpen className="h-5 w-5 text-muted-foreground" /> },
              {
                label: "Fail rate cao nhất",
                value: courseStats ? `${courseStats.maxFailRate.toFixed(0)}%` : "—",
                icon: <AlertTriangle className={`h-5 w-5 ${courseStats && courseStats.maxFailRate > 40 ? "text-destructive" : "text-muted-foreground"}`} />,
                alert: courseStats && courseStats.maxFailRate > 40 ? "> 40%" : null,
              },
            ].map((k, i) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">{k.value}</p>
                      {"alert" in k && k.alert && (
                        <Badge variant="destructive" className="mt-1 text-[10px] h-4 px-1.5">{k.alert}</Badge>
                      )}
                    </div>
                    <div className="shrink-0 mt-0.5">{k.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 2 trend lines */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Trend pass rate theo học kỳ</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={courseStats?.trend ?? []} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hk" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v}%`, "Pass rate"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Line type="monotone" dataKey="passRate" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Trend điểm trung bình theo học kỳ</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={courseStats?.trend ?? []} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hk" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [v, "Điểm TB"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Line type="monotone" dataKey="avgGrade" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Distribution + Section table */}
          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Phân bổ điểm (tổng hợp)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={courseStats?.dist ?? []} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [v, "SV"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {(courseStats?.dist ?? []).map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Chi tiết các lớp học phần</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Mã lớp</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Học kỳ</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">SV</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Pass rate</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">So TB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(courseStats?.sections ?? []).map((s, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-4 py-2 font-mono text-[11px]">{s.code}</td>
                          <td className="px-3 py-2">{s.semLabel}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{s.total}</td>
                          <td className="px-3 py-2 text-right">
                            <Badge
                              variant={s.rate >= 70 ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >{s.rate}%</Badge>
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums font-medium ${s.diff < -15 ? "text-destructive" : s.diff > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {s.diff > 0 ? "+" : ""}{s.diff}%
                            {s.diff < -15 && " ⚠️"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
