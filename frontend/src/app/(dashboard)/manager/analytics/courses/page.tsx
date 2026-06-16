"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, CheckCircle2, TrendingUp, HelpCircle, Layers, AlertCircle } from "lucide-react"
import { api, type ApiSection, type ApiSemester, type ApiStudent, type ApiEnrollment, type ApiCourse, type ApiDepartment, type ApiProgram } from "@/lib/api"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts"

type Raw = {
  departments: ApiDepartment[]
  programs: ApiProgram[]
  courses: ApiCourse[]
  semesters: ApiSemester[]
  sections: ApiSection[]
  enrollments: ApiEnrollment[]
}

export default function CourseAnalyticsPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [selectedDept, setSelectedDept] = React.useState("all")
  const [selectedProg, setSelectedProg] = React.useState("all")
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("")

  React.useEffect(() => {
    Promise.all([
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 100 }),
      api.getCourses({ limit: 200 }),
      api.getSemesters(),
      api.getSections({ limit: 300 }),
      api.getEnrollments({ limit: 3000 }),
    ]).then(([departments, programs, courses, semesters, sections, enrollments]) => {
      setRaw({ departments, programs, courses, semesters, sections, enrollments })
      setLoading(false)
      if (courses.length > 0) {
        setSelectedCourseId(courses[0].id.toString())
      }
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  // Auto-select first course when filters change
  const filteredCourses = React.useMemo(() => {
    if (!raw) return []
    const { courses, programs } = raw
    let result = courses

    if (selectedDept !== "all") {
      const deptId = parseInt(selectedDept)
      const deptProgIds = new Set(programs.filter(p => p.department_id === deptId).map(p => p.id))
      result = result.filter(c => c.program_ids.some(pid => deptProgIds.has(pid)))
    }

    if (selectedProg !== "all") {
      const progId = parseInt(selectedProg)
      result = result.filter(c => c.program_ids.includes(progId))
    }

    return result
  }, [raw, selectedDept, selectedProg])

  React.useEffect(() => {
    if (filteredCourses.length > 0) {
      // If currently selected course is not in the filtered list, switch to the first one
      const exists = filteredCourses.some(c => c.id.toString() === selectedCourseId)
      if (!exists) {
        setSelectedCourseId(filteredCourses[0].id.toString())
      }
    } else {
      setSelectedCourseId("")
    }
  }, [filteredCourses, selectedCourseId])

  const stats = React.useMemo(() => {
    if (!raw || !selectedCourseId) return null
    const { courses, semesters, sections, enrollments } = raw

    const courseId = parseInt(selectedCourseId)
    const currentCourse = courses.find(c => c.id === courseId)
    if (!currentCourse) return null

    const semMap = new Map(semesters.map(s => [s.id, s]))
    const secMap = new Map(sections.map(s => [s.id, s]))

    // Find sections belonging to the selected course
    const courseSections = sections.filter(s => s.course_id === courseId)
    const courseSectionIds = new Set(courseSections.map(s => s.id))

    // Find enrollments for these sections
    const courseEnrolls = enrollments.filter(e => courseSectionIds.has(e.section_id))
    const validEnrolls = courseEnrolls.filter(e => e.is_passed !== null)

    // KPI 1: Tổng lượt học
    const totalEnrollments = courseEnrolls.length

    // KPI 2: Pass rate tổng hợp
    const passedEnrolls = validEnrolls.filter(e => e.is_passed)
    const overallPassRate = validEnrolls.length ? (passedEnrolls.length / validEnrolls.length) * 100 : 0

    // KPI 3: Avg grade
    const gradedEnrolls = courseEnrolls.filter(e => e.final_grade !== null)
    const avgGrade = gradedEnrolls.length ? gradedEnrolls.reduce((sum, e) => sum + e.final_grade!, 0) / gradedEnrolls.length : 0

    // KPI 4: Số lớp học phần
    const totalSectionsCount = courseSections.length

    // KPI 5: Fail rate cao nhất trong 1 học kỳ bất kỳ
    const semFailRates = semesters.map(sem => {
      const semSecs = new Set(courseSections.filter(s => s.semester_id === sem.id).map(s => s.id))
      const semEnrolls = courseEnrolls.filter(e => semSecs.has(e.section_id) && e.is_passed !== null)
      const failed = semEnrolls.filter(e => !e.is_passed).length
      const rate = semEnrolls.length ? (failed / semEnrolls.length) * 100 : 0
      return { semCode: sem.code, rate, total: semEnrolls.length }
    }).filter(s => s.total > 0)

    const maxFailRate = semFailRates.length ? Math.max(...semFailRates.map(s => s.rate)) : 0

    // Chart 1 & 2: Trend pass rate & GPA theo học kỳ
    const sortedSemesters = [...semesters].sort((a, b) => a.code.localeCompare(b.code))
    const semTrendData = sortedSemesters.map(sem => {
      const semSecs = new Set(courseSections.filter(s => s.semester_id === sem.id).map(s => s.id))
      const semEnrolls = courseEnrolls.filter(e => semSecs.has(e.section_id))
      const valid = semEnrolls.filter(e => e.is_passed !== null)
      const passed = valid.filter(e => e.is_passed).length
      const rate = valid.length ? (passed / valid.length) * 100 : null

      const graded = semEnrolls.filter(e => e.final_grade !== null)
      const avg = graded.length ? graded.reduce((sum, e) => sum + e.final_grade!, 0) / graded.length : null

      return {
        hk: sem.code,
        passRate: rate !== null ? Math.round(rate * 10) / 10 : null,
        avgGrade: avg !== null ? Math.round(avg * 100) / 100 : null
      }
    }).filter(d => d.passRate !== null || d.avgGrade !== null)

    // Chart 3: Distribution điểm (tổng hợp)
    // Buckets: 0-4 | 4-5 | 5-6 | 6-7 | 7-8 | 8-10
    const gradeBuckets = [
      { range: "0–4", count: 0, color: "#ef4444" },
      { range: "4–5", count: 0, color: "#f97316" },
      { range: "5–6", count: 0, color: "#f59e0b" },
      { range: "6–7", count: 0, color: "#eab308" },
      { range: "7–8", count: 0, color: "#84cc16" },
      { range: "8–10", count: 0, color: "#10b981" },
    ]

    courseEnrolls.forEach(e => {
      if (e.final_grade === null) return
      const g = e.final_grade
      if (g < 4.0) gradeBuckets[0].count++
      else if (g < 5.0) gradeBuckets[1].count++
      else if (g < 6.0) gradeBuckets[2].count++
      else if (g < 7.0) gradeBuckets[3].count++
      else if (g < 8.0) gradeBuckets[4].count++
      else gradeBuckets[5].count++
    })

    // Table: Section details
    const sectionsDetails = courseSections.map(sec => {
      const secEnrolls = courseEnrolls.filter(e => e.section_id === sec.id)
      const validSec = secEnrolls.filter(e => e.is_passed !== null)
      const passed = validSec.filter(e => e.is_passed).length
      const rate = validSec.length ? (passed / validSec.length) * 100 : 0
      const deviation = rate - overallPassRate

      return {
        code: sec.section_code,
        semester: semMap.get(sec.semester_id)?.name ?? "Học kỳ",
        studentCount: secEnrolls.length,
        passRate: Math.round(rate),
        deviation: Math.round(deviation)
      }
    })

    return {
      currentCourse,
      totalEnrollments,
      overallPassRate,
      avgGrade,
      totalSectionsCount,
      maxFailRate,
      semTrendData,
      gradeBuckets,
      sectionsDetails
    }
  }, [raw, selectedCourseId])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  const filteredPrograms = raw ? (selectedDept === "all" ? [] : raw.programs.filter(p => p.department_id === parseInt(selectedDept))) : []

  return (
    <div className="flex flex-col gap-6">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phân tích Môn học</h1>
          <p className="text-sm text-muted-foreground">Phân tích sâu hiệu quả học tập và tỷ lệ trượt của từng môn học qua các kỳ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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

          {/* Course Filter */}
          <Select value={selectedCourseId} onValueChange={(val) => setSelectedCourseId(val || "")} disabled={filteredCourses.length === 0}>
            <SelectTrigger className="w-[220px] bg-background font-medium border-primary/50">
              <SelectValue placeholder="Chọn môn học" />
            </SelectTrigger>
            <SelectContent>
              {filteredCourses.map(course => (
                <SelectItem key={course.id} value={course.id.toString()}>{course.code} — {course.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {stats ? (
        <>
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Tổng lượt học</span>
                  <h3 className="text-2xl font-bold">{stats.totalEnrollments}</h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <Layers className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Pass rate tổng hợp</span>
                  <h3 className="text-2xl font-bold">{stats.overallPassRate.toFixed(1)}%</h3>
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
                  <h3 className="text-2xl font-bold">{stats.avgGrade.toFixed(2)}</h3>
                </div>
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Số lớp học phần</span>
                  <h3 className="text-2xl font-bold">{stats.totalSectionsCount}</h3>
                </div>
                <div className="p-2 bg-slate-500/10 rounded-lg text-slate-500">
                  <BookOpen className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className={stats.maxFailRate > 40 ? "border-rose-500 bg-rose-50/20 dark:bg-rose-950/10" : ""}>
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Fail rate cao nhất</span>
                  <h3 className="text-2xl font-bold">{stats.maxFailRate.toFixed(1)}%</h3>
                </div>
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                  <AlertCircle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1: Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Trend Pass Rate theo học kỳ</CardTitle>
                <CardDescription className="text-xs">Tiến trình thay đổi tỷ lệ qua môn (%) qua các học kỳ</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.semTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={stats.semTrendData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hk" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [`${v}%`, "Pass Rate"]} />
                      <Line type="monotone" dataKey="passRate" name="Pass Rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">Chưa có dữ liệu xu hướng</div>
                )}
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Trend GPA theo học kỳ</CardTitle>
                <CardDescription className="text-xs">Tiến trình thay đổi điểm trung bình học tập (thang 10)</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.semTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={stats.semTrendData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hk" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [v, "GPA"]} />
                      <Line type="monotone" dataKey="avgGrade" name="GPA" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">Chưa có dữ liệu xu hướng</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Distribution & Table */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Grade Distribution */}
            <Card className="lg:col-span-2 border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Phân bổ điểm tổng hợp</CardTitle>
                <CardDescription className="text-xs">Số lượng sinh viên đạt điểm trong các khoảng</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
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

            {/* Sections Details Table */}
            <Card className="lg:col-span-3 border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Chi tiết các lớp học phần</CardTitle>
                <CardDescription className="text-xs">So sánh pass rate từng lớp so với trung bình môn</CardDescription>
              </CardHeader>
              <CardContent className="p-0 border-t">
                <div className="max-h-[280px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="pl-6">Mã lớp</TableHead>
                        <TableHead>Học kỳ</TableHead>
                        <TableHead className="text-center">SV đăng ký</TableHead>
                        <TableHead className="text-center">Pass rate</TableHead>
                        <TableHead className="pr-6 text-right">So với TB</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.sectionsDetails.length > 0 ? (
                        stats.sectionsDetails.map((sec, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="pl-6 font-semibold text-xs">{sec.code}</TableCell>
                            <TableCell className="text-xs">{sec.semester}</TableCell>
                            <TableCell className="text-center text-xs">{sec.studentCount}</TableCell>
                            <TableCell className="text-center font-semibold text-xs">{sec.passRate}%</TableCell>
                            <TableCell className="pr-6 text-right text-xs">
                              <Badge
                                variant={sec.deviation < -15 ? "destructive" : sec.deviation >= 0 ? "outline" : "secondary"}
                                className={`text-[10px] ${sec.deviation >= 0 ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : ""}`}
                              >
                                {sec.deviation >= 0 ? `+${sec.deviation}%` : `${sec.deviation}%`}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                            Chưa có thông tin lớp học phần.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center border border-dashed rounded-xl text-sm text-muted-foreground bg-muted/10">
          Vui lòng chọn môn học để xem phân tích dữ liệu
        </div>
      )}
    </div>
  )
}
