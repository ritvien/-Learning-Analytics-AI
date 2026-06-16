"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, BookOpen, CheckCircle2, GraduationCap, TrendingUp, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, type ApiCourse, type ApiEnrollment, type ApiProgram, type ApiSection, type ApiSemester, type ApiStudent } from "@/lib/api"

type Raw = { students: ApiStudent[]; enrollments: ApiEnrollment[]; courses: ApiCourse[]; sections: ApiSection[]; semesters: ApiSemester[]; programs: ApiProgram[] }
function groupName(course: ApiCourse) { return course.is_elective ? "Tự chọn" : course.credits <= 2 ? "Đại cương" : "Cơ sở / chuyên ngành" }
function heatColor(value: number | null) {
  if (value === null) return "bg-muted text-muted-foreground"
  if (value > 75) return "bg-emerald-500 text-white"
  if (value >= 60) return "bg-amber-400 text-amber-950"
  return "bg-red-500 text-white"
}

export default function ProgramAnalyticsPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [programId, setProgramId] = React.useState("")
  const [semester, setSemester] = React.useState("all")
  const [cohort, setCohort] = React.useState("all")

  React.useEffect(() => {
    Promise.all([api.getStudents({ limit: 1000 }), api.getEnrollments({ limit: 50000 }), api.getCourses({ limit: 500 }), api.getSections({ limit: 5000 }), api.getSemesters(), api.getPrograms({ limit: 100 })])
      .then(([students, enrollments, courses, sections, semesters, programs]) => {
        setRaw({ students, enrollments, courses, sections, semesters, programs })
        const queryProgram = new URLSearchParams(window.location.search).get("program")
        setProgramId(queryProgram && programs.some(item => String(item.id) === queryProgram) ? queryProgram : String(programs[0]?.id ?? ""))
      }).catch(console.error)
  }, [])

  const data = React.useMemo(() => {
    if (!raw || !programId) return null
    const program = raw.programs.find(item => item.id === Number(programId))
    if (!program) return null
    const secMap = new Map(raw.sections.map(item => [item.id, item]))
    const courseMap = new Map(raw.courses.map(item => [item.id, item]))
    const sortedSemesters = [...raw.semesters].sort((a, b) => a.year - b.year || a.term - b.term)
    const focusSemesterId = semester === "all" ? null : raw.semesters.find(item => item.code === semester)?.id ?? null
    const students = raw.students.filter(item => item.program_id === program.id && item.status === "active" && (cohort === "all" || item.cohort_id === Number(cohort)))
    const studentIds = new Set(students.map(item => item.id))
    const enrollments = raw.enrollments.filter(item => studentIds.has(item.student_id) && item.is_passed !== null && (focusSemesterId === null || secMap.get(item.section_id)?.semester_id === focusSemesterId))
    const gpaRows = students.filter(item => item.gpa_cumulative !== null)

    const trend = sortedSemesters.map(sem => {
      const rows = raw.enrollments.filter(item => studentIds.has(item.student_id) && item.is_passed !== null && secMap.get(item.section_id)?.semester_id === sem.id)
      const grades = rows.filter(item => item.final_grade !== null).map(item => item.final_grade!)
      return { semester: sem.code, passRate: rows.length ? +(rows.filter(item => item.is_passed).length / rows.length * 100).toFixed(1) : 0, avgGrade: grades.length ? +(grades.reduce((sum, value) => sum + value, 0) / grades.length).toFixed(2) : 0, count: rows.length }
    }).filter(item => item.count > 0)

    const statsMap = new Map<number, { total: number; passed: number; failed: number; nearFail: number; grades: number[] }>()
    for (const item of enrollments) {
      const courseId = secMap.get(item.section_id)?.course_id
      if (!courseId) continue
      const stat = statsMap.get(courseId) ?? { total: 0, passed: 0, failed: 0, nearFail: 0, grades: [] }
      stat.total++
      if (item.is_passed) stat.passed++
      else stat.failed++
      if (item.final_grade !== null) { stat.grades.push(item.final_grade); if (item.final_grade >= 4 && item.final_grade < 5) stat.nearFail++ }
      statsMap.set(courseId, stat)
    }
    const courseStats = [...statsMap.entries()].map(([id, stat]) => {
      const course = courseMap.get(id)
      return { id, code: course?.code ?? `MH-${id}`, name: course?.name ?? "Không xác định", group: course ? groupName(course) : "Chưa phân nhóm", total: stat.total, passRate: stat.total ? +(stat.passed / stat.total * 100).toFixed(1) : 0, avgGrade: stat.grades.length ? +(stat.grades.reduce((sum, value) => sum + value, 0) / stat.grades.length).toFixed(2) : 0, failed: stat.failed, nearFail: stat.nearFail }
    }).sort((a, b) => a.passRate - b.passRate || b.failed - a.failed)

    const groupMap = new Map<string, { total: number; passed: number }>()
    for (const item of courseStats) { const stat = groupMap.get(item.group) ?? { total: 0, passed: 0 }; stat.total += item.total; stat.passed += Math.round(item.total * item.passRate / 100); groupMap.set(item.group, stat) }
    const groups = [...groupMap.entries()].map(([name, stat]) => ({ name, passRate: stat.total ? +(stat.passed / stat.total * 100).toFixed(1) : 0 })).sort((a, b) => a.passRate - b.passRate)
    const distribution = [
      { name: "Nguy cơ < 2.0", value: students.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative < 2).length, color: "#ef4444" },
      { name: "Trung bình", value: students.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 2 && item.gpa_cumulative < 2.5).length, color: "#f59e0b" },
      { name: "Khá", value: students.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 2.5 && item.gpa_cumulative < 3.2).length, color: "#3b82f6" },
      { name: "Giỏi", value: students.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 3.2 && item.gpa_cumulative < 3.6).length, color: "#8b5cf6" },
      { name: "Xuất sắc", value: students.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 3.6).length, color: "#22c55e" },
    ]
    const cohorts = [...new Set(raw.students.filter(item => item.program_id === program.id).map(item => item.cohort_id))].sort((a, b) => a - b)
    const heatSemesters = sortedSemesters.slice(-6)
    const cohortHeatmap = cohorts.map(id => {
      const ids = new Set(raw.students.filter(item => item.program_id === program.id && item.cohort_id === id).map(item => item.id))
      return { id, cells: heatSemesters.map(sem => { const rows = raw.enrollments.filter(item => ids.has(item.student_id) && item.is_passed !== null && secMap.get(item.section_id)?.semester_id === sem.id); return rows.length ? +(rows.filter(item => item.is_passed).length / rows.length * 100).toFixed(0) : null }) }
    })
    return { program, students: students.length, passRate: enrollments.length ? +(enrollments.filter(item => item.is_passed).length / enrollments.length * 100).toFixed(1) : 0, avgGpa: gpaRows.length ? +(gpaRows.reduce((sum, item) => sum + item.gpa_cumulative!, 0) / gpaRows.length).toFixed(2) : 0, atRisk: distribution[0].value, bottlenecks: courseStats.filter(item => item.passRate < 70).length, trend, courseStats, groups, distribution, cohorts, heatSemesters, cohortHeatmap, sortedSemesters }
  }, [raw, programId, semester, cohort])

  if (!raw || !data) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Đang tải dashboard ngành...</div>

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Ngành đào tạo</h1><p className="text-sm text-muted-foreground">Đi sâu vào một ngành: giai đoạn nào yếu, khóa nào có rủi ro và môn nào đang là nút thắt.</p></div>
      <div className="flex flex-wrap gap-2">
        <Select value={programId} onValueChange={value => { if (value) setProgramId(value); setCohort("all") }}><SelectTrigger className="w-72"><SelectValue placeholder="Chọn ngành bắt buộc" /></SelectTrigger><SelectContent>{raw.programs.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Select value={semester} onValueChange={value => setSemester(value ?? "all")}><SelectTrigger className="w-52"><SelectValue placeholder="Học kỳ" /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả học kỳ</SelectItem>{data.sortedSemesters.map(item => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Select value={cohort} onValueChange={value => setCohort(value ?? "all")}><SelectTrigger className="w-44"><SelectValue placeholder="Khóa sinh viên" /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả khóa</SelectItem>{data.cohorts.map(id => <SelectItem key={id} value={String(id)}>Khóa #{id}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card className="border-primary/20 bg-primary/5"><CardContent className="flex items-center gap-3 py-4"><GraduationCap className="h-5 w-5 text-primary" /><div><p className="font-semibold">{data.program.name}</p><p className="text-xs text-muted-foreground">{data.program.code} · Mọi metric bên dưới chỉ tính trên sinh viên của ngành đang chọn.</p></div></CardContent></Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{[
        ["SV của ngành", data.students, Users, "text-blue-500"], ["GPA TB ngành", data.avgGpa.toFixed(2), TrendingUp, "text-primary"], ["Pass rate ngành", `${data.passRate}%`, CheckCircle2, "text-emerald-500"], ["SV nguy cơ", data.atRisk, AlertTriangle, "text-red-500"], ["Môn bottleneck", data.bottlenecks, BookOpen, "text-amber-500"],
      ].map(([label, value, Icon, color]) => <Card key={String(label)}><CardContent className="flex items-start justify-between pt-5"><div><p className="text-xs text-muted-foreground">{String(label)}</p><p className="mt-1 text-2xl font-bold">{String(value)}</p></div>{React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: `h-5 w-5 ${color}` })}</CardContent></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Pass rate của ngành qua học kỳ</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="semester" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} /><Tooltip formatter={(value: number) => [`${value}%`, "Pass rate"]} /><Line dataKey="passRate" stroke="#16a34a" strokeWidth={2.5} /></LineChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Điểm trung bình của ngành qua học kỳ</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="semester" tick={{ fontSize: 10 }} /><YAxis domain={[0, 10]} /><Tooltip formatter={(value: number) => [value, "Điểm TB"]} /><Line dataKey="avgGrade" stroke="#6366f1" strokeWidth={2.5} /></LineChart></ResponsiveContainer></CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Pass rate theo nhóm môn</CardTitle><p className="text-xs text-muted-foreground">Nhóm môn hiện được suy luận tạm từ môn tự chọn và số tín chỉ.</p></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><BarChart data={data.groups} layout="vertical" margin={{ left: 20, right: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} tickFormatter={value => `${value}%`} /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} /><Tooltip formatter={(value: number) => [`${value}%`, "Pass rate"]} /><Bar dataKey="passRate" radius={[0, 4, 4, 0]}>{data.groups.map(item => <Cell key={item.name} fill={item.passRate >= 75 ? "#22c55e" : item.passRate >= 60 ? "#f59e0b" : "#ef4444"} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Phân bố học lực sinh viên trong ngành</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={data.distribution} dataKey="value" nameKey="name" cx="50%" cy="43%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`} labelLine>{data.distribution.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number, name: string) => [`${value} sinh viên`, name]} /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-sm">Heatmap khóa sinh viên × học kỳ</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-xs"><thead><tr><th className="pb-2 text-left text-muted-foreground">Khóa</th>{data.heatSemesters.map(item => <th key={item.id} className="pb-2 text-center text-muted-foreground">{item.code}</th>)}</tr></thead><tbody className="divide-y">{data.cohortHeatmap.map(row => <tr key={row.id}><td className="py-2 font-medium">Khóa #{row.id}</td>{row.cells.map((value, index) => <td key={index} className="px-1 py-2 text-center"><span className={`inline-flex min-w-12 justify-center rounded px-2 py-1 font-medium ${heatColor(value)}`}>{value === null ? "—" : `${value}%`}</span></td>)}</tr>)}</tbody></table></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Course Performance in Program</CardTitle><p className="text-xs text-muted-foreground">Môn nào đang kéo ngành xuống và nhóm sinh viên nào có thể can thiệp sớm?</p></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[1050px] text-xs"><thead><tr className="border-b bg-muted/40">{["Mã môn", "Tên môn", "Nhóm môn", "Lượt học", "Pass rate", "Điểm TB", "SV trượt", "SV cận trượt", "Action"].map(item => <th key={item} className="px-4 py-3 text-left font-medium text-muted-foreground">{item}</th>)}</tr></thead><tbody className="divide-y">{data.courseStats.map(item => <tr key={item.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-mono">{item.code}</td><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3 text-muted-foreground">{item.group}</td><td className="px-4 py-3">{item.total}</td><td className="px-4 py-3"><Badge variant={item.passRate < 60 ? "destructive" : "secondary"}>{item.passRate}%</Badge></td><td className="px-4 py-3">{item.avgGrade.toFixed(2)}</td><td className="px-4 py-3 text-red-500">{item.failed}</td><td className="px-4 py-3 text-amber-600">{item.nearFail}</td><td className="px-4 py-3"><Link href={`/manager/analytics/courses?course=${item.id}`} className="font-medium text-primary hover:underline">Xem môn</Link></td></tr>)}</tbody></table></CardContent></Card>
    </div>
  )
}
