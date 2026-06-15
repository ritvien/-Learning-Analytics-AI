"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BookOpen, TrendingUp, Users, CheckCircle2, AlertTriangle } from "lucide-react"
import { api, type ApiSection, type ApiSemester } from "@/lib/api"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"

type Raw = {
  departments: Awaited<ReturnType<typeof api.getDepartments>>
  programs:    Awaited<ReturnType<typeof api.getPrograms>>
  courses:     Awaited<ReturnType<typeof api.getCourses>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  sections:    ApiSection[]
  semesters:   ApiSemester[]
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
    ]).then(([departments, programs, courses, enrollments, sections, semesters]) =>
      setRaw({ departments, programs, courses, enrollments, sections, semesters })
    ).catch(console.error)
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

  const courseRanking = React.useMemo(() => {
    if (!raw || !maps) return []
    const allowed = new Set(filteredCourses.map(course => course.id))
    const stats = new Map<number, {
      total: number
      failed: number
      gradeSum: number
      gradeCount: number
      sections: Map<number, { total: number; passed: number }>
    }>()

    for (const enrollment of raw.enrollments) {
      if (enrollment.is_passed === null) continue
      const section = maps.secMap.get(enrollment.section_id)
      if (!section || !allowed.has(section.course_id)) continue
      const item = stats.get(section.course_id) ?? {
        total: 0, failed: 0, gradeSum: 0, gradeCount: 0, sections: new Map(),
      }
      item.total++
      if (!enrollment.is_passed) item.failed++
      if (enrollment.final_grade !== null) {
        item.gradeSum += enrollment.final_grade
        item.gradeCount++
      }
      const sectionStat = item.sections.get(section.id) ?? { total: 0, passed: 0 }
      sectionStat.total++
      if (enrollment.is_passed) sectionStat.passed++
      item.sections.set(section.id, sectionStat)
      stats.set(section.course_id, item)
    }

    return [...stats.entries()]
      .filter(([, item]) => item.total >= 5)
      .map(([courseId, item]) => {
        const course = raw.courses.find(candidate => candidate.id === courseId)!
        const passRate = (item.total - item.failed) / item.total * 100
        const anomalies = [...item.sections.values()].filter(section =>
          section.total >= 5 && section.passed / section.total * 100 < passRate - 15
        ).length
        return {
          id: courseId,
          code: course.code,
          name: course.name,
          total: item.total,
          failed: item.failed,
          failRate: item.failed / item.total * 100,
          avgGrade: item.gradeCount ? item.gradeSum / item.gradeCount : 0,
          anomalies,
        }
      })
      .sort((a, b) => b.failed - a.failed || b.failRate - a.failRate)
  }, [raw, maps, filteredCourses])

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
              <Select value={selDept} onValueChange={v => { setSelDept(v); setSelProg("all"); setSelCourse("all") }}>
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
              <Select value={selProg} onValueChange={v => { setSelProg(v); setSelCourse("all") }} disabled={selDept === "all"}>
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
              <Select value={selCourse} onValueChange={setSelCourse}>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Xếp hạng môn học cần ưu tiên</CardTitle>
            <p className="text-xs text-muted-foreground">
              Xếp theo số lượt trượt để phản ánh mức ảnh hưởng thực tế. Chọn một môn để phân tích chi tiết.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {!courseRanking.length ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu điểm học phần cho bộ lọc này.
              </p>
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">#</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Môn học</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Lượt học</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Trượt</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Fail rate</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Điểm TB</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Lớp bất thường</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {courseRanking.slice(0, 100).map((course, index) => (
                      <tr key={course.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-semibold text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{course.code}</p>
                          <p className="max-w-[360px] truncate text-muted-foreground" title={course.name}>{course.name}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{course.total}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-destructive tabular-nums">{course.failed}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge variant={course.failRate >= 40 ? "destructive" : "outline"} className="text-[10px]">
                            {course.failRate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{course.avgGrade.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{course.anomalies}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button className="font-medium text-primary hover:underline" onClick={() => setSelCourse(String(course.id))}>
                            Phân tích
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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
                    <Tooltip formatter={(v: number) => [`${v}%`, "Pass rate"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
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
                    <Tooltip formatter={(v: number) => [v, "Điểm TB"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
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
                    <Tooltip formatter={(v: number) => [v, "SV"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
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
