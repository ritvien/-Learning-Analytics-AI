"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, TrendingUp, AlertTriangle, CheckCircle2, AlertCircle, FileText } from "lucide-react"
import { api, type ApiSection, type ApiSemester, type ApiStudent, type ApiEnrollment, type ApiCourse, type ApiDepartment, type ApiProgram } from "@/lib/api"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts"

type Raw = {
  students: ApiStudent[]
  enrollments: ApiEnrollment[]
  courses: ApiCourse[]
  sections: ApiSection[]
  semesters: ApiSemester[]
  departments: ApiDepartment[]
  programs: ApiProgram[]
}

export default function OverviewPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    Promise.all([
      api.getStudents({ limit: 500 }),
      api.getEnrollments({ limit: 3000 }),
      api.getCourses({ limit: 200 }),
      api.getSections({ limit: 300 }),
      api.getSemesters(),
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 100 }),
    ]).then(([students, enrollments, courses, sections, semesters, departments, programs]) => {
      setRaw({ students, enrollments, courses, sections, semesters, departments, programs })
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const stats = React.useMemo(() => {
    if (!raw) return null
    const { students, enrollments, courses, sections, semesters, departments, programs } = raw

    const secMap = new Map(sections.map(s => [s.id, s]))
    const courseMap = new Map(courses.map(c => [c.id, c]))
    const semMap = new Map(semesters.map(s => [s.id, s]))
    const progMap = new Map(programs.map(p => [p.id, p]))
    const deptMap = new Map(departments.map(d => [d.id, d]))

    // Find current semester
    const currentSem = semesters.find(s => s.is_current)

    // Filter active students
    const activeStudents = students.filter(s => s.status === "active")

    // KPI 1: Tổng SV đang học
    const totalActiveStudents = activeStudents.length

    // KPI 2: Pass rate kỳ hiện tại
    const currentSecIds = new Set(sections.filter(s => s.semester_id === currentSem?.id).map(s => s.id))
    const currentEnrolls = enrollments.filter(e => currentSecIds.has(e.section_id) && e.is_passed !== null)
    const currentPassCount = currentEnrolls.filter(e => e.is_passed).length
    const currentPassRate = currentEnrolls.length ? (currentPassCount / currentEnrolls.length) * 100 : 0

    // KPI 3: GPA trung bình
    const withGpa = activeStudents.filter(s => s.gpa_cumulative !== null)
    const avgGpa = withGpa.length ? withGpa.reduce((s, x) => s + x.gpa_cumulative!, 0) / withGpa.length : 0

    // KPI 4: SV nguy cơ (gpa_cumulative < 2.0)
    const atRiskCount = activeStudents.filter(s => s.gpa_cumulative !== null && s.gpa_cumulative < 2.0).length

    // Calculate section stats for fail rates
    const sectionStats = new Map<number, { failed: number; total: number; section_code: string; course_id: number }>()
    for (const e of enrollments) {
      if (e.is_passed === null) continue
      const sec = secMap.get(e.section_id); if (!sec) continue
      const s = sectionStats.get(e.section_id) ?? { failed: 0, total: 0, section_code: sec.section_code, course_id: sec.course_id }
      s.total++
      if (!e.is_passed) s.failed++
      sectionStats.set(e.section_id, s)
    }

    // KPI 5: Môn / lớp cảnh báo (fail rate > 40%)
    let warningSectionsCount = 0
    sectionStats.forEach(s => {
      if (s.total > 0 && (s.failed / s.total) > 0.40) {
        warningSectionsCount++
      }
    })

    // Biểu đồ 1 & 2: Trend pass rate & GPA theo học kỳ
    const sortedSemesters = [...semesters].sort((a, b) => a.code.localeCompare(b.code))
    const trendData = sortedSemesters.map(sem => {
      const semSecIds = new Set(sections.filter(s => s.semester_id === sem.id).map(s => s.id))
      const semEnrolls = enrollments.filter(e => semSecIds.has(e.section_id))
      
      const validEnrolls = semEnrolls.filter(e => e.is_passed !== null)
      const passedCount = validEnrolls.filter(e => e.is_passed).length
      const passRate = validEnrolls.length ? (passedCount / validEnrolls.length) * 100 : 0

      const gradeEnrolls = semEnrolls.filter(e => e.final_grade !== null)
      const avgGrade = gradeEnrolls.length ? gradeEnrolls.reduce((sum, e) => sum + e.final_grade!, 0) / gradeEnrolls.length : 0

      return {
        hk: sem.code,
        passRate: Math.round(passRate * 10) / 10,
        avgGrade: Math.round(avgGrade * 100) / 100
      }
    })

    // Action Table Auto Alerts Generation
    const alerts: Array<{ severity: "Cao" | "Trung bình"; unit: string; issue: string; suggestion: string }> = []

    // 1. Cao: Section with fail rate > 40%
    sectionStats.forEach((s, secId) => {
      const failRate = s.total > 0 ? (s.failed / s.total) * 100 : 0
      if (failRate > 40) {
        const c = courseMap.get(s.course_id)
        alerts.push({
          severity: "Cao",
          unit: `Lớp ${s.section_code} (${c?.name ?? "Môn học"})`,
          issue: `Tỷ lệ trượt ${Math.round(failRate)}%`,
          suggestion: "Review đề thi / tăng cường hỗ trợ học tập"
        })
      }
    })

    // 2. Cao: GPA khoa giảm > 0.3 so với kỳ trước
    // Step A: Calculate GPA per department per semester
    const deptSemGpa = new Map<string, number>() // key: "deptId-semId"
    const deptSemCounts = new Map<string, { sum: number; count: number }>()

    for (const e of enrollments) {
      if (e.final_grade === null) continue
      const sec = secMap.get(e.section_id); if (!sec) continue
      const s = students.find(stud => stud.id === e.student_id); if (!s) continue
      const prog = progMap.get(s.program_id); if (!prog) continue
      const key = `${prog.department_id}-${sec.semester_id}`
      const sc = deptSemCounts.get(key) ?? { sum: 0, count: 0 }
      sc.sum += e.final_grade
      sc.count++
      deptSemCounts.set(key, sc)
    }

    deptSemCounts.forEach((sc, key) => {
      deptSemGpa.set(key, sc.sum / sc.count)
    })

    // Step B: Compare consecutive semesters for each department
    departments.forEach(dept => {
      for (let i = 1; i < sortedSemesters.length; i++) {
        const prevSem = sortedSemesters[i - 1]
        const currSem = sortedSemesters[i]
        const prevGpa = deptSemGpa.get(`${dept.id}-${prevSem.id}`)
        const currGpa = deptSemGpa.get(`${dept.id}-${currSem.id}`)
        if (prevGpa !== undefined && currGpa !== undefined) {
          // final_grade is on scale 10. Wait, a drop of 0.3 on scale 4?
          // Since the prompt says "GPA khoa giảm > 0.3 so kỳ trước" and final_grade is scale 10,
          // let's convert final_grade (scale 10) to scale 4 (by multiplying by 0.4) for GPA comparison, or compare in scale 10.
          // Let's compare on scale 10: a drop of 0.3 * 2.5 = 0.75, or just compare on scale 4.0 if we normalize to scale 4.
          const prevGpa4 = prevGpa * 0.4
          const currGpa4 = currGpa * 0.4
          if (prevGpa4 - currGpa4 > 0.3) {
            alerts.push({
              severity: "Cao",
              unit: `${dept.name}`,
              issue: `GPA giảm ${(prevGpa4 - currGpa4).toFixed(2)} so kỳ trước (${currSem.code})`,
              suggestion: "Kiểm tra nhóm môn nền tảng"
            })
          }
        }
      }
    })

    // 3. Trung bình: SV cận trượt (4.5 - 5.0) > 15% lớp
    const sectionNearFails = new Map<number, { nearFails: number; total: number; section_code: string }>()
    for (const e of enrollments) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const s = sectionNearFails.get(e.section_id) ?? { nearFails: 0, total: 0, section_code: sec.section_code }
      s.total++
      if (e.final_grade !== null && e.final_grade >= 4.5 && e.final_grade < 5.0) {
        s.nearFails++
      }
      sectionNearFails.set(e.section_id, s)
    }

    sectionNearFails.forEach((s, secId) => {
      if (s.total > 0 && (s.nearFails / s.total) > 0.15) {
        alerts.push({
          severity: "Trung bình",
          unit: `Lớp ${s.section_code}`,
          issue: `${Math.round(s.nearFails / s.total * 100)}% SV cận trượt (4.5–5.0)`,
          suggestion: "Gửi cảnh báo đến cố vấn học tập"
        })
      }
    })

    // 4. Môn có fail rate tăng 3 kỳ liên tiếp
    // Step A: Calculate course fail rate per semester
    const courseSemFailStats = new Map<string, { failed: number; total: number }>() // key: "courseId-semId"
    for (const e of enrollments) {
      if (e.is_passed === null) continue
      const sec = secMap.get(e.section_id); if (!sec) continue
      const key = `${sec.course_id}-${sec.semester_id}`
      const stat = courseSemFailStats.get(key) ?? { failed: 0, total: 0 }
      stat.total++
      if (!e.is_passed) stat.failed++
      courseSemFailStats.set(key, stat)
    }

    courses.forEach(course => {
      const failRates = sortedSemesters.map(sem => {
        const stat = courseSemFailStats.get(`${course.id}-${sem.id}`)
        return stat && stat.total > 0 ? (stat.failed / stat.total) : null
      }).filter((v): v is number => v !== null)

      // Check for 3 consecutive semesters of increasing fail rate
      if (failRates.length >= 3) {
        for (let i = 2; i < failRates.length; i++) {
          if (failRates[i] > failRates[i - 1] && failRates[i - 1] > failRates[i - 2]) {
            alerts.push({
              severity: "Trung bình",
              unit: `${course.code} - ${course.name}`,
              issue: `Fail rate tăng 3 kỳ liên tiếp (${(failRates[i - 2] * 100).toFixed(0)}% → ${(failRates[i - 1] * 100).toFixed(0)}% → ${(failRates[i] * 100).toFixed(0)}%)`,
              suggestion: "Rà soát nội dung + đề kiểm tra"
            })
            break // Avoid duplicate alerts for same course
          }
        }
      }
    })

    return {
      totalActiveStudents,
      currentPassRate,
      avgGpa,
      atRiskCount,
      warningSectionsCount,
      trendData,
      alerts,
      currentSem
    }
  }, [raw])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  const kpiList = [
    {
      label: "Tổng SV đang học",
      value: stats ? stats.totalActiveStudents : 0,
      description: "Đang học (Active)",
      icon: <Users className="h-5 w-5 text-blue-500" />,
      alert: false
    },
    {
      label: "Pass rate kỳ hiện tại",
      value: stats ? `${stats.currentPassRate.toFixed(1)}%` : "0%",
      description: `Học kỳ: ${stats?.currentSem?.name ?? "—"}`,
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      alert: stats ? stats.currentPassRate < 70 : false,
      alertMsg: "Dưới ngưỡng 70%"
    },
    {
      label: "GPA trung bình",
      value: stats ? stats.avgGpa.toFixed(2) : "0.00",
      description: "Sinh viên active",
      icon: <TrendingUp className="h-5 w-5 text-purple-500" />,
      alert: stats ? stats.avgGpa < 2.5 : false,
      alertMsg: "Dưới 2.5"
    },
    {
      label: "SV nguy cơ",
      value: stats ? stats.atRiskCount : 0,
      description: "GPA tích lũy < 2.0",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      alert: stats ? stats.atRiskCount > 0 : false,
      alertMsg: "Có sinh viên nguy cơ"
    },
    {
      label: "Môn / lớp cảnh báo",
      value: stats ? stats.warningSectionsCount : 0,
      description: "Lớp có fail rate > 40%",
      icon: <AlertCircle className="h-5 w-5 text-rose-500" />,
      alert: stats ? stats.warningSectionsCount > 0 : false,
      alertMsg: "Yêu cầu can thiệp"
    }
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {kpiList.map((kpi, idx) => (
          <Card key={idx} className={`relative overflow-hidden ${kpi.alert ? "border-rose-500/50 bg-rose-50/50 dark:bg-rose-950/10" : ""}`}>
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                  <h3 className="text-2xl font-bold">{kpi.value}</h3>
                  <p className="text-[10px] text-muted-foreground">{kpi.description}</p>
                </div>
                <div className="p-2 bg-background rounded-lg border shadow-sm">
                  {kpi.icon}
                </div>
              </div>
              {kpi.alert && (
                <div className="mt-2.5 flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                  <AlertCircle className="h-3 w-3" />
                  {kpi.alertMsg}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Xu hướng Pass Rate theo học kỳ</CardTitle>
            <CardDescription className="text-xs">Tỷ lệ qua môn (%) toàn trường qua các kỳ</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats?.trendData ?? []} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, "Pass Rate"]} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Ngưỡng 70%", position: "insideBottomLeft", fill: "#ef4444", fontSize: 10 }} />
                <Line type="monotone" dataKey="passRate" name="Pass Rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Xu hướng GPA theo học kỳ</CardTitle>
            <CardDescription className="text-xs">Điểm trung bình học kỳ (thang 10) toàn trường</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats?.trendData ?? []} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, "Điểm TB"]} />
                <Line type="monotone" dataKey="avgGrade" name="Điểm TB" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Action Table */}
      <Card className="shadow-sm border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">Vấn đề cần xử lý ngay</CardTitle>
            <CardDescription className="text-xs">Tự động phát hiện bất thường từ dữ liệu học thuật</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {stats?.alerts.length ?? 0} cảnh báo
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] pl-6">Mức độ</TableHead>
                  <TableHead className="w-[220px]">Đơn vị</TableHead>
                  <TableHead>Vấn đề</TableHead>
                  <TableHead className="pr-6">Gợi ý xử lý</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.alerts && stats.alerts.length > 0 ? (
                  stats.alerts.map((alert, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="pl-6">
                        <Badge variant={alert.severity === "Cao" ? "destructive" : "secondary"} className="text-[10px]">
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs">{alert.unit}</TableCell>
                      <TableCell className="text-xs">{alert.issue}</TableCell>
                      <TableCell className="text-xs text-muted-foreground pr-6">{alert.suggestion}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                      Không phát hiện vấn đề bất thường nào cần xử lý ngay.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
