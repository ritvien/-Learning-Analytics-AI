"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react"
import { api, type ApiSection, type ApiSemester } from "@/lib/api"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"

type Raw = {
  departments: Awaited<ReturnType<typeof api.getDepartments>>
  programs:    Awaited<ReturnType<typeof api.getPrograms>>
  students:    Awaited<ReturnType<typeof api.getStudents>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  sections:    ApiSection[]
  semesters:   ApiSemester[]
  courses:     Awaited<ReturnType<typeof api.getCourses>>
}

// Simple heatmap cell color: value 0–100
function heatColor(value: number): string {
  if (value >= 80) return "bg-emerald-500"
  if (value >= 70) return "bg-emerald-300"
  if (value >= 60) return "bg-yellow-300"
  if (value >= 50) return "bg-orange-400"
  return "bg-red-500"
}

export default function DepartmentsAnalyticsPage() {
  const [raw, setRaw]           = React.useState<Raw | null>(null)
  const [selSem, setSelSem]     = React.useState("all")
  const [selDept, setSelDept]   = React.useState("all")
  const [selProg, setSelProg]   = React.useState("all")

  React.useEffect(() => {
    Promise.all([
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 100 }),
      api.getStudents({ limit: 1000 }),
      api.getEnrollments({ limit: 50000 }),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
      api.getCourses({ limit: 500 }),
    ]).then(([departments, programs, students, enrollments, sections, semesters, courses]) =>
      setRaw({ departments, programs, students, enrollments, sections, semesters, courses })
    ).catch(console.error)
  }, [])

  // Derived maps
  const maps = React.useMemo(() => {
    if (!raw) return null
    const secMap    = new Map(raw.sections.map(s => [s.id, s]))
    const semMap    = new Map(raw.semesters.map(s => [s.id, s]))
    const progMap   = new Map(raw.programs.map(p => [p.id, p]))
    const courseMap = new Map(raw.courses.map(c => [c.id, c]))
    const studentDept = new Map<number, number>()
    const studentProg = new Map<number, number>()
    for (const s of raw.students) {
      const prog = progMap.get(s.program_id)
      if (prog) { studentDept.set(s.id, prog.department_id); studentProg.set(s.id, s.program_id) }
    }
    return { secMap, semMap, progMap, courseMap, studentDept, studentProg }
  }, [raw])

  // Filter enrollments by semester
  const filteredEnrollments = React.useMemo(() => {
    if (!raw || !maps) return raw?.enrollments ?? []
    if (selSem === "all") return raw.enrollments
    const semId = raw.semesters.find(s => s.code === selSem)?.id
    if (!semId) return raw.enrollments
    return raw.enrollments.filter(e => maps.secMap.get(e.section_id)?.semester_id === semId)
  }, [raw, maps, selSem])

  // Programs scoped to selected dept
  const filteredPrograms = React.useMemo(() => {
    if (!raw) return []
    if (selDept === "all") return raw.programs
    return raw.programs.filter(p => p.department_id === Number(selDept))
  }, [raw, selDept])

  // Per-department stats
  const deptStats = React.useMemo(() => {
    if (!raw || !maps) return null
    const { studentDept, studentProg } = maps

    return raw.departments.map(dept => {
      const deptStudents = raw.students.filter(s => {
        const ok = studentDept.get(s.id) === dept.id
        if (!ok) return false
        if (selProg !== "all" && studentProg.get(s.id) !== Number(selProg)) return false
        return true
      })

      const deptEnrolls = filteredEnrollments.filter(e => {
        const dId = studentDept.get(e.student_id)
        if (dId !== dept.id) return false
        if (selProg !== "all" && studentProg.get(e.student_id) !== Number(selProg)) return false
        return true
      })

      const valid    = deptEnrolls.filter(e => e.is_passed !== null)
      const passRate = valid.length ? valid.filter(e => e.is_passed).length / valid.length * 100 : 0
      const withGpa  = deptStudents.filter(s => s.gpa_cumulative !== null)
      const avgGpa   = withGpa.length ? withGpa.reduce((s, x) => s + x.gpa_cumulative!, 0) / withGpa.length : 0
      const atRisk   = deptStudents.filter(s => s.gpa_cumulative !== null && s.gpa_cumulative < 2.0).length
      const shortName = dept.name.replace(/^Khoa\s+/i, "").replace(/^Bộ môn\s+/i, "")

      return {
        id: dept.id,
        name: dept.name,
        shortName: shortName.length > 18 ? shortName.slice(0, 18) + "…" : shortName,
        studentCount: deptStudents.length,
        passRate: Math.round(passRate * 10) / 10,
        avgGpa: Math.round(avgGpa * 100) / 100,
        atRisk,
      }
    }).sort((a, b) => b.studentCount - a.studentCount)
  }, [raw, maps, filteredEnrollments, selProg])

  // Heatmap: dept × semester pass rate (last 8 semesters)
  const heatmap = React.useMemo(() => {
    if (!raw || !maps) return null
    const { secMap, semMap, studentDept } = maps
    const sems = raw.semesters.slice().sort((a, b) => `${a.year}-${a.term}`.localeCompare(`${b.year}-${b.term}`)).slice(-8)

    const matrix = raw.departments.map(dept => {
      const cells = sems.map(sem => {
        const enrolsInSemDept = raw.enrollments.filter(e => {
          const sec = secMap.get(e.section_id)
          return sec?.semester_id === sem.id && studentDept.get(e.student_id) === dept.id && e.is_passed !== null
        })
        const rate = enrolsInSemDept.length ? enrolsInSemDept.filter(e => e.is_passed).length / enrolsInSemDept.length * 100 : null
        return rate
      })
      const shortName = dept.name.replace(/^Khoa\s+/i, "").replace(/^Bộ môn\s+/i, "")
      return { dept: shortName.length > 20 ? shortName.slice(0, 20) + "…" : shortName, cells }
    })

    return { sems: sems.map(s => s.code), matrix }
  }, [raw, maps])

  // Drill-down: top 10 fail courses in selected dept
  const drillCourseFail = React.useMemo(() => {
    if (!raw || !maps || selDept === "all") return null
    const deptId = Number(selDept)
    const { secMap, semMap, courseMap, studentDept } = maps

    // courses that belong to this department via program_courses
    const deptProgIds = new Set(raw.programs.filter(p => p.department_id === deptId).map(p => p.id))
    // enrollments where student is in this dept
    const courseStatsMap = new Map<number, { total: number; failed: number }>()
    for (const e of filteredEnrollments) {
      if (e.is_passed === null) continue
      if (studentDept.get(e.student_id) !== deptId) continue
      const sec = secMap.get(e.section_id); if (!sec) continue
      const s = courseStatsMap.get(sec.course_id) ?? { total: 0, failed: 0 }
      s.total++; if (!e.is_passed) s.failed++
      courseStatsMap.set(sec.course_id, s)
    }

    return [...courseStatsMap.entries()]
      .filter(([, s]) => s.total >= 5)
      .map(([cid, s]) => {
        const c = courseMap.get(cid)
        const rate = s.failed / s.total * 100
        return { name: c ? (c.name.length > 30 ? c.name.slice(0, 30) + "…" : c.name) : `Môn ${cid}`, rate: +rate.toFixed(1), total: s.total, failed: s.failed }
      })
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10)
  }, [raw, maps, filteredEnrollments, selDept])

  // Drill-down: top 10 abnormal sections (fail > avg+15pp)
  const drillSectionAbnormal = React.useMemo(() => {
    if (!raw || !maps || selDept === "all") return null
    const deptId = Number(selDept)
    const { secMap, courseMap, studentDept } = maps

    // pass rate per course (avg) and per section
    const courseTotal = new Map<number, { passed: number; total: number }>()
    const secStats    = new Map<number, { passed: number; total: number; courseId: number; code: string }>()

    for (const e of filteredEnrollments) {
      if (e.is_passed === null) continue
      if (studentDept.get(e.student_id) !== deptId) continue
      const sec = secMap.get(e.section_id); if (!sec) continue

      const ct = courseTotal.get(sec.course_id) ?? { passed: 0, total: 0 }
      ct.total++; if (e.is_passed) ct.passed++
      courseTotal.set(sec.course_id, ct)

      const ss = secStats.get(e.section_id) ?? { passed: 0, total: 0, courseId: sec.course_id, code: sec.section_code }
      ss.total++; if (e.is_passed) ss.passed++
      secStats.set(e.section_id, ss)
    }

    return [...secStats.entries()]
      .filter(([, s]) => s.total >= 5)
      .map(([, s]) => {
        const ct     = courseTotal.get(s.courseId)
        const c      = courseMap.get(s.courseId)
        const secFail = (1 - s.passed / s.total) * 100
        const avgFail = ct ? (1 - ct.passed / ct.total) * 100 : 0
        const diff    = secFail - avgFail
        return { code: s.code, courseName: c ? (c.name.length > 25 ? c.name.slice(0, 25) + "…" : c.name) : "—", failRate: +secFail.toFixed(1), avgFail: +avgFail.toFixed(1), diff: +diff.toFixed(1) }
      })
      .filter(s => s.diff >= 15)
      .sort((a, b) => b.failRate - a.failRate)
      .slice(0, 10)
  }, [raw, maps, filteredEnrollments, selDept])

  const totalStudents  = deptStats?.reduce((s, d) => s + d.studentCount, 0) ?? 0
  const overallPass    = deptStats?.length ? deptStats.reduce((s, d) => s + d.passRate, 0) / deptStats.length : 0
  const overallGpa     = totalStudents ? (deptStats?.reduce((s, d) => s + d.avgGpa * d.studentCount, 0) ?? 0) / totalStudents : 0
  const totalAtRisk    = deptStats?.reduce((s, d) => s + d.atRisk, 0) ?? 0

  const semesters      = raw?.semesters.slice().sort((a, b) => `${a.year}-${a.term}`.localeCompare(`${b.year}-${b.term}`)) ?? []
  const selectedDeptName = raw?.departments.find(d => d.id === Number(selDept))?.name ?? ""

  return (
    <div className="flex flex-col gap-6">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phân tích theo Khoa / Ngành</h1>
          <p className="text-sm text-muted-foreground">So sánh hiệu quả đào tạo giữa các khoa theo thời gian</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={selSem} onValueChange={setSelSem}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {semesters.map(s => <SelectItem key={s.id} value={s.code}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selDept} onValueChange={v => { setSelDept(v); setSelProg("all") }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Khoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả khoa</SelectItem>
              {raw?.departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selProg} onValueChange={setSelProg} disabled={selDept === "all"}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Ngành" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ngành</SelectItem>
              {filteredPrograms.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Số khoa",        value: deptStats?.length ?? "—",                  icon: <Building2 className="h-5 w-5 text-muted-foreground" /> },
          { label: "Tổng sinh viên", value: totalStudents || "—",                       icon: <Users className="h-5 w-5 text-muted-foreground" /> },
          { label: "Pass rate TB",   value: deptStats ? `${overallPass.toFixed(1)}%` : "—", icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: "SV nguy cơ",     value: totalAtRisk || "—",                         icon: <AlertTriangle className={`h-5 w-5 ${totalAtRisk > 0 ? "text-destructive" : "text-muted-foreground"}`} /> },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-3xl font-bold mt-1 tabular-nums">{k.value}</p>
                </div>
                {k.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section A: 3 comparison bar charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pass rate theo khoa (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptStats ?? []} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shortName" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Pass rate"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="passRate" radius={[4, 4, 0, 0]}>
                  {(deptStats ?? []).map((d, i) => (
                    <Cell key={i} fill={d.passRate >= 75 ? "#22c55e" : d.passRate >= 60 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">GPA trung bình theo khoa</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptStats ?? []} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shortName" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 4]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, "GPA"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="avgGpa" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Số SV nguy cơ theo khoa</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptStats ?? []} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shortName" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, "SV nguy cơ"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="atRisk" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap: Khoa × Học kỳ */}
      {heatmap && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Heatmap Pass rate — Khoa × Học kỳ (%)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="text-left pb-2 pr-3 text-muted-foreground font-medium w-40">Khoa</th>
                  {heatmap.sems.map(s => (
                    <th key={s} className="pb-2 px-1 text-center text-muted-foreground font-medium min-w-[64px]">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {heatmap.matrix.map((row, ri) => (
                  <tr key={ri}>
                    <td className="py-1.5 pr-3 font-medium text-[11px] leading-tight">{row.dept}</td>
                    {row.cells.map((val, ci) => (
                      <td key={ci} className="py-1.5 px-1 text-center">
                        {val !== null ? (
                          <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-white font-medium min-w-[48px] ${heatColor(val)}`}>
                            {val.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> ≥ 80%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-300 inline-block" /> 70–79%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-300 inline-block" /> 60–69%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> 50–59%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> &lt; 50%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section B: Drill-down khi chọn khoa */}
      {selDept !== "all" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Drill-down: {selectedDeptName}
          </h2>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Top 10 môn trượt */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top 10 môn trượt cao nhất</CardTitle>
              </CardHeader>
              <CardContent>
                {!drillCourseFail?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Không đủ dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, drillCourseFail.length * 34)}>
                    <BarChart data={drillCourseFail} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as { name: string; failed: number; total: number; rate: number }
                          return (
                            <div className="bg-background border rounded p-2 text-xs shadow-md">
                              <p className="font-semibold">{d.name}</p>
                              <p>Trượt: {d.failed}/{d.total} ({d.rate}%)</p>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                        {drillCourseFail.map((d, i) => (
                          <Cell key={i} fill={d.rate >= 40 ? "#ef4444" : d.rate >= 25 ? "#f97316" : "#f59e0b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top 10 lớp bất thường */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top 10 lớp bất thường (fail &gt; TB môn ≥ 15%)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!drillSectionAbnormal?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center px-4">Không có lớp bất thường</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Mã lớp</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Môn</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Fail</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Chênh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {drillSectionAbnormal.map((s, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-4 py-2 font-mono text-[11px]">{s.code}</td>
                            <td className="px-3 py-2 max-w-[140px] truncate" title={s.courseName}>{s.courseName}</td>
                            <td className="px-3 py-2 text-right">
                              <Badge variant="destructive" className="text-[10px]">{s.failRate}%</Badge>
                            </td>
                            <td className="px-4 py-2 text-right text-destructive font-medium">+{s.diff}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selDept === "all" && (
        <p className="text-xs text-muted-foreground text-center py-2">
          ← Chọn một khoa cụ thể để xem drill-down: Top 10 môn trượt & lớp bất thường
        </p>
      )}
    </div>
  )
}
