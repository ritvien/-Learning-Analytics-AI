"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, AlertTriangle, BookOpen, CheckCircle2, Search, SlidersHorizontal, TrendingUp, Users, X } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api, type ApiCourse, type ApiDashboardCourses, type ApiUser } from "@/lib/api"

const GRADE_COLORS: Record<string, string> = {
  "Trượt nặng": "#ef4444",
  "Cận trượt": "#f97316",
  "Trung bình": "#f59e0b",
  "Khá": "#22c55e",
  "Tốt": "#10b981",
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
  const [currentUser, setCurrentUser] = React.useState<ApiUser | null>(null)
  const [data, setData] = React.useState<ApiDashboardCourses | null>(null)
  const [courseOptions, setCourseOptions] = React.useState<ApiCourse[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [requestError, setRequestError] = React.useState("")
  const [selSemester, setSelSemester] = React.useState(searchParams.get("semester_code") ?? "")
  const [selDept, setSelDept] = React.useState(searchParams.get("department_id") ?? searchParams.get("department") ?? "all")
  const [selProg, setSelProg] = React.useState(searchParams.get("program_id") ?? searchParams.get("program") ?? "all")
  const [selCourse, setSelCourse] = React.useState(searchParams.get("course_id") ?? searchParams.get("course") ?? "all")
  const [courseQuery, setCourseQuery] = React.useState("")
  const [trendRange, setTrendRange] = React.useState("6")
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  React.useEffect(() => {
    let active = true
    Promise.all([api.me(), api.getCourses({ limit: 2000 })])
      .then(([user, courses]) => {
        if (!active) return
        const isScoped = user.role === "manager" || user.role === "lecturer"
        if (isScoped) {
          setSelDept(user.department_id ? String(user.department_id) : "all")
          setSelProg("all")
          setSelCourse("all")
          setCourseQuery("")
        }
        setCourseOptions(courses)
        setCurrentUser(user)
      })
      .catch(() => {
        if (!active) return
        setCourseOptions([])
        setRequestError("Không thể xác định phạm vi tài khoản.")
        setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    if (!currentUser) return
    const isScoped = currentUser.role === "manager" || currentUser.role === "lecturer"
    const scopedDepartmentId = isScoped ? currentUser.department_id ?? undefined : undefined
    if (isScoped && !scopedDepartmentId) {
      setData(null)
      setRequestError("Tài khoản chưa được gán khoa để xem phân tích môn học.")
      setIsLoading(false)
      return
    }
    const params = {
      semester_code: selSemester && selSemester !== "all" ? selSemester : undefined,
      department_id: scopedDepartmentId ?? routeValue(selDept),
      program_id: routeValue(selProg),
    }
    const parsedCourseId = Number(selCourse)
    const request = selCourse !== "all" && Number.isFinite(parsedCourseId)
      ? api.getDashboardCourse(parsedCourseId, params)
      : api.getDashboardCourses(params)

    let active = true
    setIsLoading(true)
    setRequestError("")
    request
      .then((response) => {
        if (active) setData(response)
      })
      .catch((requestError) => {
        if (active) {
          const isForbidden = requestError instanceof Error && requestError.message.includes("API 403")
          setRequestError(isForbidden
            ? "Bộ lọc nằm ngoài phạm vi tài khoản. Hệ thống đã đưa về khoa được cấp quyền."
            : "Không thể tải dữ liệu phân tích. Vui lòng thử lại hoặc đổi bộ lọc.")
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentUser, selDept, selProg, selCourse, selSemester])

  const isScoped = currentUser?.role === "manager" || currentUser?.role === "lecturer"

  const latestSemester = React.useMemo(() => {
    if (!data?.semesters.length) return null
    const maxCompleted = Math.max(...data.semesters.map((semester) => semester.completed_enrollments))
    const representativeThreshold = Math.max(20, maxCompleted * 0.25)
    const representativeSemesters = data.semesters.filter(
      (semester) => semester.completed_enrollments >= representativeThreshold,
    )
    return [...(representativeSemesters.length ? representativeSemesters : data.semesters)]
      .sort((a, b) => b.year - a.year || b.term - a.term)[0]
  }, [data])

  React.useEffect(() => {
    if (!selSemester && latestSemester) setSelSemester(latestSemester.code)
  }, [latestSemester, selSemester])

  React.useEffect(() => {
    if (!selSemester) return
    const params = new URLSearchParams(searchParams.toString())
    for (const alias of ["course", "program", "department"]) params.delete(alias)
    const syncParam = (key: string, value: string) => {
      if (value && value !== "all") params.set(key, value)
      else params.delete(key)
    }
    syncParam("semester_code", selSemester)
    syncParam("department_id", selDept)
    syncParam("program_id", selProg)
    syncParam("course_id", selCourse)
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) window.history.replaceState(null, "", nextUrl)
  }, [searchParams, selCourse, selDept, selProg, selSemester])

  const filteredPrograms = React.useMemo(() => {
    if (!data) return []
    if (selDept === "all") return data.programs
    return data.programs.filter((program) => program.department_id === Number(selDept))
  }, [data, selDept])

  const filteredCourseOptions = React.useMemo(() => {
    const departmentProgramIds = new Set(
      (data?.programs ?? [])
        .filter((program) => program.department_id === Number(selDept))
        .map((program) => program.id),
    )
    return courseOptions.filter((course) => {
      if (
        selDept !== "all"
        && course.department_id !== Number(selDept)
        && !course.program_ids.some((programId) => departmentProgramIds.has(programId))
      ) return false
      if (selProg !== "all" && !course.program_ids.includes(Number(selProg))) return false
      return true
    })
  }, [courseOptions, data, selDept, selProg])

  const courseSuggestions = React.useMemo(() => {
    const normalized = courseQuery.trim().toLocaleLowerCase("vi")
    if (!normalized) return []
    return filteredCourseOptions
      .filter((course) => `${course.code} ${course.name}`.toLocaleLowerCase("vi").includes(normalized))
      .slice(0, 8)
  }, [courseQuery, filteredCourseOptions])

  const courseRows = React.useMemo(() => data?.course_rows ?? [], [data])
  const selectedCourse = data?.selected_course?.course
    ?? filteredCourseOptions.find((course) => course.id === Number(selCourse))
    ?? courseRows.find((course) => course.id === Number(selCourse))
  const selectedCourseLabel = selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : "Tất cả môn học"
  const selectedDeptName = data?.departments.find((department) => String(department.id) === selDept)?.name ?? "Tất cả khoa"
  const selectedProgramName = data?.programs.find((program) => String(program.id) === selProg)?.name ?? "Tất cả ngành"

  React.useEffect(() => {
    if (selectedCourse && selCourse !== "all") {
      setCourseQuery(`${selectedCourse.code} - ${selectedCourse.name}`)
    }
  }, [selCourse, selectedCourse])

  const courseOverview = React.useMemo(() => {
    const readyRows = courseRows.filter((course) => course.data_status === "ready" && course.health_score !== null && course.clo_attainment_rate !== null)
    const totalEnrollments = courseRows.reduce((sum, course) => sum + course.completed_enrollments, 0)
    const weightedPassRate = totalEnrollments
      ? courseRows.reduce((sum, course) => sum + course.pass_rate * course.completed_enrollments, 0) / totalEnrollments
      : 0
    return {
      readyCount: readyRows.length,
      totalEnrollments,
      weightedPassRate,
      belowPassTarget: courseRows.filter((course) => course.completed_enrollments >= 20 && course.pass_rate < 70).length,
      belowCloTarget: readyRows.filter((course) => (course.clo_attainment_rate ?? 1) < 0.7).length,
      comparisonRows: [...courseRows]
        .filter((course) => course.completed_enrollments >= 20)
        .sort((a, b) => a.pass_rate - b.pass_rate)
        .slice(0, 12)
        .map((course) => ({ ...course, label: course.code, passRate: course.pass_rate })),
      priorityRows: [...readyRows].sort((a, b) => (a.health_score ?? 101) - (b.health_score ?? 101)).slice(0, 8),
      insufficientCount: courseRows.filter((course) => course.data_status === "insufficient_sample").length,
      missingCloCount: courseRows.filter((course) => course.data_status === "missing_clo").length,
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
      failedCount: row.failed_count ?? 0,
      nearFailCount: row.near_fail_count ?? 0,
    }))
    const trendLimit = trendRange === "all" ? trend.length : Number(trendRange)
    const visibleTrend = trend.slice(-trendLimit)
    const visibleSemesters = new Set(visibleTrend.map((row) => row.hk))
    const dist = selected.grade_distribution.map((row) => ({
      label: row.name,
      count: row.value,
      color: GRADE_COLORS[row.name] ?? "#94a3b8",
    }))
    const cloRows = selected.clo_rows.map((row) => ({
      ...row,
      label: row.code,
      attainmentRate: row.attainment_rate,
    }))
    const maxFailRate = trend.length ? Math.max(...trend.map((row) => 100 - row.passRate)) : 0
    const selectedTrendIndex = selSemester !== "all" ? trend.findIndex((row) => row.hk === selSemester) : trend.length - 1
    const comparisonIndex = selectedTrendIndex >= 0 ? selectedTrendIndex : trend.length - 1
    const latest = trend[comparisonIndex]
    const previous = trend[comparisonIndex - 1]
    const maxFailSemester = trend.find((row) => 100 - row.passRate === maxFailRate)?.hk ?? null
    return {
      ...selected,
      trend,
      visibleTrend,
      cloTrend: selected.clo_trend.filter((row) => visibleSemesters.has(row.semester)),
      dist,
      cloRows,
      maxFailRate,
      maxFailSemester,
      passDelta: latest && previous ? +(latest.passRate - previous.passRate).toFixed(1) : null,
      gradeDelta: latest && previous ? +(latest.avgGrade - previous.avgGrade).toFixed(2) : null,
      belowTargetSections: selected.section_rows.filter((section) => section.pass_rate < 70).length,
    }
  }, [data, selSemester, trendRange])

  function selectCourse(course: { id: number; code: string; name: string }) {
    setSelCourse(String(course.id))
    setCourseQuery(`${course.code} - ${course.name}`)
  }

  function resetFilters() {
    setSelSemester(latestSemester?.code ?? "all")
    setSelDept(isScoped && currentUser?.department_id ? String(currentUser.department_id) : "all")
    setSelProg("all")
    setSelCourse("all")
    setCourseQuery("")
    setTrendRange("6")
    setShowAdvanced(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Phân tích Môn học</h1>
        <p className="text-sm text-muted-foreground">Phân tích sâu môn học bằng dữ liệu tổng hợp từ DWH</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-start gap-3">
            <Select value={selDept} disabled={isScoped} onValueChange={(value) => { setSelDept(value ?? "all"); setSelProg("all"); setSelCourse("all"); setCourseQuery("") }}>
              <SelectTrigger className="w-56" aria-label="Khoa">
                <span className="truncate">{selectedDeptName}</span>
              </SelectTrigger>
              <SelectContent>
                {!isScoped ? <SelectItem value="all">Tất cả khoa</SelectItem> : null}
                {data?.departments.map((department) => (
                  <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative min-w-[260px] flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={courseQuery}
                onChange={(event) => setCourseQuery(event.target.value)}
                placeholder="Chọn môn theo mã hoặc tên..."
                className="pl-9 pr-9"
                aria-label="Tìm môn học"
              />
              {courseQuery ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Xóa môn đang tìm"
                  onClick={() => { setCourseQuery(""); setSelCourse("all") }}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              {courseSuggestions.length > 0 && courseQuery !== selectedCourseLabel ? (
                <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                  {courseSuggestions.map((course) => (
                    <button key={course.id} type="button" className="flex w-full items-start gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => selectCourse(course)}>
                      <span className="shrink-0 font-mono text-xs font-semibold text-primary">{course.code}</span>
                      <span className="line-clamp-2">{course.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <Select value={selSemester || "all"} onValueChange={(value) => setSelSemester(value ?? "all")}>
              <SelectTrigger className="w-48" aria-label="Kỳ KPI">
                <span className="truncate">
                  {selSemester === "all"
                    ? "Tất cả học kỳ"
                    : data?.semesters.find((semester) => semester.code === selSemester)?.name ?? "Đang xác định học kỳ..."}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả học kỳ</SelectItem>
                {[...(data?.semesters ?? [])]
                  .sort((a, b) => b.year - a.year || b.term - a.term)
                  .map((semester) => (
                    <SelectItem key={semester.id} value={semester.code}>{semester.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={trendRange} onValueChange={(value) => setTrendRange(value ?? "6")}>
              <SelectTrigger className="w-36" aria-label="Khoảng theo dõi">
                <span>{trendRange === "all" ? "Toàn bộ kỳ" : `${trendRange} kỳ gần nhất`}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 kỳ gần nhất</SelectItem>
                <SelectItem value="12">12 kỳ gần nhất</SelectItem>
                <SelectItem value="all">Toàn bộ kỳ</SelectItem>
              </SelectContent>
            </Select>

            <Button type="button" variant={showAdvanced ? "secondary" : "outline"} onClick={() => setShowAdvanced((value) => !value)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Bộ lọc nâng cao
            </Button>
            <Button type="button" variant="ghost" onClick={resetFilters}>Đặt lại</Button>
          </div>

          {showAdvanced ? (
            <div className="mt-4 max-w-sm border-t pt-4">
              <Select value={selProg} onValueChange={(value) => { setSelProg(value ?? "all"); setSelCourse("all"); setCourseQuery("") }} disabled={selDept === "all"}>
                <SelectTrigger aria-label="Ngành">
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
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Học kỳ: {selSemester === "all" ? "Tất cả" : data?.semesters.find((semester) => semester.code === selSemester)?.name ?? selSemester}</Badge>
            <Badge variant="outline">Khoa: {selectedDeptName}</Badge>
            <Badge variant="outline">Ngành: {selectedProgramName}</Badge>
            <Badge variant="outline">Môn: {selectedCourseLabel}</Badge>
            <Badge variant="outline">Theo dõi: {trendRange === "all" ? "Toàn bộ kỳ" : `${trendRange} kỳ gần nhất`}</Badge>
          </div>
        </CardContent>
      </Card>

      {requestError ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {requestError}
        </div>
      ) : null}

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
              {courseOverview.insufficientCount > 0 || courseOverview.missingCloCount > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  Không xếp hạng {courseOverview.insufficientCount} môn có dưới 20 lượt học và {courseOverview.missingCloCount} môn chưa có minh chứng CLO.
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                ["Môn đủ dữ liệu", courseOverview.readyCount.toLocaleString("vi-VN")],
                ["Pass rate có trọng số", `${courseOverview.weightedPassRate.toFixed(1)}%`],
                ["Môn dưới chuẩn 70%", courseOverview.belowPassTarget.toLocaleString("vi-VN")],
                ["Môn CLO dưới chuẩn", courseOverview.belowCloTarget.toLocaleString("vi-VN")],
                ["Tổng lượt học", courseOverview.totalEnrollments.toLocaleString("vi-VN")],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Các môn có tỷ lệ đạt thấp nhất</CardTitle>
                  <p className="text-xs text-muted-foreground">Chỉ so sánh môn có ít nhất 20 lượt học trong phạm vi đang chọn.</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={courseOverview.comparisonRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 10 }} />
                      <ReferenceLine x={70} stroke="#f59e0b" strokeDasharray="5 4" />
                      <Tooltip
                        formatter={(value, _name, item) => [`${Number(value).toFixed(1)}%`, `${item.payload.name} · ${item.payload.completed_enrollments} lượt`]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="passRate" radius={[0, 5, 5, 0]} maxBarSize={18}>
                        {courseOverview.comparisonRows.map((entry) => (
                          <Cell key={entry.id} fill={entry.pass_rate < 70 ? "#dc2626" : "#16a34a"} onClick={() => selectCourse(entry)} className="cursor-pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <CoursePriorityCard rows={courseOverview.priorityRows} onSelect={selectCourse} />
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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Lượt học trong kỳ", value: courseStats.kpis.completed_enrollments, icon: <Users className="h-5 w-5 text-muted-foreground" /> },
              {
                label: "Tỷ lệ đạt",
                value: `${courseStats.kpis.pass_rate.toFixed(1)}%`,
                icon: <CheckCircle2 className={`h-5 w-5 ${courseStats.kpis.pass_rate >= 70 ? "text-emerald-500" : "text-destructive"}`} />,
                note: courseStats.passDelta === null ? null : `${courseStats.passDelta > 0 ? "+" : ""}${courseStats.passDelta} điểm %`,
              },
              {
                label: "Điểm trung bình",
                value: courseStats.kpis.avg_grade.toFixed(2),
                icon: <TrendingUp className="h-5 w-5 text-muted-foreground" />,
                note: courseStats.gradeDelta === null ? null : `${courseStats.gradeDelta > 0 ? "+" : ""}${courseStats.gradeDelta} điểm`,
              },
              { label: "Trượt / cận trượt", value: `${courseStats.kpis.failed_count} / ${courseStats.kpis.near_fail_count}`, icon: <AlertTriangle className="h-5 w-5 text-amber-600" /> },
              { label: "CLO đạt chuẩn", value: courseStats.kpis.clo_attainment_rate === null ? "—" : `${(courseStats.kpis.clo_attainment_rate * 100).toFixed(1)}%`, icon: <CheckCircle2 className="h-5 w-5 text-violet-600" /> },
              { label: "Lớp dưới chuẩn", value: courseStats.belowTargetSections, icon: <BookOpen className="h-5 w-5 text-destructive" /> },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground leading-tight">{kpi.label}</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">{kpi.value}</p>
                      {"note" in kpi && kpi.note ? (
                        <p className={`mt-1 text-[11px] ${kpi.note.startsWith("-") ? "text-destructive" : "text-emerald-600"}`}>{kpi.note} so với kỳ trước</p>
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
                <p className="text-xs text-muted-foreground">Đường chuẩn 70%; kỳ dùng cho KPI được đánh dấu bằng đường dọc.</p>
              </CardHeader>
              <CardContent>
                {courseStats.visibleTrend.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={courseStats.visibleTrend} margin={{ left: 0, right: 8, top: 12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 70, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} width={38} />
                        <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="5 4" />
                        {selSemester !== "all" ? <ReferenceLine x={selSemester} stroke="#6366f1" strokeDasharray="3 3" /> : null}
                        <Tooltip
                          formatter={(value, name, item) => [
                            name === "passRate" ? `${Number(value).toFixed(1)}%` : value,
                            name === "passRate" ? `Tỷ lệ đạt · ${item.payload.count} lượt` : name,
                          ]}
                          labelFormatter={(label) => `Học kỳ ${label}`}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Line type="monotone" dataKey="passRate" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    {courseStats.visibleTrend.length === 1 ? (
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
                {courseStats.visibleTrend.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={courseStats.visibleTrend} margin={{ left: 0, right: 8, top: 12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 10]} ticks={[0, 2.5, 5, 7.5, 10]} tick={{ fontSize: 10 }} width={30} />
                        <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="5 4" />
                        {selSemester !== "all" ? <ReferenceLine x={selSemester} stroke="#6366f1" strokeDasharray="3 3" /> : null}
                        <Tooltip
                          formatter={(value, name, item) => [
                            Number(value).toFixed(2),
                            name === "avgGrade" ? `Điểm TB · ${item.payload.count} lượt` : name,
                          ]}
                          labelFormatter={(label) => `Học kỳ ${label}`}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Line type="monotone" dataKey="avgGrade" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    {courseStats.visibleTrend.length === 1 ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">Mới có một học kỳ; chưa đủ dữ liệu để kết luận xu hướng.</p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Chưa có dữ liệu điểm trung bình theo học kỳ.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Quy mô lượt học theo học kỳ</CardTitle>
                <p className="text-xs text-muted-foreground">Dùng để kiểm tra biến động KPI có đi cùng thay đổi cỡ mẫu hay không.</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={courseStats.visibleTrend} margin={{ left: 0, right: 8, top: 12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
                    <Tooltip formatter={(value) => [value, "Lượt học"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[5, 5, 0, 0]} maxBarSize={58} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Trượt và cận trượt theo học kỳ</CardTitle>
                <p className="text-xs text-muted-foreground">Cột chồng phân biệt lượt trượt và lượt nằm sát ngưỡng đạt.</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={courseStats.visibleTrend} margin={{ left: 0, right: 8, top: 12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hk" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="failedCount" name="Trượt" stackId="risk" fill="#dc2626" />
                    <Bar dataKey="nearFailCount" name="Cận trượt" stackId="risk" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Mức đạt CLO theo học kỳ</CardTitle>
              <p className="text-xs text-muted-foreground">Heatmap giúp phát hiện CLO yếu kéo dài hoặc giảm qua nhiều kỳ; ngưỡng đạt là 70%.</p>
            </CardHeader>
            <CardContent>
              {courseStats.cloTrend.length ? (
                <CloTrendHeatmap rows={courseStats.cloTrend} semesters={courseStats.visibleTrend.map((row) => row.hk)} />
              ) : (
                <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                  Môn học chưa có đủ mapping hoặc minh chứng CLO trong khoảng thời gian đang chọn.
                </div>
              )}
            </CardContent>
          </Card>

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
                    <Tooltip formatter={(value) => [value, "Lượt học"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
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
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Điểm TB</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Trượt</th>
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
                          <td className="px-3 py-2 text-right tabular-nums">{section.avg_grade.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{section.failed_count}</td>
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

function CloTrendHeatmap({
  rows,
  semesters,
}: {
  rows: {
    clo_id: number
    clo_code: string
    clo_name: string
    semester: string
    evidence_count: number
    attainment_rate: number | null
  }[]
  semesters: string[]
}) {
  const clos = Array.from(new Map(rows.map((row) => [row.clo_id, row])).values())
  const cellMap = new Map(rows.map((row) => [`${row.clo_id}:${row.semester}`, row]))

  function cellTone(value: number | null | undefined) {
    if (value === null || value === undefined) return "bg-muted text-muted-foreground"
    if (value >= 85) return "bg-emerald-600 text-white"
    if (value >= 70) return "bg-emerald-200 text-emerald-950"
    if (value >= 50) return "bg-amber-200 text-amber-950"
    return "bg-rose-200 text-rose-950"
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-44 bg-background px-2 py-2 text-left font-medium text-muted-foreground">Chuẩn đầu ra</th>
            {semesters.map((semester) => (
              <th key={semester} className="min-w-24 px-2 py-2 text-center font-medium text-muted-foreground">{semester}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clos.map((clo) => (
            <tr key={clo.clo_id}>
              <td className="sticky left-0 z-10 bg-background px-2 py-2">
                <div className="font-semibold">{clo.clo_code}</div>
                <div className="max-w-48 truncate text-muted-foreground" title={clo.clo_name}>{clo.clo_name}</div>
              </td>
              {semesters.map((semester) => {
                const cell = cellMap.get(`${clo.clo_id}:${semester}`)
                return (
                  <td key={semester} className={`rounded-md px-2 py-3 text-center font-semibold tabular-nums ${cellTone(cell?.attainment_rate)}`} title={cell ? `${cell.evidence_count} minh chứng` : "Chưa có dữ liệu"}>
                    {cell?.attainment_rate === null || cell?.attainment_rate === undefined ? "—" : `${cell.attainment_rate.toFixed(1)}%`}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-200" />Dưới 50%</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-200" />50–69.9%</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-200" />70–84.9%</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />Từ 85%</span>
      </div>
    </div>
  )
}

function CoursePriorityCard({
  rows,
  onSelect,
}: {
  rows: ApiDashboardCourses["course_rows"]
  onSelect: (course: { id: number; code: string; name: string }) => void
}) {
  return (
    <Card className="border-rose-200/60 bg-rose-50/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-rose-800">Môn cần ưu tiên xem xét</CardTitle>
        <p className="text-xs text-muted-foreground">Chỉ xếp hạng môn có ít nhất 20 lượt học và có minh chứng CLO.</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[310px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b bg-background/95">
              <tr className="text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Môn học</th>
                <th className="px-2 py-2 text-right font-medium">Lượt học</th>
                <th className="px-2 py-2 text-right font-medium">Đạt</th>
                <th className="px-4 py-2 text-right font-medium">Health</th>
              </tr>
            </thead>
          <tbody className="divide-y">
            {rows.map((course) => (
              <tr key={course.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onSelect(course)}>
                <td className="px-4 py-2.5">
                  <div className="font-mono text-[11px] font-semibold text-primary">{course.code}</div>
                  <div className="max-w-[220px] truncate font-medium">{course.name}</div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{course.completed_enrollments}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{course.pass_rate.toFixed(1)}%</td>
                <td className="px-4 py-2.5 text-right font-semibold text-rose-700">{course.health_score?.toFixed(1) ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Chưa có môn đủ dữ liệu để xếp hạng.</td></tr>
            )}
          </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
