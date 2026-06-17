"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, BookOpen, CheckCircle2, GraduationCap, TrendingUp, Users } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  api,
  type ApiCourse,
  type ApiDepartment,
  type ApiEnrollment,
  type ApiProgram,
  type ApiSection,
  type ApiSemester,
  type ApiStudent,
} from "@/lib/api"

type Raw = {
  students: ApiStudent[]
  enrollments: ApiEnrollment[]
  courses: ApiCourse[]
  sections: ApiSection[]
  semesters: ApiSemester[]
  departments: ApiDepartment[]
  programs: ApiProgram[]
}

function pct(part: number, total: number) {
  return total ? +(part / total * 100).toFixed(1) : 0
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function heatColor(value: number | null) {
  if (value === null) return "bg-muted text-muted-foreground"
  if (value >= 75) return "bg-emerald-500 text-white"
  if (value >= 60) return "bg-amber-400 text-amber-950"
  return "bg-red-500 text-white"
}

export default function OverviewPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [semesterCode, setSemesterCode] = React.useState("all")
  const [departmentId, setDepartmentId] = React.useState("all")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    Promise.all([
      api.getStudents({ limit: 50000 }),
      api.getEnrollments({ limit: 50000 }),
      api.getCourses({ limit: 5000 }),
      api.getSections({ limit: 50000 }),
      api.getSemesters(),
      api.getDepartments({ limit: 1000 }),
      api.getPrograms({ limit: 1000 }),
    ])
      .then(([students, enrollments, courses, sections, semesters, departments, programs]) => {
        setRaw({ students, enrollments, courses, sections, semesters, departments, programs })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const data = React.useMemo(() => {
    if (!raw) return null
    const { students, enrollments, sections, semesters, departments, programs, courses } = raw
    const secMap = new Map(sections.map((section) => [section.id, section]))
    const semMap = new Map(semesters.map((semester) => [semester.id, semester]))
    const courseMap = new Map(courses.map((course) => [course.id, course]))
    const deptMap = new Map(departments.map((department) => [department.id, department]))
    const selectedSemesterId = semesterCode === "all" ? null : semesters.find((semester) => semester.code === semesterCode)?.id ?? null
    const selectedDepartmentId = departmentId === "all" ? null : Number(departmentId)
    const scopedPrograms = programs.filter((program) => selectedDepartmentId === null || program.department_id === selectedDepartmentId)
    const scopedProgramIds = new Set(scopedPrograms.map((program) => program.id))
    const activeStudents = students.filter((student) => student.status === "active" && scopedProgramIds.has(student.program_id))
    const activeStudentIds = new Set(activeStudents.map((student) => student.id))
    const filteredEnrollments = enrollments.filter((enrollment) => {
      if (!activeStudentIds.has(enrollment.student_id)) return false
      const section = secMap.get(enrollment.section_id)
      return selectedSemesterId === null || section?.semester_id === selectedSemesterId
    })
    const validEnrollments = filteredEnrollments.filter((enrollment) => enrollment.is_passed !== null)
    const gradedEnrollments = filteredEnrollments.filter((enrollment) => enrollment.final_grade !== null)
    const avgGpa = avg(activeStudents.flatMap((student) => student.gpa_cumulative === null ? [] : [student.gpa_cumulative]))
    const atRiskStudents = activeStudents.filter((student) => student.gpa_cumulative !== null && student.gpa_cumulative < 2)
    const sortedSemesters = [...semesters].sort((a, b) => a.year - b.year || a.term - b.term)

    const trend = sortedSemesters.map((semester) => {
      const semEnrollments = enrollments.filter((enrollment) => {
        if (!activeStudentIds.has(enrollment.student_id)) return false
        return secMap.get(enrollment.section_id)?.semester_id === semester.id
      })
      const valid = semEnrollments.filter((enrollment) => enrollment.is_passed !== null)
      const grades = semEnrollments.flatMap((enrollment) => enrollment.final_grade === null ? [] : [enrollment.final_grade])
      return {
        semester: semester.code,
        passRate: pct(valid.filter((enrollment) => enrollment.is_passed).length, valid.length),
        avgGrade: +avg(grades).toFixed(2),
        count: valid.length,
      }
    }).filter((item) => item.count > 0)

    const programRows = scopedPrograms.map((program) => {
      const programStudents = activeStudents.filter((student) => student.program_id === program.id)
      const programStudentIds = new Set(programStudents.map((student) => student.id))
      const programEnrollments = filteredEnrollments.filter((enrollment) => programStudentIds.has(enrollment.student_id))
      const valid = programEnrollments.filter((enrollment) => enrollment.is_passed !== null)
      const grades = programEnrollments.flatMap((enrollment) => enrollment.final_grade === null ? [] : [enrollment.final_grade])
      const sectionIds = new Set(programEnrollments.map((enrollment) => enrollment.section_id))
      const failedByCourse = new Map<number, number>()
      for (const enrollment of programEnrollments) {
        if (enrollment.is_passed !== false) continue
        const courseId = secMap.get(enrollment.section_id)?.course_id
        if (courseId) failedByCourse.set(courseId, (failedByCourse.get(courseId) ?? 0) + 1)
      }
      const worstCourseEntry = [...failedByCourse.entries()].sort((a, b) => b[1] - a[1])[0]
      const passRate = pct(valid.filter((enrollment) => enrollment.is_passed).length, valid.length)
      return {
        id: program.id,
        code: program.code,
        name: program.name,
        department: deptMap.get(program.department_id)?.name ?? "Chưa rõ khoa",
        activeStudents: programStudents.length,
        sections: sectionIds.size,
        passRate,
        avgGrade: +avg(grades).toFixed(2),
        avgGpa: +avg(programStudents.flatMap((student) => student.gpa_cumulative === null ? [] : [student.gpa_cumulative])).toFixed(2),
        atRisk: programStudents.filter((student) => student.gpa_cumulative !== null && student.gpa_cumulative < 2).length,
        worstCourse: worstCourseEntry ? courseMap.get(worstCourseEntry[0])?.name ?? "Chưa rõ môn" : "Chưa có dữ liệu",
      }
    }).sort((a, b) => b.atRisk - a.atRisk || a.passRate - b.passRate || a.avgGpa - b.avgGpa)

    const heatSemesters = sortedSemesters.slice(-6)
    const heatmap = programRows.slice(0, 10).map((program) => {
      const programStudentIds = new Set(students.filter((student) => student.program_id === program.id).map((student) => student.id))
      return {
        id: program.id,
        name: program.name,
        cells: heatSemesters.map((semester) => {
          const rows = enrollments.filter((enrollment) => (
            programStudentIds.has(enrollment.student_id)
            && enrollment.is_passed !== null
            && secMap.get(enrollment.section_id)?.semester_id === semester.id
          ))
          return rows.length ? Math.round(pct(rows.filter((enrollment) => enrollment.is_passed).length, rows.length)) : null
        }),
      }
    })

    return {
      departments,
      sortedSemesters,
      heatSemesters,
      totalActiveStudents: activeStudents.length,
      programCount: scopedPrograms.length,
      passRate: pct(validEnrollments.filter((enrollment) => enrollment.is_passed).length, validEnrollments.length),
      avgGpa,
      avgGrade: avg(gradedEnrollments.map((enrollment) => enrollment.final_grade!)),
      atRiskCount: atRiskStudents.length,
      trend,
      programRows,
      heatmap,
    }
  }, [raw, semesterCode, departmentId])

  if (loading) {
    return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Đang tải tổng quan toàn trường...</div>
  }

  if (!raw || !data) {
    return <div className="text-sm text-muted-foreground">Chưa có dữ liệu phân tích.</div>
  }

  const kpis = [
    { label: "SV đang học", value: data.totalActiveStudents, icon: Users, color: "text-blue-500" },
    { label: "Ngành đào tạo", value: data.programCount, icon: GraduationCap, color: "text-indigo-500" },
    { label: "Pass rate", value: `${data.passRate}%`, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "GPA trung bình", value: data.avgGpa.toFixed(2), icon: TrendingUp, color: "text-primary" },
    { label: "SV nguy cơ", value: data.atRiskCount, icon: AlertTriangle, color: "text-red-500" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
          <p className="text-sm text-muted-foreground">Trường đang vận hành ra sao, ngành nào nổi bật, ngành nào cần mở ra xem sâu hơn?</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={semesterCode} onValueChange={(value) => setSemesterCode(value ?? "all")}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Học kỳ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {data.sortedSemesters.map((semester) => (
                <SelectItem key={semester.id} value={semester.code}>{semester.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentId} onValueChange={(value) => setDepartmentId(value ?? "all")}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Khoa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toàn trường</SelectItem>
              {data.departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Xu hướng pass rate toàn trường</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => [`${value}%`, "Pass rate"]} />
                <Line dataKey="passRate" stroke="#16a34a" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Xu hướng điểm trung bình theo học kỳ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip formatter={(value) => [value, "Điểm TB"]} />
                <Line dataKey="avgGrade" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pass rate theo ngành</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(260, data.programRows.length * 34)}>
            <BarChart data={[...data.programRows].sort((a, b) => a.passRate - b.passRate)} layout="vertical" margin={{ left: 24, right: 36 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Pass rate"]} />
              <Bar dataKey="passRate" radius={[0, 4, 4, 0]}>
                {data.programRows.map((row) => (
                  <Cell key={row.id} fill={row.passRate >= 75 ? "#22c55e" : row.passRate >= 60 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Heatmap ngành × học kỳ</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr>
                <th className="pb-2 text-left text-muted-foreground">Ngành</th>
                {data.heatSemesters.map((semester) => <th key={semester.id} className="pb-2 text-center text-muted-foreground">{semester.code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.heatmap.map((row) => (
                <tr key={row.id}>
                  <td className="max-w-[260px] truncate py-2 font-medium">{row.name}</td>
                  {row.cells.map((value, index) => (
                    <td key={index} className="px-1 py-2 text-center">
                      <span className={`inline-flex min-w-12 justify-center rounded px-2 py-1 font-medium ${heatColor(value)}`}>
                        {value === null ? "—" : `${value}%`}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Program Overview Table</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                {["Ngành", "Khoa quản lý", "SV active", "Section", "Pass rate", "GPA TB", "SV nguy cơ", "Môn kéo xuống", "Action"].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.programRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{row.code}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                  <td className="px-4 py-3">{row.activeStudents}</td>
                  <td className="px-4 py-3">{row.sections}</td>
                  <td className="px-4 py-3"><Badge variant={row.passRate < 60 ? "destructive" : "secondary"}>{row.passRate}%</Badge></td>
                  <td className="px-4 py-3">{row.avgGpa.toFixed(2)}</td>
                  <td className="px-4 py-3 text-red-600">{row.atRisk}</td>
                  <td className="max-w-[220px] truncate px-4 py-3">{row.worstCourse}</td>
                  <td className="px-4 py-3">
                    <Link className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={`/manager/analytics/programs?program=${row.id}`}>
                      <BookOpen className="h-3 w-3" />
                      Xem ngành
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
