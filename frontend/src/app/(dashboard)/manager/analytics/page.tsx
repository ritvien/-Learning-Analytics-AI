"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, GraduationCap, TrendingUp, Users } from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, type ApiCourse, type ApiDepartment, type ApiEnrollment, type ApiProgram, type ApiSection, type ApiSemester, type ApiStudent } from "@/lib/api"

type Raw = {
  students: ApiStudent[]
  enrollments: ApiEnrollment[]
  courses: ApiCourse[]
  sections: ApiSection[]
  semesters: ApiSemester[]
  programs: ApiProgram[]
  departments: ApiDepartment[]
}

function rateColor(rate: number) {
  if (rate > 75) return "#22c55e"
  if (rate >= 60) return "#f59e0b"
  return "#ef4444"
}

function heatColor(value: number | null) {
  if (value === null) return "bg-muted text-muted-foreground"
  if (value > 75) return "bg-emerald-500 text-white"
  if (value >= 60) return "bg-amber-400 text-amber-950"
  return "bg-red-500 text-white"
}

export default function SchoolOverviewPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [semester, setSemester] = React.useState("current")
  const [department, setDepartment] = React.useState("all")

  React.useEffect(() => {
    Promise.all([
      api.getStudents({ limit: 1000 }),
      api.getEnrollments({ limit: 50000 }),
      api.getCourses({ limit: 500 }),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
      api.getPrograms({ limit: 100 }),
      api.getDepartments({ limit: 100 }),
    ]).then(([students, enrollments, courses, sections, semesters, programs, departments]) => {
      setRaw({ students, enrollments, courses, sections, semesters, programs, departments })
    }).catch(console.error)
  }, [])

  const data = React.useMemo(() => {
    if (!raw) return null
    const secMap = new Map(raw.sections.map(item => [item.id, item]))
    const courseMap = new Map(raw.courses.map(item => [item.id, item]))
    const departmentMap = new Map(raw.departments.map(item => [item.id, item]))
    const studentMap = new Map(raw.students.map(item => [item.id, item]))
    const sortedSemesters = [...raw.semesters].sort((a, b) => a.year - b.year || a.term - b.term)
    const current = raw.semesters.find(item => item.is_current) ?? sortedSemesters.at(-1)
    const focusSemesterId = semester === "all"
      ? null
      : semester === "current"
        ? current?.id ?? null
        : raw.semesters.find(item => item.code === semester)?.id ?? null

    const scopedPrograms = raw.programs.filter(item => department === "all" || item.department_id === Number(department))
    const scopedProgramIds = new Set(scopedPrograms.map(item => item.id))
    const activeStudents = raw.students.filter(item => item.status === "active" && scopedProgramIds.has(item.program_id))
    const activeIds = new Set(activeStudents.map(item => item.id))
    const scopedEnrollments = raw.enrollments.filter(item => {
      if (!activeIds.has(item.student_id) || item.is_passed === null) return false
      const section = secMap.get(item.section_id)
      return focusSemesterId === null || section?.semester_id === focusSemesterId
    })
    const passed = scopedEnrollments.filter(item => item.is_passed).length
    const withGpa = activeStudents.filter(item => item.gpa_cumulative !== null)
    const avgGpa = withGpa.length ? withGpa.reduce((sum, item) => sum + item.gpa_cumulative!, 0) / withGpa.length : 0
    const atRisk = activeStudents.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative < 2).length

    const trend = sortedSemesters.map(sem => {
      const rows = raw.enrollments.filter(item => {
        const student = studentMap.get(item.student_id)
        return item.is_passed !== null
          && student?.status === "active"
          && scopedProgramIds.has(student.program_id)
          && secMap.get(item.section_id)?.semester_id === sem.id
      })
      return {
        semester: sem.code,
        passRate: rows.length ? +(rows.filter(item => item.is_passed).length / rows.length * 100).toFixed(1) : 0,
        count: rows.length,
      }
    }).filter(item => item.count > 0)

    const programStats = scopedPrograms.map(program => {
      const students = activeStudents.filter(item => item.program_id === program.id)
      const studentIds = new Set(students.map(item => item.id))
      const enrollments = scopedEnrollments.filter(item => studentIds.has(item.student_id))
      const grades = enrollments.filter(item => item.final_grade !== null).map(item => item.final_grade!)
      const failed = enrollments.filter(item => !item.is_passed)
      const risk = students.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative < 2).length
      const sectionIds = new Set(enrollments.map(item => item.section_id))
      const courseFail = new Map<number, { total: number; failed: number }>()
      for (const item of enrollments) {
        const courseId = secMap.get(item.section_id)?.course_id
        if (!courseId) continue
        const stat = courseFail.get(courseId) ?? { total: 0, failed: 0 }
        stat.total++
        if (!item.is_passed) stat.failed++
        courseFail.set(courseId, stat)
      }
      const bottleneck = [...courseFail.entries()]
        .filter(([, stat]) => stat.total >= 3)
        .sort((a, b) => b[1].failed / b[1].total - a[1].failed / a[1].total)[0]
      const passRate = enrollments.length ? enrollments.filter(item => item.is_passed).length / enrollments.length * 100 : 0
      const gpaRows = students.filter(item => item.gpa_cumulative !== null)
      return {
        id: program.id,
        name: program.name,
        code: program.code,
        department: departmentMap.get(program.department_id)?.name ?? "Chưa gắn khoa",
        students: students.length,
        sections: sectionIds.size,
        passRate: +passRate.toFixed(1),
        avgGpa: gpaRows.length ? +(gpaRows.reduce((sum, item) => sum + item.gpa_cumulative!, 0) / gpaRows.length).toFixed(2) : 0,
        avgGrade: grades.length ? +(grades.reduce((sum, value) => sum + value, 0) / grades.length).toFixed(2) : 0,
        atRisk: risk,
        riskRate: students.length ? +(risk / students.length * 100).toFixed(1) : 0,
        failed: failed.length,
        bottleneck: bottleneck ? courseMap.get(bottleneck[0])?.name ?? "Không xác định" : "Chưa đủ dữ liệu",
      }
    }).filter(item => item.students > 0).sort((a, b) => b.atRisk - a.atRisk || a.passRate - b.passRate || a.avgGpa - b.avgGpa)

    const heatSemesters = sortedSemesters.slice(-6)
    const heatmap = programStats.map(program => ({
      id: program.id,
      name: program.name,
      cells: heatSemesters.map(sem => {
        const studentIds = new Set(raw.students.filter(item => item.program_id === program.id).map(item => item.id))
        const rows = raw.enrollments.filter(item =>
          item.is_passed !== null
          && studentIds.has(item.student_id)
          && secMap.get(item.section_id)?.semester_id === sem.id
        )
        return rows.length ? +(rows.filter(item => item.is_passed).length / rows.length * 100).toFixed(0) : null
      }),
    }))

    return {
      current,
      sortedSemesters,
      activeStudents: activeStudents.length,
      programCount: scopedPrograms.length,
      passRate: scopedEnrollments.length ? +(passed / scopedEnrollments.length * 100).toFixed(1) : 0,
      avgGpa: +avgGpa.toFixed(2),
      atRisk,
      trend,
      programStats,
      heatSemesters,
      heatmap,
    }
  }, [raw, semester, department])

  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Đang tải bức tranh toàn trường...</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
          <p className="text-sm text-muted-foreground">Trường đang vận hành thế nào, ngành nào nổi bật và ngành nào cần mở ra xem sâu?</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Khoa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả khoa</SelectItem>
              {raw?.departments.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Học kỳ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Học kỳ hiện tại</SelectItem>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {data.sortedSemesters.map(item => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "SV đang học", value: data.activeStudents, icon: Users, color: "text-blue-500" },
          { label: "Ngành đào tạo", value: data.programCount, icon: GraduationCap, color: "text-violet-500" },
          { label: "Pass rate toàn trường", value: `${data.passRate}%`, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "GPA tích lũy TB", value: data.avgGpa.toFixed(2), icon: TrendingUp, color: "text-primary" },
          { label: "SV nguy cơ (GPA < 2)", value: data.atRisk, icon: AlertTriangle, color: "text-red-500" },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between pt-5">
              <div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p></div>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Xu hướng pass rate toàn trường theo học kỳ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => [`${value}%`, "Pass rate"]} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" label="Mục tiêu 70%" />
                <Line type="monotone" dataKey="passRate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top ngành nguy hiểm theo pass rate</CardTitle><p className="text-xs text-muted-foreground">Chỉ hiển thị tối đa 5 ngành có pass rate thấp nhất.</p></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[...data.programStats].sort((a, b) => a.passRate - b.passRate).slice(0, 5)} layout="vertical" margin={{ left: 12, right: 36 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => [`${value}%`, "Pass rate"]} />
                <ReferenceLine x={70} stroke="#ef4444" strokeDasharray="4 3" />
                <Bar dataKey="passRate" radius={[0, 4, 4, 0]}>
                  {[...data.programStats].sort((a, b) => a.passRate - b.passRate).slice(0, 5).map(item => <Cell key={item.id} fill={rateColor(item.passRate)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Heatmap ngành × học kỳ</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr><th className="pb-2 text-left text-muted-foreground">Ngành</th>{data.heatSemesters.map(item => <th key={item.id} className="pb-2 text-center text-muted-foreground">{item.code}</th>)}</tr></thead>
            <tbody className="divide-y">
              {data.heatmap.map(row => (
                <tr key={row.id}>
                  <td className="max-w-56 py-2 pr-3 font-medium">{row.name}</td>
                  {row.cells.map((value, index) => <td key={index} className="px-1 py-2 text-center"><span className={`inline-flex min-w-12 justify-center rounded px-2 py-1 font-medium ${heatColor(value)}`}>{value === null ? "—" : `${value}%`}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Program Overview Table</CardTitle>
          <p className="text-xs text-muted-foreground">Mặc định ưu tiên ngành có nhiều sinh viên nguy cơ, pass rate thấp và GPA thấp.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-xs">
            <thead><tr className="border-b bg-muted/40">
              {["Ngành", "Khoa quản lý", "SV active", "Lớp HP", "Pass rate", "GPA TB", "SV nguy cơ", "Môn trượt cao nhất", "Action"].map(item => <th key={item} className="px-4 py-3 text-left font-medium text-muted-foreground">{item}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {data.programStats.map(item => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{item.name}<span className="ml-1 text-muted-foreground">({item.code})</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{item.department}</td>
                  <td className="px-4 py-3 tabular-nums">{item.students}</td>
                  <td className="px-4 py-3 tabular-nums">{item.sections}</td>
                  <td className="px-4 py-3"><Badge style={{ backgroundColor: `${rateColor(item.passRate)}20`, color: rateColor(item.passRate) }}>{item.passRate}%</Badge></td>
                  <td className="px-4 py-3 tabular-nums">{item.avgGpa.toFixed(2)}</td>
                  <td className="px-4 py-3 font-medium text-red-500">{item.atRisk} ({item.riskRate}%)</td>
                  <td className="max-w-52 truncate px-4 py-3 text-muted-foreground" title={item.bottleneck}>{item.bottleneck}</td>
                  <td className="px-4 py-3"><Link className="font-medium text-primary hover:underline" href={`/manager/analytics/programs?program=${item.id}`}>Xem ngành</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
