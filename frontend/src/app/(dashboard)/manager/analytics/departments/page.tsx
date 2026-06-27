"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Target,
  Users,
} from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api, type ApiDashboardDepartments, type ApiDashboardTrendRow, type ApiUser } from "@/lib/api"

const PASS_TARGET = 75

function heatColor(value: number): string {
  if (value >= 80) return "bg-emerald-600 text-white"
  if (value >= 75) return "bg-emerald-300 text-emerald-950"
  if (value >= 60) return "bg-amber-300 text-amber-950"
  if (value >= 50) return "bg-orange-500 text-white"
  return "bg-red-600 text-white"
}

function statusFor(passRate: number) {
  if (passRate >= 80) return { label: "Tốt", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
  if (passRate >= PASS_TARGET) return { label: "Đạt", className: "border-sky-200 bg-sky-50 text-sky-700" }
  if (passRate >= 60) return { label: "Theo dõi", className: "border-amber-200 bg-amber-50 text-amber-700" }
  return { label: "Ưu tiên", className: "border-red-200 bg-red-50 text-red-700" }
}

function findComparison(trend: ApiDashboardTrendRow[], semesterCode: string) {
  if (trend.length === 0) return null
  const currentIndex = semesterCode === "all"
    ? trend.length - 1
    : trend.findIndex((item) => item.semester === semesterCode)
  if (currentIndex < 0) return null
  return {
    current: trend[currentIndex],
    previous: currentIndex > 0 ? trend[currentIndex - 1] : null,
  }
}

function sufficientlyCoveredTrend(trend: ApiDashboardTrendRow[]) {
  const coverageValues = trend.map((item) => item.department_count ?? 1)
  const maximumCoverage = Math.max(0, ...coverageValues)
  const minimumCoverage = Math.max(1, Math.ceil(maximumCoverage * 0.7))
  return trend.filter((item) => (item.department_count ?? maximumCoverage) >= minimumCoverage)
}

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span>Chưa có kỳ đối chiếu</span>
  const positive = value >= 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={positive ? "text-emerald-600" : "text-red-600"}>
      <Icon className="mr-0.5 inline h-3.5 w-3.5" />
      {positive ? "+" : ""}{value.toFixed(1)}{suffix} so với kỳ trước
    </span>
  )
}

