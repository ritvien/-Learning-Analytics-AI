"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, CheckCircle2, TrendingUp, AlertCircle, AlertTriangle, FileDown } from "lucide-react"
import { api, type ApiSection, type ApiSemester, type ApiStudent, type ApiEnrollment, type ApiCourse } from "@/lib/api"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts"

type Raw = {
  students: ApiStudent[]
  enrollments: ApiEnrollment[]
  courses: ApiCourse[]
  sections: ApiSection[]
  semesters: ApiSemester[]
}

export default function SectionRiskAnalyticsPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [selectedSemId, setSelectedSemId] = React.useState<string>("")
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("")
  const [selectedSecId, setSelectedSecId] = React.useState<string>("")

  React.useEffect(() => {
    Promise.all([
      api.getStudents({ limit: 500 }),
      api.getEnrollments({ limit: 3000 }),
      api.getCourses({ limit: 200 }),
      api.getSections({ limit: 300 }),
      api.getSemesters(),
    ]).then(([students, enrollments, courses, sections, semesters]) => {
      setRaw({ students, enrollments, courses, sections, semesters })
      setLoading(false)

      // Initialize default filters
      const currentSem = semesters.find(s => s.is_current) || semesters[0]
      if (currentSem) {
        setSelectedSemId(currentSem.id.toString())
        
        // Find sections in this semester
        const semSections = sections.filter(s => s.semester_id === currentSem.id)
        if (semSections.length > 0) {
          const firstSec = semSections[0]
          setSelectedCourseId(firstSec.course_id.toString())
          setSelectedSecId(firstSec.id.toString())
        }
      }
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  // Dynamic filter lists
  const availableCourses = React.useMemo(() => {
    if (!raw || !selectedSemId) return []
    const semId = parseInt(selectedSemId)
    const semSectionCourseIds = new Set(raw.sections.filter(s => s.semester_id === semId).map(s => s.course_id))
    return raw.courses.filter(c => semSectionCourseIds.has(c.id))
  }, [raw, selectedSemId])

  const availableSections = React.useMemo(() => {
    if (!raw || !selectedSemId || !selectedCourseId) return []
    const semId = parseInt(selectedSemId)
    const courseId = parseInt(selectedCourseId)
    return raw.sections.filter(s => s.semester_id === semId && s.course_id === courseId)
  }, [raw, selectedSemId, selectedCourseId])

  // Automatically adjust dependent filters
  React.useEffect(() => {
    if (availableCourses.length > 0) {
      const exists = availableCourses.some(c => c.id.toString() === selectedCourseId)
      if (!exists) {
        setSelectedCourseId(availableCourses[0].id.toString())
      }
    } else {
      setSelectedCourseId("")
    }
  }, [availableCourses, selectedCourseId])

  React.useEffect(() => {
    if (availableSections.length > 0) {
      const exists = availableSections.some(s => s.id.toString() === selectedSecId)
      if (!exists) {
        setSelectedSecId(availableSections[0].id.toString())
      }
    } else {
      setSelectedSecId("")
    }
  }, [availableSections, selectedSecId])

  const stats = React.useMemo(() => {
    if (!raw || !selectedSecId || !selectedCourseId) return null
    const { students, enrollments, sections, courses } = raw

    const secId = parseInt(selectedSecId)
    const courseId = parseInt(selectedCourseId)

    const currentSection = sections.find(s => s.id === secId)
    const currentCourse = courses.find(c => c.id === courseId)
    if (!currentSection || !currentCourse) return null

    const studentMap = new Map(students.map(s => [s.id, s]))

    // Find class enrollments
    const classEnrolls = enrollments.filter(e => e.section_id === secId)
    const validEnrolls = classEnrolls.filter(e => e.is_passed !== null)

    // KPI 1: SV trong lớp
    const totalStudentsCount = classEnrolls.length

    // KPI 2: Pass rate
    const passedEnrolls = validEnrolls.filter(e => e.is_passed)
    const passRate = validEnrolls.length ? (passedEnrolls.length / validEnrolls.length) * 100 : 0

    // KPI 3: Avg grade
    const gradedEnrolls = classEnrolls.filter(e => e.final_grade !== null)
    const avgGrade = gradedEnrolls.length ? gradedEnrolls.reduce((sum, e) => sum + e.final_grade!, 0) / gradedEnrolls.length : 0

    // KPI 4: SV trượt
    const failedCount = validEnrolls.filter(e => !e.is_passed).length

    // KPI 5: SV cận trượt (4.5 - 5.0)
    const nearFailCount = classEnrolls.filter(e => e.final_grade !== null && e.final_grade >= 4.5 && e.final_grade < 5.0).length

    // Chart 1: Grade distribution of current section
    const gradeBuckets = [
      { range: "0–4", count: 0, color: "#ef4444" },
      { range: "4–5", count: 0, color: "#f97316" },
      { range: "5–6", count: 0, color: "#f59e0b" },
      { range: "6–7", count: 0, color: "#eab308" },
      { range: "7–8", count: 0, color: "#84cc16" },
      { range: "8–10", count: 0, color: "#10b981" },
    ]
    classEnrolls.forEach(e => {
      if (e.final_grade === null) return
      const g = e.final_grade
      if (g < 4.0) gradeBuckets[0].count++
      else if (g < 5.0) gradeBuckets[1].count++
      else if (g < 6.0) gradeBuckets[2].count++
      else if (g < 7.0) gradeBuckets[3].count++
      else if (g < 8.0) gradeBuckets[4].count++
      else gradeBuckets[5].count++
    })

    // Chart 2: Section vs Course Average
    // Find all sections of the same course
    const courseSecIds = new Set(sections.filter(s => s.course_id === courseId).map(s => s.id))
    const courseEnrolls = enrollments.filter(e => courseSecIds.has(e.section_id) && e.is_passed !== null)
    const coursePassedCount = courseEnrolls.filter(e => e.is_passed).length
    const courseAvgPassRate = courseEnrolls.length ? (coursePassedCount / courseEnrolls.length) * 100 : 0

    const courseGradedEnrolls = enrollments.filter(e => courseSecIds.has(e.section_id) && e.final_grade !== null)
    const courseAvgGrade = courseGradedEnrolls.length ? courseGradedEnrolls.reduce((sum, e) => sum + e.final_grade!, 0) / courseGradedEnrolls.length : 0

    const compareData = [
      { name: "Pass Rate (%)", "Lớp hiện tại": Math.round(passRate), "Trung bình môn": Math.round(courseAvgPassRate) },
      { name: "Điểm TB (x10)", "Lớp hiện tại": Math.round(avgGrade * 10), "Trung bình môn": Math.round(courseAvgGrade * 10) }
    ]

    // Table: Student risk list
    const studentRiskList = classEnrolls.map(e => {
      const student = studentMap.get(e.student_id)
      const grade = e.final_grade
      let status = "Qua"
      let alertLevel: "Cao" | "Trung bình" | "Bình thường" = "Bình thường"

      if (e.is_passed === false) {
        status = "Trượt"
        alertLevel = "Cao"
      } else if (grade !== null && grade >= 4.5 && grade < 5.0) {
        status = "Cận trượt"
        alertLevel = "Trung bình"
      } else if (grade !== null && grade >= 5.0 && grade <= 5.5) {
        status = "Qua — nguy cơ"
        alertLevel = "Trung bình"
      }

      return {
        student_code: student?.student_code ?? "—",
        full_name: student?.full_name ?? "Sinh viên",
        grade: grade !== null ? grade.toFixed(1) : "—",
        status,
        alertLevel
      }
    })

    // Sort: Cao (Trượt) -> Trung bình (Cận trượt / Nguy cơ) -> Bình thường
    const sortedStudentRisk = studentRiskList.sort((a, b) => {
      const score = { "Cao": 3, "Trung bình": 2, "Bình thường": 1 }
      return score[b.alertLevel] - score[a.alertLevel]
    })

    return {
      currentSection,
      currentCourse,
      totalStudentsCount,
      passRate,
      avgGrade,
      failedCount,
      nearFailCount,
      gradeBuckets,
      compareData,
      sortedStudentRisk
    }
  }, [raw, selectedSecId, selectedCourseId])

  // Export attention list to CSV
  const exportToCsv = () => {
    if (!stats || !stats.sortedStudentRisk.length) return
    const filteredForAttention = stats.sortedStudentRisk.filter(s => s.alertLevel !== "Bình thường")
    if (filteredForAttention.length === 0) return

    const headers = "MSSV,Họ tên,Điểm,Trạng thái,Mức cảnh báo\n"
    const rows = filteredForAttention.map(s => 
      `"${s.student_code}","${s.full_name}",${s.grade},"${s.status}","${s.alertLevel}"`
    ).join("\n")

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `Canh_bao_SV_lop_${stats.currentSection.section_code}.csv`)
    link.click()
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phân tích Lớp học phần & Cảnh báo</h1>
          <p className="text-sm text-muted-foreground">Theo dõi kết quả lớp học phần, tìm sinh viên cần can thiệp hỗ trợ sớm</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Semester Filter */}
          <Select value={selectedSemId} onValueChange={(val) => setSelectedSemId(val || "")}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Học kỳ" />
            </SelectTrigger>
            <SelectContent>
              {raw?.semesters.map(sem => (
                <SelectItem key={sem.id} value={sem.id.toString()}>{sem.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Course Filter */}
          <Select value={selectedCourseId} onValueChange={(val) => setSelectedCourseId(val || "")} disabled={availableCourses.length === 0}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Môn học" />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map(course => (
                <SelectItem key={course.id} value={course.id.toString()}>{course.code} — {course.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Section Filter */}
          <Select value={selectedSecId} onValueChange={(val) => setSelectedSecId(val || "")} disabled={availableSections.length === 0}>
            <SelectTrigger className="w-[160px] bg-background font-medium border-primary/50">
              <SelectValue placeholder="Lớp học phần" />
            </SelectTrigger>
            <SelectContent>
              {availableSections.map(sec => (
                <SelectItem key={sec.id} value={sec.id.toString()}>{sec.section_code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {stats ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">SV đăng ký</span>
                  <h3 className="text-2xl font-bold">{stats.totalStudentsCount}</h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <Users className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className={stats.passRate < 70 ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/10" : ""}>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Pass rate</span>
                  <h3 className="text-2xl font-bold">{stats.passRate.toFixed(1)}%</h3>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Điểm trung bình</span>
                  <h3 className="text-2xl font-bold">{stats.avgGrade.toFixed(2)}</h3>
                </div>
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className={stats.failedCount > 0 ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/10" : ""}>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">SV trượt</span>
                  <h3 className="text-2xl font-bold">{stats.failedCount}</h3>
                </div>
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                  <AlertCircle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className={stats.nearFailCount > 0 ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/10" : ""}>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">SV cận trượt</span>
                  <h3 className="text-2xl font-bold">{stats.nearFailCount}</h3>
                </div>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Phân bổ điểm lớp này</CardTitle>
                <CardDescription className="text-xs">Phân bổ điểm số tổng kết của lớp học phần</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.gradeBuckets} margin={{ left: -25, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [v, "Số SV"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.gradeBuckets.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Lớp này vs Trung bình môn</CardTitle>
                <CardDescription className="text-xs">So sánh Pass Rate (%) và Điểm TB (x10) so với các lớp cùng môn</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.compareData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Lớp hiện tại" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Trung bình môn" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Student warning list */}
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-semibold">Danh sách sinh viên cần chú ý</CardTitle>
                <CardDescription className="text-xs">Sắp xếp ưu tiên: Trượt &rarr; Cận trượt &rarr; Qua nhưng nguy cơ cao</CardDescription>
              </div>
              <button
                onClick={exportToCsv}
                disabled={stats.sortedStudentRisk.filter(s => s.alertLevel !== "Bình thường").length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border bg-background hover:bg-muted transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDown className="h-3.5 w-3.5" />
                Xuất danh sách
              </button>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <div className="max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="pl-6 w-[120px]">MSSV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead className="text-center w-[100px]">Điểm</TableHead>
                      <TableHead className="text-center w-[120px]">Trạng thái</TableHead>
                      <TableHead className="pr-6 text-right w-[150px]">Mức cảnh báo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.sortedStudentRisk.length > 0 ? (
                      stats.sortedStudentRisk.map((s, idx) => (
                        <TableRow key={idx} className={s.alertLevel !== "Bình thường" ? "bg-muted/10" : ""}>
                          <TableCell className="pl-6 font-mono text-xs">{s.student_code}</TableCell>
                          <TableCell className="font-semibold text-xs">{s.full_name}</TableCell>
                          <TableCell className="text-center font-bold text-xs">{s.grade}</TableCell>
                          <TableCell className="text-center text-xs">
                            <span className={
                              s.status === "Trượt" ? "text-rose-500 font-semibold" :
                              s.status === "Cận trượt" ? "text-orange-500 font-semibold" :
                              s.status === "Qua — nguy cơ" ? "text-amber-500 font-semibold" : ""
                            }>
                              {s.status}
                            </span>
                          </TableCell>
                          <TableCell className="pr-6 text-right text-xs">
                            {s.alertLevel !== "Bình thường" ? (
                              <Badge
                                variant={s.alertLevel === "Cao" ? "destructive" : "secondary"}
                                className="text-[10px]"
                              >
                                {s.alertLevel}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">An toàn</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                          Không có sinh viên đăng ký lớp này.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center border border-dashed rounded-xl text-sm text-muted-foreground bg-muted/10">
          Vui lòng chọn lớp học phần để xem phân tích dữ liệu
        </div>
      )}
    </div>
  )
}
