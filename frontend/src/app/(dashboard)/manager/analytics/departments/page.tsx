"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, TrendingUp, CheckCircle2 } from "lucide-react"
import { api } from "@/lib/api"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

type Raw = {
  departments: Awaited<ReturnType<typeof api.getDepartments>>
  programs:    Awaited<ReturnType<typeof api.getPrograms>>
  students:    Awaited<ReturnType<typeof api.getStudents>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
}

export default function DepartmentsAnalyticsPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)

  React.useEffect(() => {
    Promise.all([
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 100 }),
      api.getStudents({ limit: 500 }),
      api.getEnrollments({ limit: 3000 }),
    ]).then(([departments, programs, students, enrollments]) =>
      setRaw({ departments, programs, students, enrollments })
    ).catch(console.error)
  }, [])

  const deptStats = React.useMemo(() => {
    if (!raw) return null
    const { departments, programs, students, enrollments } = raw
    const progMap = new Map(programs.map(p => [p.id, p]))

    // student_id → department_id
    const studentDept = new Map<number, number>()
    for (const s of students) {
      const prog = progMap.get(s.program_id)
      if (prog) studentDept.set(s.id, prog.department_id)
    }

    return departments.map(dept => {
      const deptStudents = students.filter(s => studentDept.get(s.id) === dept.id)
      const deptEnrolls  = enrollments.filter(e => studentDept.get(e.student_id) === dept.id)
      const valid        = deptEnrolls.filter(e => e.is_passed !== null)
      const passRate     = valid.length ? valid.filter(e => e.is_passed).length / valid.length * 100 : 0
      const withGpa      = deptStudents.filter(s => s.gpa_cumulative !== null)
      const avgGpa       = withGpa.length ? withGpa.reduce((s, x) => s + x.gpa_cumulative!, 0) / withGpa.length : 0
      const atRisk       = deptStudents.filter(s => s.gpa_cumulative !== null && s.gpa_cumulative < 2.0).length
      const shortName    = dept.name.replace(/^Khoa\s+/i, "").replace(/^Bộ môn\s+/i, "")

      return {
        id: dept.id,
        name: dept.name,
        shortName: shortName.length > 20 ? shortName.slice(0, 20) + "…" : shortName,
        full: dept.name,
        studentCount: deptStudents.length,
        passRate: Math.round(passRate * 10) / 10,
        avgGpa: Math.round(avgGpa * 100) / 100,
        atRisk,
        programs: programs.filter(p => p.department_id === dept.id),
      }
    }).sort((a, b) => b.studentCount - a.studentCount)
  }, [raw])

  const totalStudents  = deptStats?.reduce((s, d) => s + d.studentCount, 0) ?? 0
  const overallPassAvg = deptStats?.length
    ? deptStats.reduce((s, d) => s + d.passRate, 0) / deptStats.length
    : 0
  const overallGpa     = totalStudents
    ? (deptStats?.reduce((s, d) => s + d.avgGpa * d.studentCount, 0) ?? 0) / totalStudents
    : 0

  const barPassData = deptStats?.map(d => ({ name: d.shortName, full: d.full, rate: d.passRate })) ?? []
  const barGpaData  = deptStats?.map(d => ({ name: d.shortName, full: d.full, gpa: d.avgGpa })) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Phân tích theo Khoa</h1>
        <p className="text-sm text-muted-foreground">So sánh chỉ số học tập giữa các khoa</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Số khoa",           value: deptStats?.length ?? "—",              icon: <Building2 className="h-6 w-6 text-primary" /> },
          { label: "Tổng sinh viên",    value: totalStudents || "—",                  icon: <Users className="h-6 w-6 text-primary" /> },
          { label: "Pass rate TB",      value: deptStats ? `${overallPassAvg.toFixed(1)}%` : "—", icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" /> },
          { label: "GPA TB toàn trường",value: deptStats ? overallGpa.toFixed(2) : "—", icon: <TrendingUp className="h-6 w-6 text-primary" /> },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-3xl font-bold mt-1">{k.value}</p>
                </div>
                {k.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison bar charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tỷ lệ qua môn theo khoa (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barPassData} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as { full: string; rate: number }
                    return (
                      <div className="bg-background border rounded p-2 text-xs shadow-md">
                        <p className="font-semibold">{d.full}</p>
                        <p>Pass rate: {d.rate}%</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {barPassData.map((d, i) => (
                    <Cell key={i} fill={d.rate >= 75 ? "#22c55e" : d.rate >= 60 ? "#f59e0b" : "#ef4444"} />
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
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barGpaData} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 4]} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as { full: string; gpa: number }
                    return (
                      <div className="bg-background border rounded p-2 text-xs shadow-md">
                        <p className="font-semibold">{d.full}</p>
                        <p>GPA: {d.gpa}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="gpa" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-department detail cards */}
      <div className="grid gap-3">
        {(deptStats ?? []).map(dept => (
          <Card key={dept.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">{dept.name}</CardTitle>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{dept.studentCount} SV</Badge>
                  <Badge
                    variant={dept.passRate >= 75 ? "default" : dept.passRate >= 60 ? "outline" : "destructive"}
                    className="text-xs"
                  >
                    {dept.passRate}% qua môn
                  </Badge>
                  <Badge variant="outline" className="text-xs">GPA {dept.avgGpa.toFixed(2)}</Badge>
                  {dept.atRisk > 0 && (
                    <Badge variant="destructive" className="text-xs">{dept.atRisk} nguy cơ</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            {dept.programs.length > 0 && (
              <CardContent className="pt-0 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {dept.programs.map(p => (
                    <Badge key={p.id} variant="outline" className="text-[10px]">{p.name}</Badge>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {!deptStats && (
          <p className="text-sm text-muted-foreground py-4">Đang tải dữ liệu…</p>
        )}
      </div>
    </div>
  )
}
