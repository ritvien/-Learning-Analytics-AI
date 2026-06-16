"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Users, TrendingUp, CheckCircle2, AlertTriangle, Layers } from "lucide-react"
import { api, type ApiSection, type ApiSemester, type ApiStudent, type ApiEnrollment, type ApiCourse, type ApiDepartment, type ApiProgram } from "@/lib/api"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts"

type Raw = {
  departments: ApiDepartment[]
  programs: ApiProgram[]
  students: ApiStudent[]
  enrollments: ApiEnrollment[]
  sections: ApiSection[]
  semesters: ApiSemester[]
  courses: ApiCourse[]
}

export default function DepartmentsAnalyticsPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [selectedSemester, setSelectedSemester] = React.useState("all")
  const [selectedDept, setSelectedDept] = React.useState("all")
  const [selectedProg, setSelectedProg] = React.useState("all")

  React.useEffect(() => {
    Promise.all([
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 100 }),
      api.getStudents({ limit: 500 }),
      api.getEnrollments({ limit: 3000 }),
      api.getSections({ limit: 300 }),
      api.getSemesters(),
      api.getCourses({ limit: 200 }),
    ]).then(([departments, programs, students, enrollments, sections, semesters, courses]) => {
      setRaw({ departments, programs, students, enrollments, sections, semesters, courses })
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  // Reset program filter when department changes
  React.useEffect(() => {
    setSelectedProg("all")
  }, [selectedDept])

  const stats = React.useMemo(() => {
    if (!raw) return null
    const { departments, programs, students, enrollments, sections, semesters, courses } = raw

    const secMap = new Map(sections.map(s => [s.id, s]))
    const courseMap = new Map(courses.map(c => [c.id, c]))
    const semMap = new Map(semesters.map(s => [s.id, s]))
    const progMap = new Map(programs.map(p => [p.id, p]))
    const deptMap = new Map(departments.map(d => [d.id, d]))

    // Map student_id -> program and department
    const studentInfo = new Map<number, { program_id: number; department_id: number }>()
    for (const s of students) {
      const prog = progMap.get(s.program_id)
      if (prog) {
        studentInfo.set(s.id, { program_id: s.program_id, department_id: prog.department_id })
      }
    }

    // Filter enrollments by Semester
    let filteredEnrollments = enrollments
    if (selectedSemester !== "all") {
      filteredEnrollments = enrollments.filter(e => {
        const sec = secMap.get(e.section_id)
        if (!sec) return false
        const sem = semMap.get(sec.semester_id)
        return sem?.code === selectedSemester
      })
    }

    // Filter students & enrollments by Department
    let filteredStudents = students
    if (selectedDept !== "all") {
      const deptId = parseInt(selectedDept)
      filteredStudents = filteredStudents.filter(s => {
        const info = studentInfo.get(s.id)
        return info?.department_id === deptId
      })
      filteredEnrollments = filteredEnrollments.filter(e => {
        const info = studentInfo.get(e.student_id)
        return info?.department_id === deptId
      })
    }

    // Filter students & enrollments by Program
    if (selectedProg !== "all") {
      const progId = parseInt(selectedProg)
      filteredStudents = filteredStudents.filter(s => s.program_id === progId)
      filteredEnrollments = filteredEnrollments.filter(e => {
        const info = studentInfo.get(e.student_id)
        return info?.program_id === progId
      })
    }

    // KPIs
    const unitCount = selectedDept === "all" ? departments.length : programs.filter(p => p.department_id === parseInt(selectedDept)).length
    const totalStudents = filteredStudents.length
    const validEnrolls = filteredEnrollments.filter(e => e.is_passed !== null)
    const passRate = validEnrolls.length ? (validEnrolls.filter(e => e.is_passed).length / validEnrolls.length) * 100 : 0
    const withGpa = filteredStudents.filter(s => s.gpa_cumulative !== null)
    const avgGpa = withGpa.length ? withGpa.reduce((s, x) => s + x.gpa_cumulative!, 0) / withGpa.length : 0

    // Department Comparison Data (Section A)
    const deptComparison = departments.map(dept => {
      const deptStudents = students.filter(s => studentInfo.get(s.id)?.department_id === dept.id)
      const deptEnrolls = filteredEnrollments.filter(e => studentInfo.get(e.student_id)?.department_id === dept.id)

      const dValid = deptEnrolls.filter(e => e.is_passed !== null)
      const dPassRate = dValid.length ? (dValid.filter(e => e.is_passed).length / dValid.length) * 100 : 0

      const dGpaStuds = deptStudents.filter(s => s.gpa_cumulative !== null)
      const dAvgGpa = dGpaStuds.length ? dGpaStuds.reduce((s, x) => s + x.gpa_cumulative!, 0) / dGpaStuds.length : 0

      const dAtRisk = deptStudents.filter(s => s.gpa_cumulative !== null && s.gpa_cumulative < 2.0).length

      const label = dept.name.replace("Khoa ", "")

      return {
        id: dept.id,
        name: label,
        fullName: dept.name,
        passRate: Math.round(dPassRate * 10) / 10,
        avgGpa: Math.round(dAvgGpa * 100) / 100,
        atRisk: dAtRisk
      }
    })

    // Heatmap: Khoa x Học kỳ
    const sortedSemesters = [...semesters].sort((a, b) => a.code.localeCompare(b.code))
    const heatmapRows = departments.map(dept => {
      const cols = sortedSemesters.map(sem => {
        const semSecIds = new Set(sections.filter(s => s.semester_id === sem.id).map(s => s.id))
        const semDeptEnrolls = enrollments.filter(e => {
          const info = studentInfo.get(e.student_id)
          return info?.department_id === dept.id && semSecIds.has(e.section_id) && e.is_passed !== null
        })
        const passed = semDeptEnrolls.filter(e => e.is_passed).length
        const rate = semDeptEnrolls.length ? (passed / semDeptEnrolls.length) * 100 : null
        return {
          semCode: sem.code,
          rate: rate !== null ? Math.round(rate) : null
        }
      })
      return {
        deptName: dept.name.replace("Khoa ", ""),
        cols
      }
    })

    // Drill-down Section B: Top 10 courses with highest fail rate in chosen department (or overall)
    // Filter courses belonging to selected department
    let targetCourses = courses
    if (selectedDept !== "all") {
      const deptId = parseInt(selectedDept)
      const deptProgs = new Set(programs.filter(p => p.department_id === deptId).map(p => p.id))
      targetCourses = courses.filter(c => c.program_ids.some(pid => deptProgs.has(pid)))
    }

    const courseFailStats = targetCourses.map(course => {
      const cEnrolls = filteredEnrollments.filter(e => {
        const sec = secMap.get(e.section_id)
        return sec?.course_id === course.id && e.is_passed !== null
      })
      const failed = cEnrolls.filter(e => !e.is_passed).length
      const total = cEnrolls.length
      const failRate = total ? (failed / total) * 100 : 0
      return {
        code: course.code,
        name: course.name,
        displayName: course.name.length > 20 ? course.name.slice(0, 20) + "..." : course.name,
        failed,
        total,
        rate: Math.round(failRate)
      }
    }).filter(c => c.total > 0).sort((a, b) => b.rate - a.rate).slice(0, 10)

    // Drill-down Section B: Top 10 Anomalous sections in selected department (exceed course avg by >= 15%)
    const allSecStats = new Map<number, { failed: number; total: number; section_code: string; course_id: number }>()
    for (const e of enrollments) {
      if (e.is_passed === null) continue
      const sec = secMap.get(e.section_id); if (!sec) continue
      const stat = allSecStats.get(e.section_id) ?? { failed: 0, total: 0, section_code: sec.section_code, course_id: sec.course_id }
      stat.total++
      if (!e.is_passed) stat.failed++
      allSecStats.set(e.section_id, stat)
    }

    const courseAvgFailRate = new Map<number, number>()
    courses.forEach(c => {
      const cEnrolls = enrollments.filter(e => {
        const sec = secMap.get(e.section_id)
        return sec?.course_id === c.id && e.is_passed !== null
      })
      const failed = cEnrolls.filter(e => !e.is_passed).length
      courseAvgFailRate.set(c.id, cEnrolls.length ? (failed / cEnrolls.length) : 0)
    })

    const anomalousSections: Array<{ code: string; courseName: string; failRate: number; diff: number }> = []
    allSecStats.forEach((stat, secId) => {
      const sec = secMap.get(secId); if (!sec) return
      // Filter by department if chosen
      if (selectedDept !== "all") {
        const deptId = parseInt(selectedDept)
        const c = courseMap.get(stat.course_id)
        const matchesDept = c?.program_ids.some(pid => progMap.get(pid)?.department_id === deptId)
        if (!matchesDept) return
      }

      const secFailRate = stat.total > 0 ? (stat.failed / stat.total) : 0
      const cAvg = courseAvgFailRate.get(stat.course_id) ?? 0
      const diff = secFailRate - cAvg
      if (diff >= 0.15 && stat.total >= 5) {
        const c = courseMap.get(stat.course_id)
        anomalousSections.push({
          code: stat.section_code,
          courseName: c?.name ?? "Môn học",
          failRate: Math.round(secFailRate * 100),
          diff: Math.round(diff * 100)
        })
      }
    })

    const sortedAnomalousSections = anomalousSections.sort((a, b) => b.failRate - a.failRate).slice(0, 10)

    return {
      unitCount,
      totalStudents,
      passRate,
      avgGpa,
      deptComparison,
      heatmapRows,
      sortedSemesters,
      courseFailStats,
      sortedAnomalousSections
    }
  }, [raw, selectedSemester, selectedDept, selectedProg])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  // Get filtered programs list for dropdown
  const filteredPrograms = raw ? (selectedDept === "all" ? [] : raw.programs.filter(p => p.department_id === parseInt(selectedDept))) : []

  // Function to get Heatmap cell background styling based on pass rate
  const getHeatmapColor = (rate: number | null) => {
    if (rate === null) return "bg-muted/30 text-muted-foreground"
    if (rate >= 80) return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 dark:bg-emerald-500/10 border-emerald-500/20"
    if (rate >= 70) return "bg-green-500/15 text-green-700 dark:text-green-400 dark:bg-green-500/10 border-green-500/10"
    if (rate >= 60) return "bg-amber-500/20 text-amber-800 dark:text-amber-300 dark:bg-amber-500/10 border-amber-500/20"
    return "bg-rose-500/20 text-rose-800 dark:text-rose-300 dark:bg-rose-500/10 border-rose-500/20 font-semibold"
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phân tích Khoa & Ngành</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Semester Filter */}
          <Select value={selectedSemester} onValueChange={(val) => setSelectedSemester(val || "all")}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Chọn học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {raw?.semesters.map(sem => (
                <SelectItem key={sem.id} value={sem.code}>{sem.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department Filter */}
          <Select value={selectedDept} onValueChange={(val) => setSelectedDept(val || "all")}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Chọn khoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả khoa</SelectItem>
              {raw?.departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Program Filter */}
          <Select value={selectedProg} onValueChange={(val) => setSelectedProg(val || "all")} disabled={selectedDept === "all"}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Chọn ngành" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ngành</SelectItem>
              {filteredPrograms.map(prog => (
                <SelectItem key={prog.id} value={prog.id.toString()}>{prog.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Số khoa / ngành</span>
              <h3 className="text-2xl font-bold">{stats?.unitCount}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Tổng sinh viên</span>
              <h3 className="text-2xl font-bold">{stats?.totalStudents}</h3>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Pass rate trung bình</span>
              <h3 className="text-2xl font-bold">{stats ? `${stats.passRate.toFixed(1)}%` : "0%"}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">GPA trung bình</span>
              <h3 className="text-2xl font-bold">{stats ? stats.avgGpa.toFixed(2) : "0.00"}</h3>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION A: Department Comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pass Rate theo khoa (%)</CardTitle>
            <CardDescription className="text-xs">Màu: xanh ≥ 75% | vàng 60–74% | đỏ &lt; 60%</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.deptComparison ?? []} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="passRate" radius={[4, 4, 0, 0]}>
                  {stats?.deptComparison.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.passRate >= 75 ? "#10b981" : entry.passRate >= 60 ? "#f59e0b" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">GPA trung bình theo khoa</CardTitle>
            <CardDescription className="text-xs">So sánh trên thang điểm tích lũy 4.0</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.deptComparison ?? []} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 4]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="avgGpa" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Số SV nguy cơ theo khoa</CardTitle>
            <CardDescription className="text-xs">Sinh viên có GPA tích lũy &lt; 2.0</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.deptComparison ?? []} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="atRisk" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap: Khoa x Học kỳ */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Heatmap — Tỷ lệ qua môn: Khoa × Học kỳ</CardTitle>
          <CardDescription className="text-xs">Xu hướng thay đổi kết quả qua môn của các khoa qua từng kỳ</CardDescription>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="p-4 font-semibold text-muted-foreground w-1/4">Khoa</th>
                  {stats?.sortedSemesters.map(sem => (
                    <th key={sem.id} className="p-4 font-semibold text-center text-muted-foreground">{sem.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats?.heatmapRows.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/20">
                    <td className="p-4 font-semibold">{row.deptName}</td>
                    {row.cols.map((col, cIdx) => (
                      <td key={cIdx} className="p-0 text-center border-l">
                        <div className={`p-4 h-full w-full ${getHeatmapColor(col.rate)}`}>
                          {col.rate !== null ? `${col.rate}%` : "—"}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION B: Drill-down on Chosen Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Top 10 môn trượt cao nhất {selectedDept === "all" ? "toàn trường" : `trong khoa`}
            </CardTitle>
            <CardDescription className="text-xs">
              Sắp xếp giảm dần theo tỷ lệ trượt môn (%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.courseFailStats.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.courseFailStats} layout="vertical" margin={{ left: -10, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="displayName" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-background border rounded p-2 text-[11px] shadow-sm">
                          <p className="font-bold">{d.code} - {d.name}</p>
                          <p>Tỷ lệ trượt: {d.rate}% ({d.failed}/{d.total} SV)</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {stats.courseFailStats.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.rate >= 40 ? "#ef4444" : entry.rate >= 25 ? "#f97316" : "#f59e0b"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                Chưa có dữ liệu môn học phù hợp
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Top 10 lớp học phần bất thường {selectedDept === "all" ? "toàn trường" : `trong khoa`}
            </CardTitle>
            <CardDescription className="text-xs">
              Lớp có tỷ lệ trượt vượt trung bình môn tương ứng ≥ 15%
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.sortedAnomalousSections.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.sortedAnomalousSections} layout="vertical" margin={{ left: -10, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="code" width={70} tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-background border rounded p-2 text-[11px] shadow-sm">
                          <p className="font-bold">Lớp: {d.code}</p>
                          <p className="text-muted-foreground">{d.courseName}</p>
                          <p>Tỷ lệ trượt: <span className="text-rose-500 font-semibold">{d.failRate}%</span></p>
                          <p>Chênh lệch so với TB môn: <span className="font-semibold">+{d.diff}%</span></p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="failRate" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                Không phát hiện lớp học phần nào bất thường (chênh &ge; 15% so với TB môn)
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
