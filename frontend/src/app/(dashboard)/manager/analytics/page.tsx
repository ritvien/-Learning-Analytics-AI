"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Award, BookOpen, CheckCircle2, GraduationCap, TrendingUp, Users } from "lucide-react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api, type ApiDashboardOverview } from "@/lib/api"

const bucketColors: Record<string, string> = {
  "Trượt nặng": "#ef4444",
  "Cận trượt": "#f97316",
  "Trung bình": "#f59e0b",
  "Khá": "#2563eb",
  "Tốt": "#22c55e",
}

function heatColor(value: number | null) {
  if (value === null) return "bg-muted text-muted-foreground"
  if (value >= 75) return "bg-emerald-500 text-white"
  if (value >= 60) return "bg-amber-400 text-amber-950"
  return "bg-red-500 text-white"
}

function dateStartIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function dateEndIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

export default function OverviewPage() {
  const [data, setData] = React.useState<ApiDashboardOverview | null>(null)
  const [trendRows, setTrendRows] = React.useState<ApiDashboardOverview["trend"]>([])
  const [semesterCode, setSemesterCode] = React.useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("vinuni_selected_semester") || "all"
    }
    return "all"
  })
  const [departmentId, setDepartmentId] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (data?.semesters && data.semesters.length > 0) {
      const saved = sessionStorage.getItem("vinuni_selected_semester")
      if (!saved) {
        const sorted = [...data.semesters].sort((a, b) => b.year * 10 + b.term - (a.year * 10 + a.term))
        const latest = sorted[0]?.code
        if (latest) {
          setTimeout(() => {
            setSemesterCode(latest)
          }, 0)
          sessionStorage.setItem("vinuni_selected_semester", latest)
        }
      }
    }
  }, [data])

  React.useEffect(() => {
    let ignore = false

    setTimeout(() => {
      if (!ignore) setLoading(true)
    }, 0)

    const scopedParams = {
      semester_code: semesterCode === "all" ? undefined : semesterCode,
      department_id: departmentId === "all" ? undefined : Number(departmentId),
      date_from: dateStartIso(dateFrom),
      date_to: dateEndIso(dateTo),
    }
    const trendParams = {
      department_id: scopedParams.department_id,
      date_from: scopedParams.date_from,
      date_to: scopedParams.date_to,
    }

    Promise.all([
      api.getDashboardOverview(scopedParams),
      semesterCode === "all" ? Promise.resolve(null) : api.getDashboardOverview(trendParams),
    ])
      .then(([nextData, unfilteredTrendData]) => {
        if (ignore) return
        setData(nextData)
        setTrendRows(unfilteredTrendData?.trend ?? nextData.trend)
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [semesterCode, departmentId, dateFrom, dateTo])

  const heatSemesters = React.useMemo(() => {
    if (!data) return []
    const semMap = new Map(data.heatmap.map((row) => [row.semester_id, { id: row.semester_id, code: row.semester, year: row.year, term: row.term }]))
    return [...semMap.values()].sort((a, b) => a.year - b.year || a.term - b.term).slice(-6)
  }, [data])

  const heatRows = React.useMemo(() => {
    if (!data) return []
    const byProgram = new Map<number, { id: number; name: string; cells: (number | null)[] }>()
    for (const item of data.heatmap) {
      const row = byProgram.get(item.program_id) ?? { id: item.program_id, name: item.program_name, cells: [] }
      byProgram.set(item.program_id, row)
    }
    return [...byProgram.values()].map((row) => ({
      ...row,
      cells: heatSemesters.map((semester) => data.heatmap.find((item) => item.program_id === row.id && item.semester_id === semester.id)?.pass_rate ?? null),
    }))
  }, [data, heatSemesters])

  if (loading) {
    return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Đang tải tổng quan từ DWH...</div>
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Chưa có dữ liệu phân tích.</div>
  }

  const kpis = [
    { label: "SV đang học", value: data.kpis.total_active_students, icon: Users, color: "text-blue-500" },
    { label: "Ngành đào tạo", value: data.kpis.program_count, icon: GraduationCap, color: "text-indigo-500" },
    { label: "Pass rate", value: `${data.kpis.pass_rate}%`, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Điểm TB", value: data.kpis.avg_grade.toFixed(2), icon: TrendingUp, color: "text-primary" },
    { label: "SV có lượt trượt", value: data.kpis.risk_student_count, icon: AlertTriangle, color: "text-red-500" },
  ]
  const semesterLabel = semesterCode === "all" ? "Tất cả học kỳ" : data.semesters.find((item) => item.code === semesterCode)?.name ?? semesterCode
  const departmentLabel = departmentId === "all" ? "Toàn trường" : data.departments.find((item) => String(item.id) === departmentId)?.name ?? departmentId

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
          <p className="text-sm text-muted-foreground">Dashboard tổng hợp dùng dữ liệu đã aggregate từ DWH, không tải raw enrollment về trình duyệt.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={semesterCode} onValueChange={(value) => {
            const nextVal = value ?? "all"
            setSemesterCode(nextVal)
            sessionStorage.setItem("vinuni_selected_semester", nextVal)
          }}>
            <SelectTrigger className="w-52"><span className="truncate">{semesterLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {data.semesters.map((semester) => (
                <SelectItem key={semester.id} value={semester.code}>{semester.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentId} onValueChange={(value) => setDepartmentId(value ?? "all")}>
            <SelectTrigger className="w-64"><span className="truncate">{departmentLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toàn trường</SelectItem>
              {data.departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" aria-label="Từ ngày" />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" aria-label="Đến ngày" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">
          Khoa: {departmentLabel}
        </Badge>
        <Badge variant="outline">Học kỳ: {semesterLabel}</Badge>
        <Badge variant="outline">Thời gian: {dateFrom || "đầu dữ liệu"} → {dateTo || "hiện tại"}</Badge>
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
              <LineChart data={trendRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => [`${value}%`, "Pass rate"]} />
                <Line dataKey="pass_rate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Xu hướng điểm trung bình theo học kỳ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip formatter={(value) => [value, "Điểm TB"]} />
                <Line dataKey="avg_grade" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pass rate theo khoa</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(260, data.department_rows.length * 36)}>
            <BarChart data={data.department_rows} layout="vertical" margin={{ left: 24, right: 36 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Pass rate"]} />
              <Bar dataKey="pass_rate" radius={[0, 4, 4, 0]}>
                {data.department_rows.map((row) => (
                  <Cell key={row.id} fill={row.pass_rate >= 75 ? "#22c55e" : row.pass_rate >= 60 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tỷ lệ Đạt / Trượt theo khóa</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.cohort_rows} margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="cohort" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value, name) => [`${value}%`, name === "pass_rate" ? "Đạt" : "Trượt"]} />
                <Legend formatter={(value) => (value === "pass_rate" ? "Đạt" : "Trượt")} />
                <Bar dataKey="pass_rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fail_rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-primary" />
              Phân bố kết quả học phần
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.grade_distribution.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Chưa có dữ liệu điểm.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data.grade_distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={(entry) => `${entry.name}: ${entry.value}`} labelLine={false}>
                    {data.grade_distribution.map((bucket) => (
                      <Cell key={bucket.name} fill={bucketColors[bucket.name] ?? "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} lượt`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Heatmap ngành × học kỳ</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr>
                <th className="pb-2 text-left text-muted-foreground">Ngành</th>
                {heatSemesters.map((semester) => <th key={semester.id} className="pb-2 text-center text-muted-foreground">{semester.code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {heatRows.map((row) => (
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
        <CardHeader><CardTitle className="text-sm">Program Overview Table</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                {["Ngành", "Khoa quản lý", "SV active", "Section", "Pass rate", "Điểm TB", "SV có lượt trượt", "Môn kéo xuống", "Action"].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.program_rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{row.code}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.department ?? "Chưa rõ khoa"}</td>
                  <td className="px-4 py-3">{row.active_students}</td>
                  <td className="px-4 py-3">{row.sections}</td>
                  <td className="px-4 py-3"><Badge variant={row.pass_rate < 60 ? "destructive" : "secondary"}>{row.pass_rate}%</Badge></td>
                  <td className="px-4 py-3">{row.avg_grade.toFixed(2)}</td>
                  <td className="px-4 py-3 text-red-600">{row.at_risk}</td>
                  <td className="max-w-[220px] truncate px-4 py-3">{row.worst_course}</td>
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
