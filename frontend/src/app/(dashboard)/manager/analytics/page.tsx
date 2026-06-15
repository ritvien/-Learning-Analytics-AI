"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"
import { api, type ApiSection, type ApiSemester } from "@/lib/api"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts"

const BUCKET_COLORS: Record<string, string> = {
  "Xuất sắc": "#22c55e",
  "Giỏi":     "#84cc16",
  "Khá":      "#f59e0b",
  "Trung bình": "#f97316",
  "Trượt":    "#ef4444",
}

function gradeBucket(g: number | null): string | null {
  if (g === null) return null
  if (g >= 8.5) return "Xuất sắc"
  if (g >= 7.0) return "Giỏi"
  if (g >= 5.5) return "Khá"
  if (g >= 5.0) return "Trung bình"
  return "Trượt"
}

type Raw = {
  students:    Awaited<ReturnType<typeof api.getStudents>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  courses:     Awaited<ReturnType<typeof api.getCourses>>
  sections:    ApiSection[]
  semesters:   ApiSemester[]
}

export default function OverviewPage() {
  const [raw, setRaw]         = React.useState<Raw | null>(null)
  const [semester, setSemester] = React.useState("all")

  React.useEffect(() => {
    Promise.all([
      api.getStudents({ limit: 500 }),
      api.getEnrollments({ limit: 3000 }),
      api.getCourses({ limit: 200 }),
      api.getSections({ limit: 300 }),
      api.getSemesters(),
    ]).then(([students, enrollments, courses, sections, semesters]) =>
      setRaw({ students, enrollments, courses, sections, semesters })
    ).catch(console.error)
  }, [])

  const stats = React.useMemo(() => {
    if (!raw) return null
    const { students, enrollments, courses, sections, semesters } = raw
    const secMap     = new Map(sections.map(s => [s.id, s]))
    const courseMap  = new Map(courses.map(c => [c.id, c]))
    const semMap     = new Map(semesters.map(s => [s.id, s]))

    const filtered = semester === "all"
      ? enrollments
      : enrollments.filter(e => {
          const sec = secMap.get(e.section_id)
          return sec ? semMap.get(sec.semester_id)?.code === semester : false
        })

    const valid = filtered.filter(e => e.is_passed !== null)

    // KPIs
    const totalStudents = students.length
    const passRate      = valid.length ? valid.filter(e => e.is_passed).length / valid.length * 100 : 0
    const withGpa       = students.filter(s => s.gpa_cumulative !== null)
    const avgGpa        = withGpa.length ? withGpa.reduce((s, x) => s + x.gpa_cumulative!, 0) / withGpa.length : 0
    const atRisk        = students.filter(s => s.gpa_cumulative !== null && s.gpa_cumulative < 2.0).length

    // Bar: top 10 courses by fail rate
    const cStats = new Map<number, { name: string; full: string; total: number; failed: number }>()
    for (const e of valid) {
      const sec = secMap.get(e.section_id); if (!sec) continue
      const c   = courseMap.get(sec.course_id); if (!c) continue
      const s   = cStats.get(sec.course_id) ?? { name: c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name, full: c.name, total: 0, failed: 0 }
      s.total++
      if (!e.is_passed) s.failed++
      cStats.set(sec.course_id, s)
    }
    const failBar = [...cStats.values()]
      .filter(c => c.total >= 3)
      .map(c => ({ ...c, rate: Math.round(c.failed / c.total * 100) }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10)

    // Line: avg grade trend by semester (all enrollments, not just filtered)
    const semGrades = new Map<string, { label: string; sum: number; cnt: number }>()
    for (const e of enrollments) {
      if (e.final_grade === null) continue
      const sec = secMap.get(e.section_id); if (!sec) continue
      const sem = semMap.get(sec.semester_id); if (!sem) continue
      const g   = semGrades.get(sem.code) ?? { label: sem.code, sum: 0, cnt: 0 }
      g.sum += e.final_grade; g.cnt++
      semGrades.set(sem.code, g)
    }
    const trend = [...semGrades.values()]
      .map(g => ({ hk: g.label, avg: +(g.sum / g.cnt).toFixed(2) }))
      .sort((a, b) => a.hk.localeCompare(b.hk))

    // Donut: grade buckets
    const buckets: Record<string, number> = { "Xuất sắc": 0, "Giỏi": 0, "Khá": 0, "Trung bình": 0, "Trượt": 0 }
    for (const e of filtered) {
      const b = gradeBucket(e.final_grade)
      if (b) buckets[b]++
    }
    const donut = Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

    return { totalStudents, passRate, avgGpa, atRisk, failBar, trend, donut }
  }, [raw, semester])

  const kpis = [
    {
      label: "Tổng sinh viên",
      value: stats?.totalStudents ?? "—",
      icon: <Users className="h-6 w-6 text-primary" />,
      alert: null,
    },
    {
      label: "Tỷ lệ qua môn",
      value: stats ? `${stats.passRate.toFixed(1)}%` : "—",
      icon: <CheckCircle2 className={`h-6 w-6 ${!stats || stats.passRate >= 70 ? "text-emerald-500" : "text-destructive"}`} />,
      alert: stats && stats.passRate < 70 ? "Dưới ngưỡng 70%" : null,
    },
    {
      label: "GPA trung bình",
      value: stats ? stats.avgGpa.toFixed(2) : "—",
      icon: <TrendingUp className="h-6 w-6 text-primary" />,
      alert: null,
    },
    {
      label: "SV nguy cơ",
      value: stats?.atRisk ?? "—",
      icon: <AlertTriangle className={`h-6 w-6 ${stats && stats.atRisk > 0 ? "text-destructive" : "text-muted-foreground"}`} />,
      alert: stats && stats.atRisk > 0 ? "GPA < 2.0" : null,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan toàn trường</h1>
          <p className="text-sm text-muted-foreground">Trường Đại học Điện Lực — EPU</p>
        </div>
        <Select value={semester} onValueChange={(val) => setSemester(val || "all")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả học kỳ</SelectItem>
            {raw?.semesters
              .slice()
              .sort((a, b) => a.code.localeCompare(b.code))
              .map(s => (
                <SelectItem key={s.id} value={s.code}>{s.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-3xl font-bold mt-1">{k.value}</p>
                  {k.alert && <Badge variant="destructive" className="mt-1.5 text-[10px]">{k.alert}</Badge>}
                </div>
                {k.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: fail bar + donut */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 môn có tỷ lệ trượt cao nhất</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.failBar.length ? (
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={stats.failBar} layout="vertical" margin={{ left: 0, right: 36, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={168} tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as { full: string; failed: number; total: number; rate: number }
                      return (
                        <div className="bg-background border rounded p-2 text-xs shadow-md">
                          <p className="font-semibold mb-0.5">{d.full}</p>
                          <p>Trượt: {d.failed}/{d.total} ({d.rate}%)</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {stats.failBar.map((d, i) => (
                      <Cell key={i} fill={d.rate >= 40 ? "#ef4444" : d.rate >= 25 ? "#f97316" : "#f59e0b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">Đang tải dữ liệu…</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Phân bổ xếp loại học tập</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie
                  data={stats?.donut ?? []}
                  cx="50%" cy="44%"
                  innerRadius={58} outerRadius={95}
                  dataKey="value"
                >
                  {(stats?.donut ?? []).map((entry, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [v, "SV"]}
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                />
                <Legend iconSize={10} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: trend line + top-5 table */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Xu hướng điểm trung bình theo học kỳ (thang 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={stats?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [v, "Điểm TB"]}
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="avg" name="Điểm TB" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 5 môn cần cải thiện</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {stats?.failBar.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-xs leading-tight" title={c.full}>{c.full}</p>
                    <p className="text-[10px] text-muted-foreground">{c.failed}/{c.total} SV trượt</p>
                  </div>
                  <Badge variant={c.rate >= 40 ? "destructive" : "outline"} className="text-[10px] shrink-0">
                    {c.rate}%
                  </Badge>
                </div>
              ))}
              {!stats?.failBar.length && (
                <p className="text-xs text-muted-foreground px-5 py-5">Chưa có đủ dữ liệu</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
