"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterCombobox } from "@/components/ui/filter-combobox"
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
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

// GPA 4-point scale thresholds (Vietnamese university standard)
const GPA_LEVELS = [
  { label: "Giỏi",       min: 3.6, max: 4.0,  color: "#22c55e" },
  { label: "Khá",        min: 3.2, max: 3.6,  color: "#3b82f6" },
  { label: "Trung bình", min: 2.0, max: 3.2,  color: "#f59e0b" },
  { label: "Yếu",        min: 0,   max: 2.0,  color: "#ef4444" },
]

function gpaLevel(gpa: number) {
  return GPA_LEVELS.find((l) => gpa >= l.min && gpa < l.max) ?? GPA_LEVELS[3]
}

function passRateColor(rate: number) {
  if (rate >= 75) return "#22c55e"
  if (rate >= 60) return "#f59e0b"
  return "#ef4444"
}

const RADIAN = Math.PI / 180
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
}) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── problem program rows detected by threshold ───
function isProblem(row: { passRate: number; atRisk: number; avgGpa: number }) {
  return row.passRate < 65 || row.atRisk > 5 || row.avgGpa < 2.5
}

export default function OverviewPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [semesterCode, setSemesterCode] = React.useState("all")
  const [departmentId, setDepartmentId] = React.useState("all")
  const [loading, setLoading] = React.useState(true)
  const [expandedRow, setExpandedRow] = React.useState<number | null>(null)

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
    const secMap = new Map(sections.map((s) => [s.id, s]))
    const courseMap = new Map(courses.map((c) => [c.id, c]))
    const deptMap = new Map(departments.map((d) => [d.id, d]))
    const selectedSemesterId = semesterCode === "all"
      ? null
      : semesters.find((s) => s.code === semesterCode)?.id ?? null
    const selectedDepartmentId = departmentId === "all" ? null : Number(departmentId)
    const scopedPrograms = programs.filter(
      (p) => selectedDepartmentId === null || p.department_id === selectedDepartmentId,
    )
    const scopedProgramIds = new Set(scopedPrograms.map((p) => p.id))
    const activeStudents = students.filter(
      (s) => s.status === "active" && scopedProgramIds.has(s.program_id),
    )
    const activeStudentIds = new Set(activeStudents.map((s) => s.id))
    const filteredEnrollments = enrollments.filter((e) => {
      if (!activeStudentIds.has(e.student_id)) return false
      const sec = secMap.get(e.section_id)
      return selectedSemesterId === null || sec?.semester_id === selectedSemesterId
    })
    const validEnrollments = filteredEnrollments.filter((e) => e.is_passed !== null)
    const gradedEnrollments = filteredEnrollments.filter((e) => e.final_grade !== null)
    const avgGpa = avg(
      activeStudents.flatMap((s) => (s.gpa_cumulative === null ? [] : [s.gpa_cumulative])),
    )
    const atRiskStudents = activeStudents.filter(
      (s) => s.gpa_cumulative !== null && s.gpa_cumulative < 2,
    )
    const sortedSemesters = [...semesters].sort((a, b) => a.year - b.year || a.term - b.term)

    // ── trend line ────────────────────────────────────────────────────────────
    const trend = sortedSemesters.map((sem) => {
      const semEnrollments = enrollments.filter((e) => {
        if (!activeStudentIds.has(e.student_id)) return false
        return secMap.get(e.section_id)?.semester_id === sem.id
      })
      const valid = semEnrollments.filter((e) => e.is_passed !== null)
      const grades = semEnrollments.flatMap((e) => (e.final_grade === null ? [] : [e.final_grade]))
      return {
        semester: sem.code,
        passRate: pct(valid.filter((e) => e.is_passed).length, valid.length),
        avgGrade: +avg(grades).toFixed(2),
        count: valid.length,
      }
    }).filter((item) => item.count > 0)

    // ── per-program rows ──────────────────────────────────────────────────────
    const programRows = scopedPrograms.map((program) => {
      const programStudents = activeStudents.filter((s) => s.program_id === program.id)
      const programStudentIds = new Set(programStudents.map((s) => s.id))
      const programEnrollments = filteredEnrollments.filter((e) => programStudentIds.has(e.student_id))
      const valid = programEnrollments.filter((e) => e.is_passed !== null)
      const grades = programEnrollments.flatMap((e) => (e.final_grade === null ? [] : [e.final_grade]))
      const sectionIds = new Set(programEnrollments.map((e) => e.section_id))
      const failedByCourse = new Map<number, number>()
      for (const e of programEnrollments) {
        if (e.is_passed !== false) continue
        const courseId = secMap.get(e.section_id)?.course_id
        if (courseId) failedByCourse.set(courseId, (failedByCourse.get(courseId) ?? 0) + 1)
      }
      const worstCourseEntry = [...failedByCourse.entries()].sort((a, b) => b[1] - a[1])[0]
      const passRate = pct(valid.filter((e) => e.is_passed).length, valid.length)
      return {
        id: program.id,
        code: program.code,
        name: program.name,
        departmentId: program.department_id,
        department: deptMap.get(program.department_id)?.name ?? "Chưa rõ khoa",
        activeStudents: programStudents.length,
        sections: sectionIds.size,
        totalEnrollments: valid.length,
        passRate,
        avgGrade: +avg(grades).toFixed(2),
        avgGpa: +avg(
          programStudents.flatMap((s) => (s.gpa_cumulative === null ? [] : [s.gpa_cumulative])),
        ).toFixed(2),
        atRisk: programStudents.filter(
          (s) => s.gpa_cumulative !== null && s.gpa_cumulative < 2,
        ).length,
        worstCourse: worstCourseEntry
          ? courseMap.get(worstCourseEntry[0])?.name ?? "Chưa rõ môn"
          : "Chưa có dữ liệu",
        failCount: worstCourseEntry?.[1] ?? 0,
      }
    }).sort((a, b) => b.atRisk - a.atRisk || a.passRate - b.passRate)

    // ── GPA distribution pie chart ────────────────────────────────────────────
    const gpaCounts = Object.fromEntries(GPA_LEVELS.map((l) => [l.label, 0]))
    for (const s of activeStudents) {
      if (s.gpa_cumulative === null) continue
      const label = gpaLevel(s.gpa_cumulative).label
      gpaCounts[label]++
    }
    const gpaChartData = GPA_LEVELS.map((l) => ({ name: l.label, value: gpaCounts[l.label], fill: l.color }))

    // ── department pass rate bar chart ────────────────────────────────────────
    const deptBarData = departments.map((dept) => {
      const deptPrograms = programs.filter((p) => p.department_id === dept.id)
      const deptProgramIds = new Set(deptPrograms.map((p) => p.id))
      const deptStudentIds = new Set(
        activeStudents.filter((s) => deptProgramIds.has(s.program_id)).map((s) => s.id),
      )
      if (deptStudentIds.size === 0) return null
      const deptEnrollments = filteredEnrollments.filter((e) => deptStudentIds.has(e.student_id))
      const valid = deptEnrollments.filter((e) => e.is_passed !== null)
      if (valid.length === 0) return null
      return {
        id: dept.id,
        name: dept.name.length > 30 ? dept.name.slice(0, 28) + "…" : dept.name,
        fullName: dept.name,
        passRate: pct(valid.filter((e) => e.is_passed).length, valid.length),
        total: valid.length,
      }
    })
      .filter(Boolean)
      .sort((a, b) => (a!.passRate - b!.passRate)) as {
        id: number; name: string; fullName: string; passRate: number; total: number
      }[]

    // ── problem programs ──────────────────────────────────────────────────────
    const problemPrograms = programRows.filter(isProblem)

    // ── program-level bar data (for drill-down when a dept is selected) ────────
    const progBarData = programRows
      .filter((r) => r.totalEnrollments > 0)
      .sort((a, b) => a.passRate - b.passRate)
      .map((r) => ({
        id: r.id,
        name: r.name.length > 32 ? r.name.slice(0, 30) + "…" : r.name,
        fullName: r.name,
        passRate: r.passRate,
        total: r.totalEnrollments,
      }))

    return {
      departments,
      sortedSemesters,
      totalActiveStudents: activeStudents.length,
      programCount: scopedPrograms.length,
      passRate: pct(validEnrollments.filter((e) => e.is_passed).length, validEnrollments.length),
      avgGpa,
      avgGrade: avg(gradedEnrollments.map((e) => e.final_grade!)),
      atRiskCount: atRiskStudents.length,
      trend,
      programRows,
      gpaChartData,
      deptBarData,
      progBarData,
      problemPrograms,
      selectedDepartmentName: selectedDepartmentId ? deptMap.get(selectedDepartmentId)?.name ?? null : null,
    }
  }, [raw, semesterCode, departmentId])

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
        Đang tải tổng quan toàn trường...
      </div>
    )
  }

  if (!raw || !data) {
    return <div className="text-sm text-muted-foreground">Chưa có dữ liệu phân tích.</div>
  }

  const kpis = [
    { label: "SV đang học",    value: data.totalActiveStudents,  icon: Users,        color: "text-blue-500" },
    { label: "Ngành đào tạo",  value: data.programCount,         icon: GraduationCap,color: "text-indigo-500" },
    { label: "Pass rate",      value: `${data.passRate}%`,        icon: CheckCircle2, color: "text-emerald-500" },
    { label: "GPA trung bình", value: data.avgGpa.toFixed(2),    icon: TrendingUp,   color: "text-primary" },
    { label: "SV nguy cơ",     value: data.atRiskCount,           icon: AlertTriangle,color: "text-red-500" },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header + filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
          <p className="text-sm text-muted-foreground">
            Trường đang vận hành ra sao, ngành nào nổi bật, ngành nào cần mở ra xem sâu hơn?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterCombobox
            className="w-52"
            placeholder="Tất cả học kỳ"
            value={semesterCode}
            onValueChange={(v) => setSemesterCode(v)}
            options={data.sortedSemesters.map((s) => ({ value: s.code, label: s.name }))}
          />
          <FilterCombobox
            className="w-64"
            placeholder="Toàn trường"
            value={departmentId}
            onValueChange={(v) => setDepartmentId(v)}
            options={data.departments.map((d) => ({ value: String(d.id), label: d.name }))}
          />
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
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

      {/* ── Trend lines ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Xu hướng pass rate toàn trường</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, "Pass rate"]} />
                <Line dataKey="passRate" stroke="#16a34a" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Xu hướng điểm trung bình theo học kỳ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip formatter={(v) => [v, "Điểm TB"]} />
                <Line dataKey="avgGrade" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── GPA pie  +  Department pass rate bar ─────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">

        {/* GPA distribution pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Phân bố GPA sinh viên</CardTitle>
            <p className="text-xs text-muted-foreground">
              Dựa trên GPA tích lũy (thang 4.0) của {data.totalActiveStudents.toLocaleString("vi-VN")} SV đang học
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.gpaChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={PieLabel as never}
                >
                  {data.gpaChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value, entry) => {
                    const item = data.gpaChartData.find((d) => d.name === value)
                    return (
                      <span className="text-xs">
                        {value}{" "}
                        <span className="font-semibold text-foreground">
                          {item?.value?.toLocaleString("vi-VN") ?? 0}
                        </span>
                      </span>
                    )
                  }}
                />
                <Tooltip formatter={(v, name) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
            {/* GPA legend detail */}
            <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
              {GPA_LEVELS.map((l) => {
                const item = data.gpaChartData.find((d) => d.name === l.label)
                const count = item?.value ?? 0
                const pctVal = data.totalActiveStudents ? ((count / data.totalActiveStudents) * 100).toFixed(1) : "0"
                return (
                  <div key={l.label} className="flex flex-col items-center rounded-md border p-2 text-center">
                    <span className="h-2 w-2 rounded-full mb-1" style={{ background: l.color }} />
                    <span className="font-medium">{l.label}</span>
                    <span className="text-muted-foreground">{count.toLocaleString("vi-VN")}</span>
                    <span style={{ color: l.color }} className="font-semibold">{pctVal}%</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Department / Program pass rate bar chart */}
        {(() => {
          const isDrillDown = departmentId !== "all"
          const barData = isDrillDown ? data.progBarData : data.deptBarData
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {isDrillDown
                    ? `Pass rate theo ngành — ${data.selectedDepartmentName ?? ""}`
                    : "Pass rate theo khoa"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  % enrollment đạt / tổng enrollment có kết quả, sắp xếp từ thấp → cao
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(260, barData.length * 38)}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v, _name, props) => [
                        `${v}%  (${props.payload?.total?.toLocaleString("vi-VN")} enrollment)`,
                        "Pass rate",
                      ]}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
                    />
                    <Bar dataKey="passRate" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v: number) => `${v}%` }}>
                      {barData.map((row) => (
                        <Cell key={row.id} fill={passRateColor(row.passRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )
        })()}
      </div>

      {/* ── Problem programs table ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Ngành cần chú ý</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Lọc những ngành có pass rate &lt; 65%, SV nguy cơ &gt; 5, hoặc GPA TB &lt; 2.5.
              Click vào hàng để xem thêm chi tiết.
            </p>
          </div>
          <Badge variant="destructive" className="shrink-0">
            {data.problemPrograms.length} ngành
          </Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {data.problemPrograms.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Không có ngành nào dưới ngưỡng cảnh báo.
            </div>
          ) : (
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="w-8 px-3 py-3" />
                  {["Ngành", "Khoa", "SV active", "Pass rate", "GPA TB", "SV nguy cơ", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.problemPrograms.map((row) => {
                  const isOpen = expandedRow === row.id
                  const flags: string[] = []
                  if (row.passRate < 65) flags.push(`Pass rate thấp (${row.passRate}%)`)
                  if (row.atRisk > 5) flags.push(`${row.atRisk} SV nguy cơ`)
                  if (row.avgGpa < 2.5) flags.push(`GPA TB = ${row.avgGpa}`)

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedRow(isOpen ? null : row.id)}
                      >
                        {/* expand icon */}
                        <td className="px-3 py-3 text-muted-foreground">
                          {isOpen
                            ? <ChevronDown className="size-3.5" />
                            : <ChevronRight className="size-3.5" />}
                        </td>
                        {/* name */}
                        <td className="px-4 py-3">
                          <div className="font-medium">{row.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{row.code}</div>
                        </td>
                        {/* department */}
                        <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                        {/* students */}
                        <td className="px-4 py-3 tabular-nums">{row.activeStudents}</td>
                        {/* pass rate */}
                        <td className="px-4 py-3">
                          <Badge variant={row.passRate < 60 ? "destructive" : "secondary"}>
                            {row.passRate}%
                          </Badge>
                        </td>
                        {/* GPA avg */}
                        <td className="px-4 py-3 tabular-nums">
                          <span className={row.avgGpa < 2.5 ? "text-amber-600 font-semibold" : ""}>
                            {row.avgGpa.toFixed(2)}
                          </span>
                        </td>
                        {/* at-risk */}
                        <td className="px-4 py-3 tabular-nums">
                          <span className={row.atRisk > 5 ? "font-semibold text-red-600" : "text-muted-foreground"}>
                            {row.atRisk}
                          </span>
                        </td>
                        {/* action */}
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href={`/manager/analytics/programs?program=${row.id}`}>
                              <BookOpen className="size-3" />
                              Xem ngành
                            </Link>
                          </Button>
                        </td>
                      </tr>

                      {/* ── expanded detail row ─────────────────────────── */}
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Vấn đề phát hiện
                                </p>
                                <ul className="space-y-1">
                                  {flags.map((f) => (
                                    <li key={f} className="flex items-center gap-1.5 text-xs text-amber-700">
                                      <AlertTriangle className="size-3 shrink-0" />
                                      {f}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Môn kéo điểm xuống nhiều nhất
                                </p>
                                <p className="text-xs">{row.worstCourse}</p>
                                {row.failCount > 0 && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{row.failCount} SV trượt</p>
                                )}
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Tổng số lớp học phần
                                </p>
                                <p className="text-xs">{row.sections} lớp</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Điểm TB môn: {row.avgGrade.toFixed(2)} / 10
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                                <Link href={`/manager/analytics/programs?program=${row.id}`}>
                                  <BookOpen className="size-3" />
                                  Phân tích ngành
                                </Link>
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                                <Link href={`/chat?q=${encodeURIComponent(`Vì sao ngành ${row.name} có vấn đề? Pass rate ${row.passRate}%, ${row.atRisk} SV nguy cơ, GPA TB ${row.avgGpa}`)}`}>
                                  Hỏi AI nguyên nhân
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
