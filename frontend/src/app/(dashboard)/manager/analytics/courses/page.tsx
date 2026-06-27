"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, BookOpen, CheckCircle2, TrendingUp, Users } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api, type ApiDashboardCourses } from "@/lib/api"

const GRADE_COLORS: Record<string, string> = {
  "Trượt nặng": "#ef4444",
  "Cận trượt": "#f97316",
  "Trung bình": "#f59e0b",
  "Khá": "#22c55e",
  "Tốt": "#10b981",
}

function dateStartIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function dateEndIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

function routeValue(value: string) {
  return value === "all" ? undefined : Number(value)
}

function sectionHref(sectionId: number, courseId: number, semesterCode: string) {
  const params = new URLSearchParams({
    section_id: String(sectionId),
    course_id: String(courseId),
    semester_code: semesterCode,
    source: "courses",
  })
  return `/manager/analytics/sections?${params.toString()}`
}

export default function CourseAnalyticsPage() {
  const searchParams = useSearchParams()
  const [data, setData] = React.useState<ApiDashboardCourses | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [selDept, setSelDept] = React.useState("all")
  const [selProg, setSelProg] = React.useState("all")
  const [selCourse, setSelCourse] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

  React.useEffect(() => {
    const queryCourse = searchParams.get("course_id") ?? searchParams.get("course")
    const queryProgram = searchParams.get("program_id") ?? searchParams.get("program")
    const queryDepartment = searchParams.get("department_id") ?? searchParams.get("department")
    if (queryDepartment) setSelDept(queryDepartment)
    if (queryProgram) setSelProg(queryProgram)
    if (queryCourse) setSelCourse(queryCourse)
  }, [searchParams])

  React.useEffect(() => {
    const params = {
      department_id: routeValue(selDept),
      program_id: routeValue(selProg),
      date_from: dateStartIso(dateFrom),
      date_to: dateEndIso(dateTo),
    }
    const parsedCourseId = Number(selCourse)
    const request = selCourse !== "all" && Number.isFinite(parsedCourseId)
      ? api.getDashboardCourse(parsedCourseId, params)
      : api.getDashboardCourses(params)

    let active = true
    setIsLoading(true)
    request
      .then((response) => {
        if (active) setData(response)
      })
      .catch((requestError) => {
        if (active) console.error(requestError)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [selDept, selProg, selCourse, dateFrom, dateTo])

  const filteredPrograms = React.useMemo(() => {
    if (!data) return []
    if (selDept === "all") return data.programs
    return data.programs.filter((program) => program.department_id === Number(selDept))
  }, [data, selDept])

  const courseRows = React.useMemo(() => data?.course_rows ?? [], [data])
  const selectedCourse = data?.selected_course?.course ?? courseRows.find((course) => course.id === Number(selCourse))
  const selectedCourseLabel = selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : "Chưa chọn môn"
  const selectedDeptName = data?.departments.find((department) => String(department.id) === selDept)?.name ?? "Tất cả khoa"
  const selectedProgramName = data?.programs.find((program) => String(program.id) === selProg)?.name ?? "Tất cả ngành"

  const courseOverview = React.useMemo(() => {
    const scatterData = courseRows.map((course) => ({
      ...course,
      passRate: course.pass_rate,
      cloRate: course.clo_attainment_rate * 100,
      health: course.health_score,
      fill: course.health_score >= 75 ? "#22c55e" : course.health_score >= 55 ? "#f59e0b" : "#ef4444",
    }))
    const sorted = [...scatterData].sort((a, b) => b.health_score - a.health_score)
    return {
      scatterData,
      top5: sorted.slice(0, 5),
      bottom5: [...scatterData].sort((a, b) => a.health_score - b.health_score).slice(0, 5),
    }
  }, [courseRows])

  const courseStats = React.useMemo(() => {
    const selected = data?.selected_course
    if (!selected) return null
    const trend = selected.trend.map((row) => ({
      hk: row.semester,
      passRate: row.pass_rate,
      avgGrade: row.avg_grade,
      count: row.count,
    }))
    const dist = selected.grade_distribution.map((row) => ({
      label: row.name,
      count: row.value,
      color: GRADE_COLORS[row.name] ?? "#94a3b8",
    }))
    const maxFailRate = trend.length ? Math.max(...trend.map((row) => 100 - row.passRate)) : 0
    const latest = trend.at(-1)
    const previous = trend.at(-2)
    return {
      ...selected,
      trend,
      dist,
      maxFailRate,
      passDelta: latest && previous ? +(latest.passRate - previous.passRate).toFixed(1) : null,
      gradeDelta: latest && previous ? +(latest.avgGrade - previous.avgGrade).toFixed(2) : null,
    }
  }, [data])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Phân tích Môn học</h1>
        <p className="text-sm text-muted-foreground">Phân tích sâu môn học bằng dữ liệu tổng hợp từ DWH</p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">1</span>
              <Select value={selDept} onValueChange={(value) => { setSelDept(value ?? "all"); setSelProg("all"); setSelCourse("all") }}>
                <SelectTrigger className="w-48">
                  <span className="truncate">{selectedDeptName}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả khoa</SelectItem>
                  {data?.departments.map((department) => (
                    <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">2</span>
              <Select value={selProg} onValueChange={(value) => { setSelProg(value ?? "all"); setSelCourse("all") }} disabled={selDept === "all"}>
                <SelectTrigger className="w-52">
                  <span className="truncate">{selectedProgramName}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả ngành</SelectItem>
                  {filteredPrograms.map((program) => (
                    <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">3</span>
              <Select value={selCourse} onValueChange={(value) => setSelCourse(value ?? "all")}>
                <SelectTrigger className="w-64">
                  <span className="truncate">{selectedCourseLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả môn học</SelectItem>
                  {courseRows.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>{course.code} - {course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" aria-label="Từ ngày" />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" aria-label="Đến ngày" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Khoa: {selectedDeptName}</Badge>
            <Badge variant="outline">Ngành: {selectedProgramName}</Badge>
            <Badge variant="outline">Môn: {selectedCourseLabel}</Badge>
            <Badge variant="outline">Thời gian: {dateFrom || "đầu dữ liệu"} - {dateTo || "hiện tại"}</Badge>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Đang tải phân tích môn học...</div>
      )}

      {!isLoading && selCourse === "all" ? (
        courseRows.length > 0 ? (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div>
              <h2 className="text-lg font-semibold">
                Tổng quan {selProg !== "all" ? `Ngành: ${selectedProgramName}` : selDept !== "all" ? `Khoa: ${selectedDeptName}` : "Toàn trường"}
              </h2>
              <p className="text-sm text-muted-foreground">Phân tích tương quan {courseRows.length} môn học từ DWH</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Tương quan tỷ lệ đạt & CLO</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="passRate" name="Tỷ lệ đạt" unit="%" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="number" dataKey="cloRate" name="CLO" unit="%" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <ZAxis type="number" range={[60, 60]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const row = payload[0].payload
                          return (
                            <div className="bg-background border rounded-md shadow-md p-3 text-sm">
                              <p className="font-semibold">{row.code} - {row.name}</p>
                              <p className="text-muted-foreground mt-1">Health: <span className="font-medium text-foreground">{row.health_score}</span></p>
                              <p className="text-muted-foreground">Tỷ lệ đạt: <span className="font-medium text-foreground">{row.pass_rate.toFixed(1)}%</span></p>
                              <p className="text-muted-foreground">CLO: <span className="font-medium text-foreground">{(row.clo_attainment_rate * 100).toFixed(1)}%</span></p>
                            </div>
                          )
                        }}
                      />
                      <Scatter data={courseOverview.scatterData} fill="#8884d8">
                        {courseOverview.scatterData.map((entry) => (
                          <Cell key={entry.id} fill={entry.fill} onClick={() => setSelCourse(String(entry.id))} className="cursor-pointer" />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4">
                <CourseRankCard
                  title="Top 5 môn học tốt nhất"
                  rows={courseOverview.top5}
                  tone="good"
                  onSelect={(id) => setSelCourse(String(id))}
                />
                <CourseRankCard
                  title="Cảnh báo: Top 5 môn học cần chú ý"
                  rows={courseOverview.bottom5}
                  tone="bad"
                  onSelect={(id) => setSelCourse(String(id))}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
            <BookOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm">Không có dữ liệu môn học trong phạm vi đang chọn.</p>
          </div>
        )
      ) : null}

      {!isLoading && selCourse !== "all" && courseStats ? (
        <>
          <div>
            <h2 className="text-lg font-semibold">{selectedCourseLabel}</h2>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 text-sm">
              <span className="font-medium">Phạm vi phân tích:</span> hệ thống đang dùng aggregate DWH cho môn này
              {` (${courseStats.kpis.section_count} lớp, ${courseStats.kpis.completed_enrollments} lượt học hợp lệ).`}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Tổng lượt học", value: courseStats.kpis.completed_enrollments, icon: <Users className="h-5 w-5 text-muted-foreground" /> },
              {
                label: "Tỷ lệ đạt tổng hợp",
                value: `${courseStats.kpis.pass_rate.toFixed(1)}%`,
                icon: <CheckCircle2 className={`h-5 w-5 ${courseStats.kpis.pass_rate >= 70 ? "text-emerald-500" : "text-destructive"}`} />,
              },
              { label: "Điểm trung bình", value: courseStats.kpis.avg_grade.toFixed(2), icon: <TrendingUp className="h-5 w-5 text-muted-foreground" /> },
              { label: "Số lớp học phần", value: courseStats.kpis.section_count, icon: <BookOpen className="h-5 w-5 text-muted-foreground" /> },
              {
                label: "Fail rate cao nhất",
                value: `${courseStats.maxFailRate.toFixed(0)}%`,
                icon: <AlertTriangle className={`h-5 w-5 ${courseStats.maxFailRate > 40 ? "text-destructive" : "text-muted-foreground"}`} />,
                alert: courseStats.maxFailRate > 40 ? "> 40%" : null,
              },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground leading-tight">{kpi.label}</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">{kpi.value}</p>
                      {"alert" in kpi && kpi.alert ? (
                        <Badge variant="destructive" className="mt-1 text-[10px] h-4 px-1.5">{kpi.alert}</Badge>
                      ) : null}
                    </div>
                    <div className="shrink-0 mt-0.5">{kpi.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-semibold">Tỷ lệ đạt theo học kỳ</CardTitle>
                  {courseStats.passDelta !== null ? (
                    <Badge variant={courseStats.passDelta >= 0 ? "secondary" : "destructive"}>
                      {courseStats.passDelta > 0 ? "+" : ""}{courseStats.passDelta} điểm % so với kỳ trước
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Đường chuẩn 70%; cột đỏ là học kỳ dưới chuẩn.</p>
              </CardHeader>
              <CardContent>
                {courseStats.trend.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={courseStats.trend} margin={{ left: 0, right: 8, top: 12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 70, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} width={38} />
                        <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="5 4" />
                        <Tooltip
                          formatter={(value, name, item) => [
                            name === "passRate" ? `${Number(value).toFixed(1)}%` : value,
                            name === "passRate" ? `Tỷ lệ đạt · ${item.payload.count} lượt` : name,
                          ]}
                          labelFormatter={(label) => `Học kỳ ${label}`}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar dataKey="passRate" radius={[5, 5, 0, 0]} maxBarSize={64}>
                          {courseStats.trend.map((row) => (
                            <Cell key={row.hk} fill={row.passRate >= 70 ? "#22c55e" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {courseStats.trend.length === 1 ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">Mới có một học kỳ; chưa đủ dữ liệu để kết luận xu hướng.</p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Chưa có dữ liệu tỷ lệ đạt theo học kỳ.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-semibold">Điểm trung bình theo học kỳ</CardTitle>
                  {courseStats.gradeDelta !== null ? (
                    <Badge variant={courseStats.gradeDelta >= 0 ? "secondary" : "destructive"}>
                      {courseStats.gradeDelta > 0 ? "+" : ""}{courseStats.gradeDelta} so với kỳ trước
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Thang điểm 10; đường đỏ là ngưỡng đạt 5.0.</p>
              </CardHeader>
              <CardContent>
                {courseStats.trend.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={courseStats.trend} margin={{ left: 0, right: 8, top: 12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 10]} ticks={[0, 2.5, 5, 7.5, 10]} tick={{ fontSize: 10 }} width={30} />
                        <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="5 4" />
                        <Tooltip
                          formatter={(value, name, item) => [
                            Number(value).toFixed(2),
                            name === "avgGrade" ? `Điểm TB · ${item.payload.count} lượt` : name,
                          ]}
                          labelFormatter={(label) => `Học kỳ ${label}`}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar dataKey="avgGrade" radius={[5, 5, 0, 0]} maxBarSize={64}>
                          {courseStats.trend.map((row) => (
                            <Cell key={row.hk} fill={row.avgGrade >= 5 ? "#6366f1" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {courseStats.trend.length === 1 ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">Mới có một học kỳ; cột thể hiện mức hiện tại, không phải xu hướng.</p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Chưa có dữ liệu điểm trung bình theo học kỳ.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Phân bổ điểm tổng hợp</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={courseStats.dist} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => [value, "SV"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {courseStats.dist.map((row) => <Cell key={row.label} fill={row.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Chi tiết các lớp học phần</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Mã lớp</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Học kỳ</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">SV</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Tỷ lệ đạt</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">So TB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {courseStats.section_rows.map((section) => (
                        <tr key={section.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2 font-mono text-[11px]">
                            <Link
                              href={sectionHref(section.id, courseStats.course.id, section.semester_code)}
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {section.section_code}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{section.semester_name || section.semester_code}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{section.completed_enrollments}</td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant={section.pass_rate >= 70 ? "secondary" : "destructive"} className="text-[10px]">{section.pass_rate}%</Badge>
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums font-medium ${section.pass_rate_diff < -15 ? "text-destructive" : section.pass_rate_diff > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {section.pass_rate_diff > 0 ? "+" : ""}{section.pass_rate_diff}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

function CourseRankCard({
  title,
  rows,
  tone,
  onSelect,
}: {
  title: string
  rows: ApiDashboardCourses["course_rows"]
  tone: "good" | "bad"
  onSelect: (id: number) => void
}) {
  const good = tone === "good"
  return (
    <Card className={`flex-1 ${good ? "border-emerald-200/50 bg-emerald-50/10" : "border-rose-200/50 bg-rose-50/10"}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-semibold ${good ? "text-emerald-800" : "text-rose-800"}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <tbody className="divide-y">
            {rows.map((course) => (
              <tr key={course.id} className="cursor-pointer hover:bg-muted/20" onClick={() => onSelect(course.id)}>
                <td className="px-4 py-2.5 font-medium">{course.code}</td>
                <td className="px-2 py-2.5 truncate max-w-[150px]">{course.name}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${good ? "text-emerald-600" : "text-rose-600"}`}>{course.health_score}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="text-center py-4 text-muted-foreground italic">Chưa có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
