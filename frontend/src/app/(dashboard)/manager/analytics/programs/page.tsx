"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, BookOpen, CheckCircle2, GraduationCap, TrendingUp, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api, type ApiDashboardProgram, type ApiDashboardProgramOption } from "@/lib/api"

const bucketColors: Record<string, string> = {
  "Trượt nặng": "#ef4444",
  "Cận trượt": "#f97316",
  "Trung bình": "#f59e0b",
  "Khá": "#3b82f6",
  "Tốt": "#22c55e",
}

function heatColor(value: number | null) {
  if (value === null) return "bg-muted text-muted-foreground"
  if (value > 75) return "bg-emerald-500 text-white"
  if (value >= 60) return "bg-amber-400 text-amber-950"
  return "bg-red-500 text-white"
}

function dateStartIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function dateEndIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

export default function ProgramAnalyticsPage() {
  const searchParams = useSearchParams()
  const [programOptions, setProgramOptions] = React.useState<ApiDashboardProgramOption[]>([])
  const [data, setData] = React.useState<ApiDashboardProgram | null>(null)
  const [programId, setProgramId] = React.useState("")
  const [semester, setSemester] = React.useState("all")
  const [cohort, setCohort] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const queryProgram = searchParams.get("program_id") ?? searchParams.get("program")
    const parsedProgramId = queryProgram ? Number(queryProgram) : NaN
    if (Number.isFinite(parsedProgramId)) {
      setProgramId(String(parsedProgramId))
      return
    }
    api.getDashboardOverview()
      .then((overview) => {
        setProgramOptions(overview.programs)
        setProgramId(String(overview.programs[0]?.id ?? ""))
      })
      .catch(console.error)
  }, [searchParams])

  React.useEffect(() => {
    if (!programId) return
    setLoading(true)
    api.getDashboardProgram(Number(programId), {
      semester_code: semester === "all" ? undefined : semester,
      cohort_id: cohort === "all" ? undefined : Number(cohort),
      date_from: dateStartIso(dateFrom),
      date_to: dateEndIso(dateTo),
    })
      .then((payload) => {
        setData(payload)
        setProgramOptions(payload.programs)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [programId, semester, cohort, dateFrom, dateTo])

  const heatSemesters = React.useMemo(() => {
    if (!data) return []
    const semMap = new Map(data.cohort_heatmap.map((row) => [row.semester_id, { id: row.semester_id, code: row.semester, year: row.year, term: row.term }]))
    return [...semMap.values()].sort((a, b) => a.year - b.year || a.term - b.term).slice(-6)
  }, [data])

  const cohortHeatmap = React.useMemo(() => {
    if (!data) return []
    const byCohort = new Map<number, { id: number; cohort: string; cells: (number | null)[] }>()
    for (const item of data.cohort_heatmap) {
      byCohort.set(item.cohort_id, byCohort.get(item.cohort_id) ?? { id: item.cohort_id, cohort: item.cohort, cells: [] })
    }
    return [...byCohort.values()].map((row) => ({
      ...row,
      cells: heatSemesters.map((semester) => data.cohort_heatmap.find((item) => item.cohort_id === row.id && item.semester_id === semester.id)?.pass_rate ?? null),
    }))
  }, [data, heatSemesters])

  if (loading || !data) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Đang tải dashboard ngành từ DWH...</div>
  }

  const programLabel = `${data.program.code} - ${data.program.name}`
  const semesterLabel = semester === "all" ? "Tất cả học kỳ" : data.semesters.find((item) => item.code === semester)?.name ?? semester
  const cohortLabel = cohort === "all" ? "Tất cả khóa" : data.cohorts.find((item) => String(item.id) === cohort)?.code ?? cohort

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ngành đào tạo</h1>
        <p className="text-sm text-muted-foreground">Dashboard ngành dùng API aggregate theo ngành, không tải toàn bộ enrollment về frontend.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={programId} onValueChange={(value) => { if (value) setProgramId(value); setCohort("all") }}>
          <SelectTrigger className="w-72"><span className="truncate">{programLabel}</span></SelectTrigger>
          <SelectContent>
            {programOptions.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={semester} onValueChange={(value) => setSemester(value ?? "all")}>
          <SelectTrigger className="w-52"><span className="truncate">{semesterLabel}</span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả học kỳ</SelectItem>
            {data.semesters.map((item) => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cohort} onValueChange={(value) => setCohort(value ?? "all")}>
          <SelectTrigger className="w-44"><span className="truncate">{cohortLabel}</span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả khóa</SelectItem>
            {data.cohorts.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" aria-label="Từ ngày" />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" aria-label="Đến ngày" />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">Ngành: {programLabel}</Badge>
        <Badge variant="outline">Học kỳ: {semesterLabel}</Badge>
        <Badge variant="outline">Khóa: {cohortLabel}</Badge>
        <Badge variant="outline">Thời gian: {dateFrom || "đầu dữ liệu"} → {dateTo || "hiện tại"}</Badge>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-4">
          <GraduationCap className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">{data.program.name}</p>
            <p className="text-xs text-muted-foreground">{data.program.code} · Mọi metric bên dưới chỉ tính trên ngành, học kỳ, khóa và khoảng ngày đang chọn.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["SV của ngành", data.kpis.students, Users, "text-blue-500"],
          ["Điểm TB ngành", data.kpis.avg_grade.toFixed(2), TrendingUp, "text-primary"],
          ["Pass rate ngành", `${data.kpis.pass_rate}%`, CheckCircle2, "text-emerald-500"],
          ["SV có lượt trượt", data.kpis.at_risk, AlertTriangle, "text-red-500"],
          ["Môn bottleneck", data.kpis.bottlenecks, BookOpen, "text-amber-500"],
        ].map(([label, value, Icon, color]) => (
          <Card key={String(label)}>
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <p className="text-xs text-muted-foreground">{String(label)}</p>
                <p className="mt-1 text-2xl font-bold">{String(value)}</p>
              </div>
              {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: `h-5 w-5 ${color}` })}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Pass rate của ngành qua học kỳ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => [`${value}%`, "Pass rate"]} />
                <Line dataKey="pass_rate" stroke="#16a34a" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Điểm trung bình của ngành qua học kỳ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip formatter={(value) => [value, "Điểm TB"]} />
                <Line dataKey="avg_grade" stroke="#6366f1" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pass rate theo nhóm tín chỉ</CardTitle>
            <p className="text-xs text-muted-foreground">Phân nhóm bằng số tín chỉ trong DWH để phát hiện nhóm môn đang kéo ngành xuống.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.groups} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value}%`, "Pass rate"]} />
                <Bar dataKey="pass_rate" radius={[0, 4, 4, 0]}>
                  {data.groups.map((item) => <Cell key={item.name} fill={item.pass_rate >= 75 ? "#22c55e" : item.pass_rate >= 60 ? "#f59e0b" : "#ef4444"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Phân bố kết quả học phần trong ngành</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.distribution} dataKey="value" nameKey="name" cx="50%" cy="43%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`} labelLine>
                  {data.distribution.map((item) => <Cell key={item.name} fill={bucketColors[item.name] ?? "#64748b"} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} lượt`, name]} />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Heatmap khóa sinh viên × học kỳ</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead>
              <tr>
                <th className="pb-2 text-left text-muted-foreground">Khóa</th>
                {heatSemesters.map((item) => <th key={item.id} className="pb-2 text-center text-muted-foreground">{item.code}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {cohortHeatmap.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 font-medium">{row.cohort}</td>
                  {row.cells.map((value, index) => (
                    <td key={index} className="px-1 py-2 text-center">
                      <span className={`inline-flex min-w-12 justify-center rounded px-2 py-1 font-medium ${heatColor(value)}`}>{value === null ? "—" : `${value}%`}</span>
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
          <CardTitle className="text-sm">Course Performance in Program</CardTitle>
          <p className="text-xs text-muted-foreground">Môn nào đang kéo ngành xuống và cần mở drill-down sâu hơn.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1050px] text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Mã môn", "Tên môn", "Nhóm", "Lượt học", "Pass rate", "Điểm TB", "SV trượt", "SV cận trượt", "Action"].map((item) => (
                  <th key={item} className="px-4 py-3 text-left font-medium text-muted-foreground">{item}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.course_stats.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono">{item.code}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.group}</td>
                  <td className="px-4 py-3">{item.total}</td>
                  <td className="px-4 py-3"><Badge variant={item.pass_rate < 60 ? "destructive" : "secondary"}>{item.pass_rate}%</Badge></td>
                  <td className="px-4 py-3">{item.avg_grade.toFixed(2)}</td>
                  <td className="px-4 py-3 text-red-500">{item.failed}</td>
                  <td className="px-4 py-3 text-amber-600">{item.near_fail}</td>
                  <td className="px-4 py-3"><Link href={`/manager/analytics/courses?course=${item.id}`} className="font-medium text-primary hover:underline">Xem môn</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
