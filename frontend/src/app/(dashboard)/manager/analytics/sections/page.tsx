"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react"
import { api, type ApiSection, type ApiSemester } from "@/lib/api"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts"

type Raw = {
  courses:     Awaited<ReturnType<typeof api.getCourses>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  sections:    ApiSection[]
  semesters:   ApiSemester[]
  students:    Awaited<ReturnType<typeof api.getStudents>>
}

const DIST_RANGES = [
  { label: "0–4",  min: 0,  max: 4,   color: "#ef4444" },
  { label: "4–5",  min: 4,  max: 5,   color: "#f97316" },
  { label: "5–6",  min: 5,  max: 6,   color: "#f59e0b" },
  { label: "6–7",  min: 6,  max: 7,   color: "#84cc16" },
  { label: "7–8",  min: 7,  max: 8,   color: "#22c55e" },
  { label: "8–10", min: 8,  max: 10.1, color: "#10b981" },
]

type RiskLevel = "fail" | "nearFail" | "risk"

function dateStartIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function dateEndIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

export default function SectionsRiskPage() {
  const searchParams = useSearchParams()
  const [raw, setRaw]           = React.useState<Raw | null>(null)
  const [selSem, setSelSem]     = React.useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("vinuni_selected_semester") || "all"
    }
    return "all"
  })
  const [selCourse, setSelCourse] = React.useState("all")
  const [selSection, setSelSection] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

  React.useEffect(() => {
    if (raw?.semesters && raw.semesters.length > 0) {
      const querySemester = searchParams.get("semester") ?? searchParams.get("semester_id")
      const querySection = searchParams.get("section_id") ?? searchParams.get("section")
      if (querySemester || querySection) return

      const saved = sessionStorage.getItem("vinuni_selected_semester")
      if (!saved) {
        const sorted = [...raw.semesters].sort((a, b) => b.year * 10 + b.term - (a.year * 10 + a.term))
        const latest = sorted[0]?.code
        if (latest) {
          setTimeout(() => {
            setSelSem(latest)
          }, 0)
          sessionStorage.setItem("vinuni_selected_semester", latest)
        }
      }
    }
  }, [raw, searchParams])

  React.useEffect(() => {
    const querySection = searchParams.get("section_id") ?? searchParams.get("section")
    const queryCourse = searchParams.get("course_id") ?? searchParams.get("course")
    const parsedSectionId = querySection ? Number(querySection) : NaN
    const parsedCourseId = queryCourse ? Number(queryCourse) : NaN
    const enrollmentFilter = querySection
      ? { section_id: Number.isFinite(parsedSectionId) ? parsedSectionId : undefined, limit: 50000, date_from: dateStartIso(dateFrom), date_to: dateEndIso(dateTo) }
      : queryCourse
        ? { course_id: Number.isFinite(parsedCourseId) ? parsedCourseId : undefined, limit: 50000, date_from: dateStartIso(dateFrom), date_to: dateEndIso(dateTo) }
        : { limit: 50000, date_from: dateStartIso(dateFrom), date_to: dateEndIso(dateTo) }
    Promise.all([
      api.getCourses({ limit: 500 }),
      api.getEnrollments(enrollmentFilter),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
      api.getStudents({ limit: 1000 }),
    ]).then(([courses, enrollments, sections, semesters, students]) => {
      setRaw({ courses, enrollments, sections, semesters, students })
      const querySemester = searchParams.get("semester") ?? searchParams.get("semester_id")
      const linkedSection = querySection ? sections.find(s => String(s.id) === querySection) : undefined
      const linkedSemester = linkedSection
        ? semesters.find(s => s.id === linkedSection.semester_id)
        : querySemester
          ? semesters.find(s => String(s.id) === querySemester || s.code === querySemester)
          : undefined
      if (linkedSemester) setSelSem(linkedSemester.code)
      if (linkedSection) {
        setSelCourse(String(linkedSection.course_id))
        setSelSection(String(linkedSection.id))
      } else if (queryCourse && courses.some(c => String(c.id) === queryCourse)) {
        setSelCourse(queryCourse)
      }
    }).catch(console.error)
  }, [searchParams, dateFrom, dateTo])

  const maps = React.useMemo(() => {
    if (!raw) return null
    const secMap    = new Map(raw.sections.map(s => [s.id, s]))
    const semMap    = new Map(raw.semesters.map(s => [s.id, s]))
    const studentMap = new Map(raw.students.map(s => [s.id, s]))
    const courseMap = new Map(raw.courses.map(c => [c.id, c]))
    return { secMap, semMap, studentMap, courseMap }
  }, [raw])

  // Step 1: Semesters that have sections
  const semestersWithData = React.useMemo(() => {
    if (!raw) return []
    const semIds = new Set(raw.sections.map(s => s.semester_id))
    return raw.semesters
      .filter(s => semIds.has(s.id))
      .sort((a, b) => `${a.year}-${a.term}`.localeCompare(`${b.year}-${b.term}`))
  }, [raw])

  // Step 2: Courses available for selected semester
  const coursesForSem = React.useMemo(() => {
    if (!raw || !maps) return []
    if (selSem === "all") return raw.courses.slice().sort((a, b) => a.name.localeCompare(b.name))
    const semId = raw.semesters.find(s => s.code === selSem)?.id
    if (!semId) return []
    const courseIds = new Set(raw.sections.filter(s => s.semester_id === semId).map(s => s.course_id))
    return raw.courses.filter(c => courseIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [raw, maps, selSem])

  // Step 3: Sections for selected semester + course
  const sectionsForFilter = React.useMemo(() => {
    if (!raw) return []
    return raw.sections.filter(s => {
      const sem = selSem === "all" ? true : raw.semesters.find(x => x.code === selSem)?.id === s.semester_id
      const course = selCourse === "all" ? true : s.course_id === Number(selCourse)
      return sem && course
    }).sort((a, b) => a.section_code.localeCompare(b.section_code))
  }, [raw, selSem, selCourse])

  // Analytics for selected section
  const sectionStats = React.useMemo(() => {
    if (!raw || !maps || selSection === "all") return null
    const secId = Number(selSection)
    const { studentMap, courseMap, secMap } = maps

    const secEnrolls = raw.enrollments.filter(e => e.section_id === secId)
    const withGrade  = secEnrolls.filter(e => e.final_grade !== null)
    const valid      = secEnrolls.filter(e => e.is_passed !== null)

    const passRate = valid.length ? valid.filter(e => e.is_passed).length / valid.length * 100 : 0
    const avgGrade = withGrade.length ? withGrade.reduce((s, e) => s + e.final_grade!, 0) / withGrade.length : 0
    const failed   = valid.filter(e => !e.is_passed).length
    const nearFail = withGrade.filter(e => e.final_grade! >= 4.5 && e.final_grade! < 5.0).length

    // Distribution for this section
    const dist = DIST_RANGES.map(r => ({
      label: r.label,
      this: withGrade.filter(e => e.final_grade! >= r.min && e.final_grade! < r.max).length,
      color: r.color,
    }))

    // Course avg for comparison
    const sec = secMap.get(secId)
    const courseEnrolls = sec
      ? raw.enrollments.filter(e => secMap.get(e.section_id)?.course_id === sec.course_id && e.final_grade !== null)
      : []
    const courseAvgGrade = courseEnrolls.length ? courseEnrolls.reduce((s, e) => s + e.final_grade!, 0) / courseEnrolls.length : 0
    const coursePassRate = (() => {
      const cv = raw.enrollments.filter(e => sec && secMap.get(e.section_id)?.course_id === sec.course_id && e.is_passed !== null)
      return cv.length ? cv.filter(e => e.is_passed).length / cv.length * 100 : 0
    })()

    // Comparison chart data
    const compareData = DIST_RANGES.map(r => {
      const thisCnt = withGrade.filter(e => e.final_grade! >= r.min && e.final_grade! < r.max).length
      const allCnt  = courseEnrolls.filter(e => e.final_grade! >= r.min && e.final_grade! < r.max).length
      const allPct  = courseEnrolls.length ? allCnt / courseEnrolls.length * 100 : 0
      const thisPct = withGrade.length ? thisCnt / withGrade.length * 100 : 0
      return { label: r.label, "Lớp này": +thisPct.toFixed(1), "TB môn": +allPct.toFixed(1) }
    })

    // Risk student list
    const riskStudents: { id: number; code: string; name: string; grade: number | null; status: string; level: RiskLevel }[] = []
    for (const e of secEnrolls) {
      const stu = studentMap.get(e.student_id)
      if (!stu) continue
      let level: RiskLevel | null = null
      if (e.is_passed === false) level = "fail"
      else if (e.final_grade !== null && e.final_grade >= 4.5 && e.final_grade < 5.0) level = "nearFail"
      else if (e.final_grade !== null && e.final_grade >= 5.0 && e.final_grade < 5.5) level = "risk"
      if (level) {
        riskStudents.push({
          id: stu.id,
          code: stu.student_code,
          name: stu.full_name,
          grade: e.final_grade,
          status: e.status,
          level,
        })
      }
    }
    riskStudents.sort((a, b) => {
      const order: Record<RiskLevel, number> = { fail: 0, nearFail: 1, risk: 2 }
      return order[a.level] - order[b.level]
    })

    return {
      total: secEnrolls.length, passRate, avgGrade, failed, nearFail,
      dist, compareData, riskStudents, coursePassRate, courseAvgGrade,
    }
  }, [raw, maps, selSection])

  // Overview when no single section is picked: rank sections in the filtered scope by pass rate.
  const sectionOverview = React.useMemo(() => {
    if (!raw || !maps || selSection !== "all") return null
    const { semMap, courseMap } = maps
    const filterSecIds = new Set(sectionsForFilter.map(s => s.id))
    const agg = new Map<number, { total: number; failed: number }>()
    for (const e of raw.enrollments) {
      if (e.is_passed === null || !filterSecIds.has(e.section_id)) continue
      const a = agg.get(e.section_id) ?? { total: 0, failed: 0 }
      a.total++
      if (!e.is_passed) a.failed++
      agg.set(e.section_id, a)
    }
    const rows = sectionsForFilter
      .map(sec => {
        const a = agg.get(sec.id) ?? { total: 0, failed: 0 }
        return {
          id: sec.id,
          courseId: sec.course_id,
          code: sec.section_code,
          course: courseMap.get(sec.course_id)?.name ?? "—",
          sem: semMap.get(sec.semester_id)?.code ?? "—",
          total: a.total,
          failed: a.failed,
          passRate: a.total ? +(((a.total - a.failed) / a.total) * 100).toFixed(1) : 0,
        }
      })
      .filter(r => r.total > 0)
    const ranked = [...rows].sort((a, b) => a.passRate - b.passRate || b.failed - a.failed)
    const worst = ranked.filter(r => r.total >= 3).slice(0, 12).map(r => ({ ...r, label: `${r.code} · ${r.sem}` }))
    return {
      ranked,
      worst,
      totalSections: rows.length,
      riskySections: rows.filter(r => r.passRate < 70).length,
      totalFail: rows.reduce((s, r) => s + r.failed, 0),
    }
  }, [raw, maps, sectionsForFilter, selSection])

  const LEVEL_LABEL: Record<RiskLevel, string> = {
    fail: "🔴 Trượt",
    nearFail: "🟡 Cận trượt",
    risk: "🟡 Qua — nguy cơ",
  }

  const selectedSemester = raw?.semesters.find(s => s.code === selSem)
  const selectedCourse = maps?.courseMap.get(Number(selCourse))
  const selectedSection = maps?.secMap.get(Number(selSection))
  const selectedSectionSemester = selectedSection ? maps?.semMap.get(selectedSection.semester_id) : undefined
  const semLabel = selectedSemester ? `${selectedSemester.name} (${selectedSemester.code})` : "Tất cả học kỳ"
  const courseLabel = selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : "Tất cả môn"
  const sectionLabel = selectedSection ? `${selectedSection.section_code} - ${selectedSectionSemester?.code ?? "chưa rõ kỳ"}` : "Tất cả lớp học phần"

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lớp học phần & SV nguy cơ</h1>
        <p className="text-sm text-muted-foreground">Xác định lớp và sinh viên cần can thiệp ngay</p>
      </div>

      {/* 3-step filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">1</span>
              <Select value={selSem} onValueChange={v => {
                const nextVal = v ?? "all"
                setSelSem(nextVal)
                sessionStorage.setItem("vinuni_selected_semester", nextVal)
                setSelCourse("all")
                setSelSection("all")
              }}>
                <SelectTrigger className="w-48">
                  <span className="truncate">{semLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả học kỳ</SelectItem>
                  {semestersWithData.map(s => <SelectItem key={s.id} value={s.code}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">2</span>
              <Select value={selCourse} onValueChange={v => { setSelCourse(v ?? "all"); setSelSection("all") }}>
                <SelectTrigger className="w-64">
                  <span className="truncate">{courseLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả môn</SelectItem>
                  {coursesForSem.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-4">3</span>
              <Select value={selSection} onValueChange={v => setSelSection(v ?? "all")} disabled={selCourse === "all"}>
                <SelectTrigger className="w-52">
                  <span className="truncate">{sectionLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">— Chọn lớp —</SelectItem>
                  {sectionsForFilter.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.section_code} · {maps?.semMap.get(s.semester_id)?.code ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" aria-label="Từ ngày" />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" aria-label="Đến ngày" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Học kỳ: {semLabel}</Badge>
            <Badge variant="outline">Môn: {courseLabel}</Badge>
            <Badge variant="outline">Lớp: {sectionLabel}</Badge>
            <Badge variant="outline">Thời gian: {dateFrom || "đầu dữ liệu"} → {dateTo || "hiện tại"}</Badge>
          </div>
        </CardContent>
      </Card>

      {selSection === "all" ? (
        sectionOverview && sectionOverview.totalSections > 0 ? (
          <div className="flex flex-col gap-4">
            {/* Scope KPIs */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Số lớp trong phạm vi", value: sectionOverview.totalSections, icon: <Users className="h-5 w-5 text-muted-foreground" /> },
                { label: "Lớp pass rate < 70%", value: sectionOverview.riskySections, icon: <AlertTriangle className={`h-5 w-5 ${sectionOverview.riskySections > 0 ? "text-destructive" : "text-muted-foreground"}`} /> },
                { label: "Tổng lượt trượt", value: sectionOverview.totalFail, icon: <TrendingDown className={`h-5 w-5 ${sectionOverview.totalFail > 0 ? "text-orange-500" : "text-muted-foreground"}`} /> },
              ].map((k, i) => (
                <Card key={i}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                        <p className="text-2xl font-bold mt-1 tabular-nums">{k.value}</p>
                      </div>
                      <div className="shrink-0 mt-0.5">{k.icon}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Worst sections by pass rate */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Lớp có pass rate thấp nhất (≥ 3 SV)</CardTitle>
                <p className="text-xs text-muted-foreground">Cần can thiệp sớm — bấm một dòng trong bảng dưới để xem chi tiết lớp.</p>
              </CardHeader>
              <CardContent>
                {sectionOverview.worst.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Chưa đủ dữ liệu để xếp hạng.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, sectionOverview.worst.length * 32)}>
                    <BarChart data={sectionOverview.worst} layout="vertical" margin={{ left: 8, right: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [`${v}%`, "Pass rate"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Bar dataKey="passRate" radius={[0, 4, 4, 0]}>
                        {sectionOverview.worst.map(r => <Cell key={r.id} fill={r.passRate >= 70 ? "#22c55e" : r.passRate >= 50 ? "#f59e0b" : "#ef4444"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Ranked sections table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Tất cả lớp trong phạm vi (xếp theo pass rate)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Mã lớp</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Môn</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Học kỳ</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">SV</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Trượt</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Pass rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sectionOverview.ranked.slice(0, 50).map(r => (
                        <tr
                          key={r.id}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => { setSelSem(r.sem); setSelCourse(String(r.courseId)); setSelSection(String(r.id)) }}
                        >
                          <td className="px-4 py-2 font-mono text-[11px]">{r.code}</td>
                          <td className="px-3 py-2 truncate max-w-[220px]">{r.course}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.sem}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${r.failed > 0 ? "text-destructive" : ""}`}>{r.failed}</td>
                          <td className="px-4 py-2 text-right">
                            <Badge variant={r.passRate >= 70 ? "secondary" : "destructive"} className="text-[10px]">{r.passRate}%</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sectionOverview.ranked.length > 50 && (
                    <p className="px-4 py-2 text-[11px] text-muted-foreground">Hiển thị 50 lớp rủi ro nhất / {sectionOverview.ranked.length} lớp. Lọc theo Học kỳ hoặc Môn để thu hẹp.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
            <AlertTriangle className="h-10 w-10 opacity-30" />
            <p className="text-sm">Không có lớp khớp bộ lọc. Chọn Học kỳ / Môn học để xem danh sách lớp nguy cơ.</p>
          </div>
        )
      ) : (
        <>
          {/* 5 KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "SV trong lớp",  value: sectionStats?.total ?? "—",   icon: <Users className="h-5 w-5 text-muted-foreground" /> },
              {
                label: "Pass rate",
                value: sectionStats ? `${sectionStats.passRate.toFixed(1)}%` : "—",
                icon: <CheckCircle2 className={`h-5 w-5 ${!sectionStats || sectionStats.passRate >= 70 ? "text-emerald-500" : "text-destructive"}`} />,
                alert: sectionStats && sectionStats.passRate < 70 ? "< 70% ⚠" : null,
              },
              { label: "Điểm trung bình", value: sectionStats ? sectionStats.avgGrade.toFixed(2) : "—", icon: <TrendingDown className="h-5 w-5 text-muted-foreground" /> },
              {
                label: "SV trượt",
                value: sectionStats?.failed ?? "—",
                icon: <AlertTriangle className={`h-5 w-5 ${sectionStats && sectionStats.failed > 0 ? "text-destructive" : "text-muted-foreground"}`} />,
                alert: sectionStats && sectionStats.failed > 0 ? `${sectionStats.failed} SV` : null,
              },
              {
                label: "SV cận trượt",
                value: sectionStats?.nearFail ?? "—",
                icon: <AlertTriangle className={`h-5 w-5 ${sectionStats && sectionStats.nearFail > 0 ? "text-orange-500" : "text-muted-foreground"}`} />,
                alert: sectionStats && sectionStats.nearFail > 0 ? "4.5–5.0" : null,
              },
            ].map((k, i) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">{k.value}</p>
                      {"alert" in k && k.alert && (
                        <Badge variant="destructive" className="mt-1 text-[10px] h-4 px-1.5">{k.alert}</Badge>
                      )}
                    </div>
                    <div className="shrink-0 mt-0.5">{k.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 2 bar charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Phân bổ điểm lớp này</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sectionStats?.dist ?? []} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [v, "SV"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="this" name="Số SV" radius={[4, 4, 0, 0]}>
                      {(sectionStats?.dist ?? []).map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Lớp này vs trung bình môn (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sectionStats?.compareData ?? []} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Lớp này" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="TB môn" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Risk student table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">Danh sách SV cần chú ý</CardTitle>
                {sectionStats && (
                  <Badge variant={sectionStats.riskStudents.length > 0 ? "destructive" : "secondary"} className="text-[10px]">
                    {sectionStats.riskStudents.length} SV
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!sectionStats?.riskStudents.length ? (
                <p className="text-sm text-muted-foreground px-6 py-6 text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Không có sinh viên nguy cơ trong lớp này
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">MSSV</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Họ tên</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Điểm</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Mức cảnh báo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sectionStats.riskStudents.map((s, i) => (
                        <tr key={i} className={`hover:bg-muted/20 ${s.level === "fail" ? "bg-red-50/30 dark:bg-red-950/20" : ""}`}>
                          <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{s.code}</td>
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {s.grade !== null ? (
                              <span className={s.level === "fail" ? "text-destructive font-semibold" : "text-orange-600"}>{s.grade.toFixed(1)}</span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Badge
                              variant={s.level === "fail" ? "destructive" : "outline"}
                              className={`text-[10px] ${s.level !== "fail" ? "border-orange-400 text-orange-600" : ""}`}
                            >
                              {LEVEL_LABEL[s.level]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