export default function DepartmentsAnalyticsPage() {
  const [currentUser, setCurrentUser] = React.useState<ApiUser | null>(null)
  const [data, setData] = React.useState<ApiDashboardDepartments | null>(null)
  const [selSem, setSelSem] = React.useState("all")
  const [selDept, setSelDept] = React.useState("all")
  const [selProg, setSelProg] = React.useState("all")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const defaultSemesterResolved = React.useRef(false)

  React.useEffect(() => {
    api.me()
      .then((user) => {
        setCurrentUser(user)
        if ((user.role === "manager" || user.role === "lecturer") && user.department_id) {
          setSelDept(String(user.department_id))
        }
      })
      .catch(() => {
        setError("Không thể xác định phạm vi tài khoản.")
        setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    if (!currentUser) return
    const isScoped = currentUser.role === "manager" || currentUser.role === "lecturer"
    const effectiveDepartmentId = isScoped
      ? currentUser.department_id ?? undefined
      : selDept === "all" ? undefined : Number(selDept)

    if (isScoped && !effectiveDepartmentId) {
      setData(null)
      setError("Tài khoản chưa được gán khoa để xem phân tích.")
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError("")
    api.getDashboardDepartments({
      semester_code: selSem === "all" ? undefined : selSem,
      department_id: effectiveDepartmentId,
      program_id: selProg === "all" ? undefined : Number(selProg),
    })
      .then((response) => {
        if (!active) return
        setData(response)
        const coveredTrend = sufficientlyCoveredTrend(response.trend)
        if (!defaultSemesterResolved.current && coveredTrend.length > 0) {
          defaultSemesterResolved.current = true
          setSelSem(coveredTrend[coveredTrend.length - 1].semester)
        }
      })
      .catch(() => {
        if (!active) return
        setData(null)
        setError("Không thể tải dữ liệu phân tích khoa/ngành.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [currentUser, selSem, selDept, selProg])

  const isScoped = currentUser?.role === "manager" || currentUser?.role === "lecturer"
  const filteredPrograms = React.useMemo(() => {
    if (!data || selDept === "all") return []
    return data.programs.filter((program) => program.department_id === Number(selDept))
  }, [data, selDept])

  const orderedStats = React.useMemo(
    () => [...(data?.dept_stats ?? [])].sort((a, b) => a.pass_rate - b.pass_rate || b.student_count - a.student_count),
    [data],
  )
  const priorityDepartments = orderedStats.filter((item) => item.pass_rate < PASS_TARGET).slice(0, 5)
  const coveredTrend = React.useMemo(() => sufficientlyCoveredTrend(data?.trend ?? []), [data])
  const trendView = coveredTrend.slice(-8)
  const comparison = data ? findComparison(coveredTrend, selSem) : null
  const passDelta = comparison?.previous
    ? comparison.current.pass_rate - comparison.previous.pass_rate
    : null
  const gradeDelta = comparison?.previous
    ? comparison.current.avg_grade - comparison.previous.avg_grade
    : null

  const heatSemesters = React.useMemo(() => {
    if (!data) return []
    const semMap = new Map(data.heatmap.map((row) => [
      row.semester_id,
      { id: row.semester_id, code: row.semester, year: row.year, term: row.term },
    ]))
    return [...semMap.values()].sort((a, b) => a.year - b.year || a.term - b.term).slice(-8)
  }, [data])

  const heatRows = React.useMemo(() => {
    if (!data) return []
    const byDept = new Map<number, { id: number; dept: string }>()
    for (const item of data.heatmap) {
      byDept.set(item.department_id, { id: item.department_id, dept: item.department })
    }
    return [...byDept.values()].map((row) => ({
      ...row,
      cells: heatSemesters.map((semester) => (
        data.heatmap.find((item) => item.department_id === row.id && item.semester_id === semester.id)?.pass_rate ?? null
      )),
    }))
  }, [data, heatSemesters])

  if (loading && !data) {
    return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Đang tổng hợp dữ liệu khoa/ngành...</div>
  }

  if (error || !data) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{error || "Chưa có dữ liệu phân tích."}</div>
  }

  const selectedDeptName = data.departments.find((department) => String(department.id) === selDept)?.name
    ?? orderedStats.find((department) => String(department.id) === selDept)?.name
    ?? ""
  const selectedProgramName = filteredPrograms.find((program) => String(program.id) === selProg)?.name ?? ""
  const semesterLabel = selSem === "all"
    ? "Toàn bộ học kỳ"
    : data.semesters.find((semester) => semester.code === selSem)?.name ?? selSem

  const chooseDepartment = (departmentId: number) => {
    if (isScoped) return
    setSelDept(String(departmentId))
    setSelProg("all")
  }

  const courseAnalyticsHref = (courseId: number) => {
    const params = new URLSearchParams({ course_id: String(courseId), source: "departments" })
    if (selDept !== "all") params.set("department_id", selDept)
    if (selProg !== "all") params.set("program_id", selProg)
    return `/manager/analytics/courses?${params.toString()}`
  }

  const sectionAnalyticsHref = (sectionId: number) => {
    const params = new URLSearchParams({ section_id: String(sectionId), source: "departments" })
    return `/manager/analytics/sections?${params.toString()}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phân tích Khoa / Ngành</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Theo dõi chất lượng đào tạo, nhận diện đơn vị dưới mục tiêu và đi sâu tới môn học hoặc lớp cần can thiệp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selSem} onValueChange={(value) => setSelSem(value ?? "all")}>
            <SelectTrigger className="w-48"><span className="truncate">{semesterLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toàn bộ học kỳ</SelectItem>
              {[...data.semesters].reverse().map((semester) => (
                <SelectItem key={semester.id} value={semester.code}>{semester.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selDept}
            onValueChange={(value) => {
              setSelDept(value ?? "all")
              setSelProg("all")
            }}
            disabled={isScoped}
          >
            <SelectTrigger className="w-56">
              <span className="truncate">{selDept === "all" ? "Tất cả khoa" : selectedDeptName}</span>
            </SelectTrigger>
            <SelectContent>
              {!isScoped ? <SelectItem value="all">Tất cả khoa</SelectItem> : null}
              {data.departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selProg}
            onValueChange={(value) => setSelProg(value ?? "all")}
            disabled={selDept === "all"}
          >
            <SelectTrigger className="w-64">
              <span className="truncate">
                {selDept === "all" ? "Chọn khoa trước" : selProg === "all" ? "Tất cả ngành" : selectedProgramName}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ngành</SelectItem>
              {filteredPrograms.map((program) => (
                <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{semesterLabel}</Badge>
        <Badge variant="outline">{selDept === "all" ? `${orderedStats.length} khoa có dữ liệu` : selectedDeptName}</Badge>
        {selProg !== "all" ? <Badge variant="outline">{selectedProgramName}</Badge> : null}
        {loading ? <span>Đang cập nhật...</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between pb-5 pt-5">
            <div>
              <p className="text-xs text-muted-foreground">Sinh viên trong phạm vi</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{data.kpis.students.toLocaleString("vi-VN")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.kpis.completed_enrollments.toLocaleString("vi-VN")} lượt học đã có kết quả</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between pb-5 pt-5">
            <div>
              <p className="text-xs text-muted-foreground">Tỷ lệ đạt</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{data.kpis.pass_rate.toFixed(1)}%</p>
              <p className="mt-1 text-xs"><Delta value={passDelta} suffix="đ" /></p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between pb-5 pt-5">
            <div>
              <p className="text-xs text-muted-foreground">Điểm trung bình</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{data.kpis.avg_grade.toFixed(2)}</p>
              <p className="mt-1 text-xs"><Delta value={gradeDelta} /></p>
            </div>
            <GraduationCap className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between pb-5 pt-5">
            <div>
              <p className="text-xs text-muted-foreground">SV có học phần chưa đạt</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{data.kpis.at_risk_rate.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.kpis.at_risk.toLocaleString("vi-VN")} sinh viên trong phạm vi lọc</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Xu hướng 8 học kỳ gần nhất</CardTitle>
            <CardDescription>Tỷ lệ đạt dùng trục trái; điểm trung bình dùng trục phải. Học kỳ dưới 70% độ phủ khoa không đưa vào xu hướng.</CardDescription>
          </CardHeader>
          <CardContent>
            {trendView.length === 0 ? (
              <p className="py-20 text-center text-sm text-muted-foreground">Chưa có dữ liệu xu hướng.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendView} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="pass" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="grade" orientation="right" domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value, name) => [name === "Tỷ lệ đạt" ? `${value}%` : value, name]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine yAxisId="pass" y={PASS_TARGET} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Mục tiêu 75%", fontSize: 10 }} />
                  <Line yAxisId="pass" type="monotone" dataKey="pass_rate" name="Tỷ lệ đạt" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line yAxisId="grade" type="monotone" dataKey="avg_grade" name="Điểm TB" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-amber-600" />Ưu tiên can thiệp</CardTitle>
            <CardDescription>Khoa có tỷ lệ đạt dưới mục tiêu {PASS_TARGET}%.</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityDepartments.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-600" />
                <p className="text-sm font-medium">Tất cả khoa đạt mục tiêu</p>
              </div>
            ) : (
              <div className="space-y-4">
                {priorityDepartments.map((department, index) => (
                  <button
                    key={department.id}
                    type="button"
                    onClick={() => chooseDepartment(department.id)}
                    className="flex w-full items-center gap-3 rounded-md text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{department.short_name}</span>
                      <span className="text-xs text-muted-foreground">{department.student_count} SV · {department.at_risk_rate.toFixed(1)}% có HP chưa đạt</span>
                    </span>
                    <span className="font-semibold tabular-nums text-red-600">{department.pass_rate.toFixed(1)}%</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xếp hạng chất lượng theo khoa</CardTitle>
          <CardDescription>Sắp xếp từ tỷ lệ đạt thấp đến cao; chỉ gồm đơn vị có dữ liệu trong phạm vi lọc.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                <th className="px-5 py-3 text-left font-medium">Khoa</th>
                <th className="px-3 py-3 text-right font-medium">Sinh viên</th>
                <th className="px-3 py-3 text-right font-medium">Lượt học</th>
                <th className="w-52 px-3 py-3 text-left font-medium">Tỷ lệ đạt</th>
                <th className="px-3 py-3 text-right font-medium">Điểm TB</th>
                <th className="px-3 py-3 text-right font-medium">SV chưa đạt</th>
                <th className="px-5 py-3 text-right font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orderedStats.map((department) => {
                const status = statusFor(department.pass_rate)
                return (
                  <tr key={department.id} className="group hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => chooseDepartment(department.id)}
                        className="flex items-center gap-2 text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {department.short_name}
                        {!isScoped ? <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{department.student_count.toLocaleString("vi-VN")}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{department.enrollment_count.toLocaleString("vi-VN")}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={department.pass_rate >= PASS_TARGET ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-amber-500"}
                            style={{ width: `${Math.max(2, department.pass_rate)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-semibold tabular-nums">{department.pass_rate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{department.avg_grade.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-medium tabular-nums">{department.at_risk_rate.toFixed(1)}%</span>
                      <span className="ml-1 text-xs text-muted-foreground">({department.at_risk})</span>
                    </td>
                    <td className="px-5 py-3 text-right"><Badge variant="outline" className={status.className}>{status.label}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bản đồ tỷ lệ đạt theo học kỳ</CardTitle>
          <CardDescription>So sánh nhanh sự ổn định giữa các khoa trong tối đa 8 học kỳ gần nhất.</CardDescription>
          <div className="flex flex-wrap gap-3 pt-2 text-[11px] text-muted-foreground">
            {[
              ["bg-emerald-600", "≥ 80%"],
              ["bg-emerald-300", "75–79%"],
              ["bg-amber-300", "60–74%"],
              ["bg-orange-500", "50–59%"],
              ["bg-red-600", "< 50%"],
            ].map(([color, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {heatRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chưa có dữ liệu heatmap trong phạm vi lọc.</p>
          ) : (
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr>
                  <th className="w-48 pb-2 pr-3 text-left font-medium text-muted-foreground">Khoa</th>
                  {heatSemesters.map((semester) => (
                    <th key={semester.id} className="min-w-[68px] px-1 pb-2 text-center font-medium text-muted-foreground">{semester.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {heatRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-3">
                      <button type="button" onClick={() => chooseDepartment(row.id)} className="text-left font-medium hover:text-primary">{row.dept}</button>
                    </td>
                    {row.cells.map((value, index) => (
                      <td key={heatSemesters[index]?.id ?? index} className="px-1 py-2 text-center">
                        {value === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={`inline-flex min-w-[50px] items-center justify-center rounded px-1.5 py-1 font-semibold ${heatColor(value)}`}>{value.toFixed(0)}%</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {selDept !== "all" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Điểm cần hành động — {selectedDeptName}</h2>
            <p className="text-sm text-muted-foreground">Chỉ xếp hạng môn có ít nhất 20 kết quả và lớp có ít nhất 10 kết quả.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Môn có tỷ lệ chưa đạt cao</CardTitle>
                  <CardDescription>Bấm vào một môn để mở dashboard phân tích chi tiết.</CardDescription>
                </div>
                <Link href="/manager/analytics/courses" className="text-xs font-medium text-primary hover:underline">Xem phân tích môn</Link>
              </CardHeader>
              <CardContent>
                {data.drill_course_fail.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Không có môn đủ quy mô mẫu.</p>
                ) : (
                  <div className="space-y-3">
                    {data.drill_course_fail.slice(0, 6).map((course, index) => (
                      <Link
                        key={course.id}
                        href={courseAnalyticsHref(course.id)}
                        className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/20 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Mở phân tích môn ${course.name}`}
                      >
                        <span className="w-5 text-xs font-medium text-muted-foreground">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium group-hover:text-primary" title={course.name}>{course.name}</span>
                          <span className="text-xs text-muted-foreground">{course.failed}/{course.total} lượt chưa đạt</span>
                        </span>
                        <Badge variant={course.rate >= 40 ? "destructive" : "secondary"}>{course.rate.toFixed(1)}%</Badge>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Lớp có kết quả bất thường</CardTitle>
                  <CardDescription>Tỷ lệ chưa đạt cao hơn trung bình môn ít nhất 15 điểm %.</CardDescription>
                </div>
                <Link href="/manager/analytics/sections" className="text-xs font-medium text-primary hover:underline">Xem phân tích lớp</Link>
              </CardHeader>
              <CardContent className="p-0">
                {data.drill_section_abnormal.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">Không phát hiện lớp bất thường.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-y bg-muted/40 text-muted-foreground">
                        <th className="px-5 py-2 text-left font-medium">Lớp</th>
                        <th className="px-3 py-2 text-left font-medium">Môn</th>
                        <th className="px-3 py-2 text-right font-medium">Chưa đạt</th>
                        <th className="px-5 py-2 text-right font-medium">Chênh</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {data.drill_section_abnormal.slice(0, 6).map((section) => (
                          <tr key={section.id} className="group hover:bg-primary/5">
                            <td className="px-5 py-2.5 font-mono">
                              <Link href={sectionAnalyticsHref(section.id)} className="inline-flex items-center gap-1.5 font-medium hover:text-primary">
                                {section.code}
                                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                              </Link>
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-2.5" title={section.course_name}>{section.course_name}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-red-600">{section.fail_rate.toFixed(1)}%</td>
                            <td className="px-5 py-2.5 text-right font-medium">+{section.diff.toFixed(1)}đ</td>
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
        <div className="rounded-lg border border-dashed px-6 py-5 text-center text-sm text-muted-foreground">
          Chọn một khoa trong bảng xếp hạng hoặc heatmap để xem môn học và lớp cần hành động.
        </div>
      )}

      <div className="text-right">
        <Link href="/manager/analytics" className="text-sm font-medium text-primary hover:underline">Quay lại tổng quan</Link>
      </div>
    </div>
  )
}
