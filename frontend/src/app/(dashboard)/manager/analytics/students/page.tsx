"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, BookOpen, CheckCircle2, TrendingDown, TrendingUp, UserRound } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  api,
  type ApiCourse,
  type ApiEnrollment,
  type ApiProgram,
  type ApiSection,
  type ApiSemester,
  type ApiStudent,
} from "@/lib/api"

type Raw = {
  students: ApiStudent[]
  enrollments: ApiEnrollment[]
  sections: ApiSection[]
  courses: ApiCourse[]
  semesters: ApiSemester[]
  programs: ApiProgram[]
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function courseGroup(course: ApiCourse | undefined) {
  if (!course) return "Chưa phân nhóm"
  if (course.is_elective) return "Tự chọn"
  if (course.credits <= 2) return "Đại cương"
  if (course.credits === 3) return "Cơ sở ngành"
  return "Chuyên ngành"
}

function resultLabel(grade: number | null) {
  if (grade === null) return "Chưa có điểm"
  if (grade < 4) return "Trượt nặng"
  if (grade < 5) return "Cận trượt"
  if (grade < 5.5) return "Qua yếu"
  if (grade < 8) return "Qua ổn"
  return "Tốt"
}

function dateStartIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function dateEndIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

export default function StudentAnalyticsPage() {
  const searchParams = useSearchParams()
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [studentId, setStudentId] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

  React.useEffect(() => {
    Promise.all([
      api.getStudents({ limit: 1000 }),
      api.getSections({ limit: 5000 }),
      api.getCourses({ limit: 500 }),
      api.getSemesters(),
      api.getPrograms({ limit: 500 }),
    ])
      .then(([students, sections, courses, semesters, programs]) => {
        setRaw({ students, enrollments: [], sections, courses, semesters, programs })
        const queryStudent = searchParams.get("student_id") ?? searchParams.get("student")
        const fallback = students[0]?.id
        setStudentId(queryStudent && students.some((student) => String(student.id) === queryStudent) ? queryStudent : String(fallback ?? ""))
      })
      .catch(console.error)
  }, [searchParams])

  React.useEffect(() => {
    if (!studentId) return
    api.getEnrollments({
      student_id: Number(studentId),
      limit: 50000,
      date_from: dateStartIso(dateFrom),
      date_to: dateEndIso(dateTo),
    })
      .then((enrollments) => {
        setRaw((current) => current ? { ...current, enrollments } : current)
      })
      .catch(console.error)
  }, [studentId, dateFrom, dateTo])

  const data = React.useMemo(() => {
    if (!raw || !studentId) return null
    const student = raw.students.find((item) => item.id === Number(studentId))
    if (!student) return null
    const sectionMap = new Map(raw.sections.map((section) => [section.id, section]))
    const courseMap = new Map(raw.courses.map((course) => [course.id, course]))
    const semesterMap = new Map(raw.semesters.map((semester) => [semester.id, semester]))
    const program = raw.programs.find((item) => item.id === student.program_id)
    const rows = raw.enrollments
      .filter((enrollment) => enrollment.student_id === student.id)
      .map((enrollment) => {
        const section = sectionMap.get(enrollment.section_id)
        const course = section ? courseMap.get(section.course_id) : undefined
        const semester = section ? semesterMap.get(section.semester_id) : undefined
        return {
          enrollment,
          section,
          course,
          semester,
          group: courseGroup(course),
        }
      })
      .sort((a, b) => (b.semester?.year ?? 0) - (a.semester?.year ?? 0) || (b.semester?.term ?? 0) - (a.semester?.term ?? 0))
    const gradedRows = rows.filter((row) => row.enrollment.final_grade !== null)
    const passedRows = rows.filter((row) => row.enrollment.is_passed === true)
    const failedRows = rows.filter((row) => row.enrollment.is_passed === false)
    const passRate = rows.filter((row) => row.enrollment.is_passed !== null).length
      ? +(passedRows.length / rows.filter((row) => row.enrollment.is_passed !== null).length * 100).toFixed(1)
      : 0
    const completedCredits = passedRows.reduce((sum, row) => sum + (row.course?.credits ?? 0), 0)
    const failedCredits = failedRows.reduce((sum, row) => sum + (row.course?.credits ?? 0), 0)
    const semesters = [...raw.semesters].sort((a, b) => a.year - b.year || a.term - b.term)
    const gpaTrend = semesters.map((semester) => {
      const grades = rows
        .filter((row) => row.semester?.id === semester.id)
        .flatMap((row) => row.enrollment.final_grade === null ? [] : [row.enrollment.final_grade])
      return {
        semester: semester.code,
        avgGrade: +avg(grades).toFixed(2),
        count: grades.length,
      }
    }).filter((item) => item.count > 0)
    const courseGrades = gradedRows.map((row) => ({
      name: row.course?.code ?? row.section?.section_code ?? "Môn học",
      grade: row.enrollment.final_grade ?? 0,
      fullName: row.course?.name ?? "Chưa rõ môn",
    }))
    const groupMap = new Map<string, number[]>()
    for (const row of gradedRows) {
      const values = groupMap.get(row.group) ?? []
      values.push(row.enrollment.final_grade!)
      groupMap.set(row.group, values)
    }
    const groupData = [...groupMap.entries()].map(([name, grades]) => ({
      name,
      avgGrade: +avg(grades).toFixed(2),
    }))
    const riskRows = [
      {
        factor: "GPA cumulative",
        status: student.gpa_cumulative === null ? "Thiếu dữ liệu" : student.gpa_cumulative.toFixed(2),
        detail: student.gpa_cumulative !== null && student.gpa_cumulative < 2 ? "Dưới ngưỡng 2.0" : "Trong ngưỡng theo dõi",
        bad: student.gpa_cumulative !== null && student.gpa_cumulative < 2,
      },
      {
        factor: "Số môn trượt",
        status: String(failedRows.length),
        detail: failedRows.length > 0 ? "Có môn cần học lại hoặc hỗ trợ" : "Chưa ghi nhận môn trượt",
        bad: failedRows.length > 0,
      },
      {
        factor: "Môn cận trượt",
        status: String(rows.filter((row) => row.enrollment.final_grade !== null && row.enrollment.final_grade >= 4 && row.enrollment.final_grade < 5).length),
        detail: "Nhóm điểm 4.0-5.0 cần theo dõi",
        bad: rows.some((row) => row.enrollment.final_grade !== null && row.enrollment.final_grade >= 4 && row.enrollment.final_grade < 5),
      },
      {
        factor: "Xu hướng gần nhất",
        status: gpaTrend.length >= 2 && gpaTrend.at(-1)!.avgGrade < gpaTrend.at(-2)!.avgGrade ? "Giảm" : "Ổn định/tăng",
        detail: "So sánh hai học kỳ có điểm gần nhất",
        bad: gpaTrend.length >= 2 && gpaTrend.at(-1)!.avgGrade < gpaTrend.at(-2)!.avgGrade,
      },
    ]
    return {
      student,
      program,
      rows,
      gpaTrend,
      courseGrades,
      groupData,
      riskRows,
      completedCredits,
      failedCredits,
      failedCount: failedRows.length,
      passRate,
      riskLevel: riskRows.some((row) => row.bad) ? "Cần theo dõi" : "Ổn định",
    }
  }, [raw, studentId])

  if (!raw || !data) {
    return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Đang tải dashboard sinh viên...</div>
  }

  const kpis = [
    { label: "GPA cumulative", value: data.student.gpa_cumulative?.toFixed(2) ?? "—", icon: TrendingUp },
    { label: "Tín chỉ đã qua", value: data.completedCredits, icon: CheckCircle2 },
    { label: "Môn đã trượt", value: data.failedCount, icon: AlertTriangle },
    { label: "Pass rate cá nhân", value: `${data.passRate}%`, icon: BookOpen },
    { label: "Risk level", value: data.riskLevel, icon: TrendingDown },
  ]
  const selectedStudentLabel = `${data.student.student_code} - ${data.student.full_name}`
  const selectedProgramLabel = data.program ? `${data.program.code} - ${data.program.name}` : "Chưa rõ ngành"

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard cá nhân sinh viên</h1>
          <p className="text-sm text-muted-foreground">Sinh viên này đang học ra sao, yếu ở môn nào và có nguy cơ học vụ không?</p>
        </div>
        <Select value={studentId} onValueChange={(value) => setStudentId(value ?? "")}>
          <SelectTrigger className="w-full lg:w-[360px]"><span className="truncate">{selectedStudentLabel}</span></SelectTrigger>
          <SelectContent>
            {raw.students.map((student) => (
              <SelectItem key={student.id} value={String(student.id)}>
                {student.student_code} - {student.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" aria-label="Từ ngày" />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" aria-label="Đến ngày" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">Sinh viên: {selectedStudentLabel}</Badge>
        <Badge variant="outline">Ngành: {selectedProgramLabel}</Badge>
        <Badge variant="outline">Thời gian: {dateFrom || "đầu dữ liệu"} → {dateTo || "hiện tại"}</Badge>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-4">
          <UserRound className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">{data.student.full_name} · {data.student.student_code}</p>
            <p className="text-xs text-muted-foreground">{data.program?.name ?? "Chưa rõ ngành"} · Lớp {data.student.class_code ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">GPA/điểm trung bình theo học kỳ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.gpaTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip formatter={(value) => [value, "Điểm TB"]} />
                <Line dataKey="avgGrade" stroke="#4f46e5" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Điểm các môn đã học</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.courseGrades.slice(-12)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip formatter={(value, _name, item) => [value, item.payload.fullName]} />
                <Bar dataKey="grade" radius={[4, 4, 0, 0]}>
                  {data.courseGrades.slice(-12).map((row, index) => (
                    <Cell key={`${row.name}-${index}`} fill={row.grade < 5 ? "#ef4444" : row.grade < 6.5 ? "#f59e0b" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Năng lực theo nhóm môn</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.groupData} layout="vertical" margin={{ left: 24, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, "Điểm TB"]} />
                <Bar dataKey="avgGrade" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Credit progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Tín chỉ đã hoàn thành</span>
                <span className="font-medium">{data.completedCredits}/130</span>
              </div>
              <div className="h-2 rounded bg-muted">
                <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.min(100, data.completedCredits / 130 * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3"><p className="text-muted-foreground">Còn thiếu</p><p className="text-xl font-bold">{Math.max(0, 130 - data.completedCredits)}</p></div>
              <div className="rounded-md border p-3"><p className="text-muted-foreground">TC trượt cần học lại</p><p className="text-xl font-bold text-red-600">{data.failedCredits}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Risk Explanation</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">{["Yếu tố", "Trạng thái", "Giải thích"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y">
              {data.riskRows.map((row) => (
                <tr key={row.factor}>
                  <td className="px-4 py-3 font-medium">{row.factor}</td>
                  <td className="px-4 py-3"><Badge variant={row.bad ? "destructive" : "secondary"}>{row.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Student Transcript Table</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-xs">
            <thead><tr className="border-b bg-muted/40 text-left text-muted-foreground">{["Học kỳ", "Mã môn", "Tên môn", "Tín chỉ", "Điểm", "Kết quả", "Lần học", "Ghi chú"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y">
              {data.rows.map((row) => (
                <tr key={row.enrollment.id}>
                  <td className="px-4 py-3">{row.semester?.code ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{row.course?.code ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{row.course?.name ?? "Chưa rõ môn"}</td>
                  <td className="px-4 py-3">{row.course?.credits ?? 0}</td>
                  <td className="px-4 py-3">{row.enrollment.final_grade?.toFixed(1) ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant={row.enrollment.is_passed === false ? "destructive" : "secondary"}>{resultLabel(row.enrollment.final_grade)}</Badge></td>
                  <td className="px-4 py-3">{row.enrollment.attempt_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.enrollment.is_passed === false ? "Cần học lại / cố vấn theo dõi" : "Theo dõi bình thường"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
