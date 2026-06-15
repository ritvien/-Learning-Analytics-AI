"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, TrendingUp, AlertTriangle, CheckCircle2, BookOpen } from "lucide-react"
import { api, type ApiSection, type ApiSemester } from "@/lib/api"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"

type Raw = {
  students:    Awaited<ReturnType<typeof api.getStudents>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  courses:     Awaited<ReturnType<typeof api.getCourses>>
  sections:    ApiSection[]
  semesters:   ApiSemester[]
}

type ActionItem = {
  level: "high" | "medium"
  unit: string
  problem: string
  suggestion: string
}

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
    ]).then(([students, enrollments, courses, sections, semesters]) =>
      setRaw({ students, enrollments, courses, sections, semesters })
    ).catch(console.error)
  }, [])

  const stats = React.useMemo(() => {
    if (!raw) return null
    const { students, enrollments, courses, sections, semesters } = raw

    const secMap    = new Map(sections.map(s => [s.id, s]))
    const courseMap = new Map(courses.map(c => [c.id, c]))
    const semMap    = new Map(semesters.map(s => [s.id, s]))

    // Current semester
    const currentSem = semesters.find(s => s.is_current) ?? semesters.at(-1) ?? null

    const filterSemId = semester === "current"
      ? currentSem?.id ?? null
      : semester === "all"
      ? null
      : semesters.find(s => s.code === semester)?.id ?? null

    const filtered = filterSemId == null
      ? enrollments
      : enrollments.filter(e => secMap.get(e.section_id)?.semester_id === filterSemId)

    const valid = filtered.filter(e => e.is_passed !== null)

    // KPIs
    const activeStudents = students.filter(s => s.status === "active").length
    const passRate = valid.length ? (valid.filter(e => e.is_passed).length / valid.length) * 100 : 0
    const withGpa  = students.filter(s => s.gpa_cumulative !== null)
    const avgGpa   = withGpa.length ? withGpa.reduce((s, x) => s + x.gpa_cumulative!, 0) / withGpa.length : 0
    const atRisk   = students.filter(s => s.gpa_cumulative !== null && s.gpa_cumulative < 2.0).length

    // Sections with fail > 40%
    const sectionStats = new Map<number, { total: number; failed: number; courseId: number; semId: number }>()
    for (const e of valid) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const s   = sectionStats.get(e.section_id) ?? { total: 0, failed: 0, courseId: sec.course_id, semId: sec.semester_id }
      s.total++
      if (!e.is_passed) s.failed++
      sectionStats.set(e.section_id, s)
    }
    const warnSections = [...sectionStats.values()].filter(s => s.total >= 5 && s.failed / s.total > 0.4).length

    // Trend: pass rate + avg grade by semester (all history)
    const semTrend = new Map<string, { label: string; order: string; passed: number; total: number; gradeSum: number; gradeCnt: number }>()
    for (const e of enrollments) {
      if (e.is_passed === null) continue
      const sec = secMap.get(e.section_id); if (!sec) continue
      const sem = semMap.get(sec.semester_id); if (!sem) continue
      const t = semTrend.get(sem.code) ?? { label: sem.code, order: `${sem.year}-${sem.term}`, passed: 0, total: 0, gradeSum: 0, gradeCnt: 0 }
      t.total++
      if (e.is_passed) t.passed++
      if (e.final_grade !== null) { t.gradeSum += e.final_grade; t.gradeCnt++ }
      semTrend.set(sem.code, t)
    }
    const trend = [...semTrend.values()]
      .sort((a, b) => a.order.localeCompare(b.order))
      .map(t => ({
        hk: t.label,
        passRate: t.total ? +(t.passed / t.total * 100).toFixed(1) : 0,
        avgGrade: t.gradeCnt ? +(t.gradeSum / t.gradeCnt).toFixed(2) : 0,
      }))

    // Action table — auto-generated warnings
    const actions: ActionItem[] = []

    // Per-course fail rate this semester
    const courseStats = new Map<number, { total: number; failed: number; prevFail: number[] }>()
    for (const e of valid) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const isCurrent = filterSemId == null || sec.semester_id === filterSemId
      const s = courseStats.get(sec.course_id) ?? { total: 0, failed: 0, prevFail: [] }
      if (isCurrent) {
        s.total++
        if (!e.is_passed) s.failed++
      }
      courseStats.set(sec.course_id, s)
    }
    for (const [cid, s] of courseStats) {
      if (s.total < 5) continue
      const rate = s.failed / s.total * 100
      const c = courseMap.get(cid)
      if (!c) continue
      if (rate > 40) {
        actions.push({
          level: "high",
          unit: c.name.length > 35 ? c.name.slice(0, 35) + "…" : c.name,
          problem: `Fail rate ${rate.toFixed(0)}%`,
          suggestion: "Review đề thi / tăng cường hỗ trợ học tập",
        })
      } else if (rate > 25) {
        actions.push({
          level: "medium",
          unit: c.name.length > 35 ? c.name.slice(0, 35) + "…" : c.name,
          problem: `Fail rate ${rate.toFixed(0)}%`,
          suggestion: "Rà soát nội dung + tăng cường luyện tập",
        })
      }
    }

    // Near-fail SV
    const nearFail = filtered.filter(e => e.final_grade !== null && e.final_grade >= 4.5 && e.final_grade < 5.0)
    if (nearFail.length > 0) {
      actions.push({
        level: "medium",
        unit: "Toàn trường",
        problem: `${nearFail.length} lượt cận trượt (4.5–5.0)`,
        suggestion: "Gửi cảnh báo đến cố vấn học tập",
      })
    }

    actions.sort((a, b) => (a.level === "high" ? -1 : 1) - (b.level === "high" ? -1 : 1))

    return { activeStudents, passRate, avgGpa, atRisk, warnSections, trend, actions, currentSem }
  }, [raw, semester])

  const semesters = raw?.semesters.slice().sort((a, b) => `${a.year}-${a.term}`.localeCompare(`${b.year}-${b.term}`) ) ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
          <p className="text-sm text-muted-foreground">
            {stats?.currentSem ? `Học kỳ hiện tại: ${stats.currentSem.name}` : "Trường Đại học Điện Lực — EPU"}
          </p>
        </div>
        <Select value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-52">
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

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Tổng SV đang học",
            value: stats?.activeStudents ?? "—",
            icon: <Users className="h-5 w-5 text-muted-foreground" />,
            alert: null,
          },
          {
            label: "Tỷ lệ qua môn",
            value: stats ? `${stats.passRate.toFixed(1)}%` : "—",
            icon: <CheckCircle2 className={`h-5 w-5 ${!stats || stats.passRate >= 70 ? "text-emerald-500" : "text-destructive"}`} />,
            alert: stats && stats.passRate < 70 ? "< 70% ⚠" : null,
          },
          {
            label: "GPA trung bình",
            value: stats ? stats.avgGpa.toFixed(2) : "—",
            icon: <TrendingUp className={`h-5 w-5 ${!stats || stats.avgGpa >= 2.5 ? "text-primary" : "text-destructive"}`} />,
            alert: stats && stats.avgGpa < 2.5 ? "< 2.5 ⚠" : null,
          },
          {
            label: "SV nguy cơ",
            value: stats?.atRisk ?? "—",
            icon: <AlertTriangle className={`h-5 w-5 ${stats && stats.atRisk > 0 ? "text-destructive" : "text-muted-foreground"}`} />,
            alert: stats && stats.atRisk > 0 ? "GPA < 2.0" : null,
          },
          {
            label: "Lớp cảnh báo",
            value: stats?.warnSections ?? "—",
            icon: <BookOpen className={`h-5 w-5 ${stats && stats.warnSections > 0 ? "text-orange-500" : "text-muted-foreground"}`} />,
            alert: stats && stats.warnSections > 0 ? "Fail > 40%" : null,
          },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">{k.value}</p>
                  {k.alert && (
                    <Badge variant="destructive" className="mt-1.5 text-[10px] h-4 px-1.5">{k.alert}</Badge>
                  )}
                </div>
                <div className="shrink-0 mt-0.5">{k.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2 Line Charts side-by-side */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Trend tỷ lệ qua môn theo học kỳ (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats?.trend ?? []} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hk" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Pass rate"]}
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" label={{ value: "70%", position: "right", fontSize: 10, fill: "#ef4444" }} />
                <Line type="monotone" dataKey="passRate" name="Pass rate" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Trend điểm trung bình theo học kỳ (thang 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats?.trend ?? []} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hk" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [v, "Điểm TB"]}
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="avgGrade" name="Điểm TB" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Action Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Vấn đề cần xử lý ngay</CardTitle>
            {stats && (
              <Badge variant={stats.actions.filter(a => a.level === "high").length > 0 ? "destructive" : "secondary"} className="text-[10px]">
                {stats.actions.length} cảnh báo
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!stats ? (
            <p className="text-sm text-muted-foreground px-6 py-6 text-center">Đang tải dữ liệu…</p>
          ) : stats.actions.length === 0 ? (
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
                  {stats.actions.map((a, i) => (
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
