"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Building2, CheckCircle2, TrendingUp, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api, type ApiDashboardDepartments } from "@/lib/api"

function heatColor(value: number): string {
  if (value >= 80) return "bg-emerald-500"
  if (value >= 70) return "bg-emerald-300"
  if (value >= 60) return "bg-yellow-300"
  if (value >= 50) return "bg-orange-400"
  return "bg-red-500"
}

function dateStartIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function dateEndIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

export default function DepartmentsAnalyticsPage() {
  const [data, setData] = React.useState<ApiDashboardDepartments | null>(null)
  const [selSem, setSelSem] = React.useState("all")
  const [selDept, setSelDept] = React.useState("all")
  const [selProg, setSelProg] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setTimeout(() => {
      setLoading(true)
    }, 0)
    api.getDashboardDepartments({
      semester_code: selSem === "all" ? undefined : selSem,
      department_id: selDept === "all" ? undefined : Number(selDept),
      program_id: selProg === "all" ? undefined : Number(selProg),
      date_from: dateStartIso(dateFrom),
      date_to: dateEndIso(dateTo),
    })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selSem, selDept, selProg, dateFrom, dateTo])

  const filteredPrograms = React.useMemo(() => {
    if (!data) return []
    if (selDept === "all") return data.programs
    return data.programs.filter((program) => program.department_id === Number(selDept))
  }, [data, selDept])

  const heatSemesters = React.useMemo(() => {
    if (!data) return []
    const semMap = new Map(data.heatmap.map((row) => [row.semester_id, { id: row.semester_id, code: row.semester, year: row.year, term: row.term }]))
    return [...semMap.values()].sort((a, b) => a.year - b.year || a.term - b.term).slice(-8)
  }, [data])

  const heatRows = React.useMemo(() => {
    if (!data) return []
    const byDept = new Map<number, { id: number; dept: string; cells: (number | null)[] }>()
    for (const item of data.heatmap) {
      byDept.set(item.department_id, byDept.get(item.department_id) ?? { id: item.department_id, dept: item.department, cells: [] })
    }
    return [...byDept.values()].map((row) => ({
      ...row,
      cells: heatSemesters.map((semester) => data.heatmap.find((item) => item.department_id === row.id && item.semester_id === semester.id)?.pass_rate ?? null),
    }))
  }, [data, heatSemesters])

  if (loading) {
    return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Đang tải dashboard khoa từ DWH...</div>
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Chưa có dữ liệu phân tích.</div>
  }

  const totalStudents = data.dept_stats.reduce((sum, item) => sum + item.student_count, 0)
  const totalAtRisk = data.dept_stats.reduce((sum, item) => sum + item.at_risk, 0)
  const overallPass = data.dept_stats.length ? data.dept_stats.reduce((sum, item) => sum + item.pass_rate, 0) / data.dept_stats.length : 0
  const overallGrade = totalStudents ? data.dept_stats.reduce((sum, item) => sum + item.avg_grade * item.student_count, 0) / totalStudents : 0
  const selectedDeptName = data.departments.find((department) => String(department.id) === selDept)?.name ?? ""
  const semesterLabel = selSem === "all" ? "Tất cả học kỳ" : data.semesters.find((item) => item.code === selSem)?.name ?? selSem
  const departmentLabel = selDept === "all" ? "Tất cả khoa" : selectedDeptName
  const programLabel = selProg === "all" ? "Tất cả ngành" : filteredPrograms.find((item) => String(item.id) === selProg)?.name ?? selProg

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phân tích theo Khoa / Ngành</h1>
          <p className="text-sm text-muted-foreground">So sánh hiệu quả đào tạo giữa các khoa bằng số liệu đã tổng hợp từ DWH.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={selSem} onValueChange={(value) => setSelSem(value ?? "all")}>
            <SelectTrigger className="w-48"><span className="truncate">{semesterLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {data.semesters.map((semester) => <SelectItem key={semester.id} value={semester.code}>{semester.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selDept} onValueChange={(value) => { setSelDept(value ?? "all"); setSelProg("all") }}>
            <SelectTrigger className="w-56"><span className="truncate">{departmentLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả khoa</SelectItem>
              {data.departments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selProg} onValueChange={(value) => setSelProg(value ?? "all")}>
            <SelectTrigger className="w-64"><span className="truncate">{programLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ngành</SelectItem>
              {filteredPrograms.map((program) => <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" aria-label="Từ ngày" />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" aria-label="Đến ngày" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Khoa: {departmentLabel}</Badge>
          <Badge variant="outline">Ngành: {programLabel}</Badge>
          <Badge variant="outline">Học kỳ: {semesterLabel}</Badge>
          <Badge variant="outline">Thời gian: {dateFrom || "đầu dữ liệu"} → {dateTo || "hiện tại"}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Số khoa", value: data.dept_stats.length || "—", icon: <Building2 className="h-5 w-5 text-muted-foreground" /> },
          { label: "Tổng sinh viên", value: totalStudents || "—", icon: <Users className="h-5 w-5 text-muted-foreground" /> },
          { label: "Pass rate TB", value: `${overallPass.toFixed(1)}%`, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: "SV có lượt trượt", value: totalAtRisk || "—", icon: <AlertTriangle className={`h-5 w-5 ${totalAtRisk > 0 ? "text-destructive" : "text-muted-foreground"}`} /> },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-start justify-between pb-4 pt-5">
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{kpi.value}</p>
              </div>
              {kpi.icon}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pass rate theo khoa (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.dept_stats} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short_name" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value}%`, "Pass rate"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="pass_rate" radius={[4, 4, 0, 0]}>
                  {data.dept_stats.map((dept) => <Cell key={dept.id} fill={dept.pass_rate >= 75 ? "#22c55e" : dept.pass_rate >= 60 ? "#f59e0b" : "#ef4444"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Điểm trung bình theo khoa</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.dept_stats} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short_name" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [value, "Điểm TB"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="avg_grade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">SV có lượt trượt theo khoa</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.dept_stats} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short_name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [value, "SV có lượt trượt"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="at_risk" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">Điểm TB toàn phạm vi: {overallGrade.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Heatmap Pass rate — Khoa × Học kỳ (%)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead>
              <tr>
                <th className="w-40 pb-2 pr-3 text-left font-medium text-muted-foreground">Khoa</th>
                {heatSemesters.map((semester) => <th key={semester.id} className="min-w-[64px] px-1 pb-2 text-center font-medium text-muted-foreground">{semester.code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {heatRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-1.5 pr-3 text-[11px] font-medium leading-tight">{row.dept}</td>
                  {row.cells.map((value, index) => (
                    <td key={index} className="px-1 py-1.5 text-center">
                      {value !== null ? (
                        <span className={`inline-flex min-w-[48px] items-center justify-center rounded px-1.5 py-0.5 font-medium text-white ${heatColor(value)}`}>{value.toFixed(0)}%</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selDept !== "all" ? (
        <div className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="h-4 w-4 text-primary" />
            Drill-down: {selectedDeptName}
          </h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 môn trượt cao nhất</CardTitle></CardHeader>
              <CardContent>
                {data.drill_course_fail.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Không đủ dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, data.drill_course_fail.length * 34)}>
                    <BarChart data={data.drill_course_fail} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [`${value}%`, "Tỷ lệ trượt"]} />
                      <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                        {data.drill_course_fail.map((item) => <Cell key={item.id} fill={item.rate >= 40 ? "#ef4444" : item.rate >= 25 ? "#f97316" : "#f59e0b"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top lớp bất thường (fail &gt; TB môn ≥ 15%)</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.drill_section_abnormal.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">Không có lớp bất thường</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Mã lớp</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Môn</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Fail</th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">Chênh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.drill_section_abnormal.map((section) => (
                          <tr key={section.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2 font-mono text-[11px]">{section.code}</td>
                            <td className="max-w-[140px] truncate px-3 py-2" title={section.course_name}>{section.course_name}</td>
                            <td className="px-3 py-2 text-right"><Badge variant="destructive" className="text-[10px]">{section.fail_rate}%</Badge></td>
                            <td className="px-4 py-2 text-right font-medium text-destructive">+{section.diff}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Chọn một khoa cụ thể để xem drill-down: Top 10 môn trượt và lớp bất thường.
        </p>
      )}

      <div className="text-right">
        <Link href="/manager/analytics" className="text-sm font-medium text-primary hover:underline">Quay lại tổng quan</Link>
      </div>
    </div>
  )
}
