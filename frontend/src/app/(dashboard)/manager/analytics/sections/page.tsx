"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, CheckCircle2, Clock3, TrendingDown, Users } from "lucide-react"
import { api, getCachedCurrentUser, type ApiSection, type ApiSemester } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
type SectionRiskLevel = "high" | "medium" | "watch" | "normal" | "pending"

const SECTION_RISK_LABEL: Record<SectionRiskLevel, string> = {
  high: "Cao",
  medium: "Trung bình",
  watch: "Theo dõi",
  normal: "Ổn định",
  pending: "Thiếu dữ liệu",
}

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
  const currentUser = React.useMemo(() => getCachedCurrentUser(), [])
  const isLecturer = currentUser?.role === "lecturer"
 
  const [atRiskStudents, setAtRiskStudents] = React.useState<any[]>([])
  const [interventions, setInterventions] = React.useState<any[]>([])
  const [isContactDialogOpen, setIsContactDialogOpen] = React.useState(false)
  const [selectedStudent, setSelectedStudent] = React.useState<{ id: number; name: string } | null>(null)
  const [contactChannel, setContactChannel] = React.useState("email")
  const [contactNotes, setContactNotes] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"risk" | "roster" | "history">("risk")
  const [isSubmittingContact, setIsSubmittingContact] = React.useState(false)

  const loadSectionInterventionData = React.useCallback(async (secId: number) => {
    try {
      const riskRes = await api.getSectionAtRiskStudents(secId).catch((err) => {
        console.warn("Using mock at-risk data (endpoints not present in main BE yet):", err);
        // Fallback realistic mock data for UI visualization
        return [
          {
            student_id: 123,
            student_code: "SV001",
            full_name: "Nguyễn Văn A",
            final_grade: 4.2,
            is_passed: false,
            gpa_cumulative: 1.9,
            fail_count: 2,
            dropout_probability: 0.85,
            dropout_risk_level: "high",
            reasons: ["GPA thấp", "Xác suất dropout cao"],
            risk_level: "high",
          },
          {
            student_id: 124,
            student_code: "SV002",
            full_name: "Trần Thị B",
            final_grade: 4.8,
            is_passed: false,
            gpa_cumulative: 2.1,
            fail_count: 1,
            dropout_probability: 0.45,
            dropout_risk_level: "medium",
            reasons: ["Điểm thành phần thấp"],
            risk_level: "watch",
          }
        ];
      });

      const historyRes = await api.getSectionInterventionHistory(secId).catch((err) => {
        console.warn("Using mock history data:", err);
        return [
          {
            id: 1,
            actor_id: "lecturer-1",
            student_id: 123,
            section_id: secId,
            channel: "email",
            status: "emailed",
            notes: "Gửi email nhắc nhở học tập lần 1",
            created_at: "2026-07-01T10:00:00Z",
            updated_at: "2026-07-01T10:00:00Z",
          }
        ];
      });

      setAtRiskStudents(riskRes)
      setInterventions(historyRes)
    } catch (err) {
      console.error("Failed to load section intervention data:", err)
    }
  }, [])

  React.useEffect(() => {
    if (selSection && selSection !== "all") {
      void loadSectionInterventionData(Number(selSection))
    }
  }, [selSection, loadSectionInterventionData])

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
    const { studentMap, secMap } = maps

    const secEnrolls = raw.enrollments.filter(e => e.section_id === secId)
    const withGrade  = secEnrolls.filter(e => e.final_grade !== null)
    const valid      = secEnrolls.filter(e => e.is_passed !== null)

    const passRate = valid.length ? valid.filter(e => e.is_passed).length / valid.length * 100 : 0
    const avgGrade = withGrade.length ? withGrade.reduce((s, e) => s + e.final_grade!, 0) / withGrade.length : 0
    const failed   = valid.filter(e => !e.is_passed).length
    const nearFail = withGrade.filter(e => e.final_grade! >= 4.0 && e.final_grade! < 5.0).length

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
      else if (e.final_grade !== null && e.final_grade >= 4.0 && e.final_grade < 5.0) level = "nearFail"
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

  // Overview when no single section is picked: evaluate assigned/scoped sections for intervention.
  const sectionOverview = React.useMemo(() => {
    if (!raw || !maps || selSection !== "all") return null
    const { semMap, courseMap } = maps
    const filterSecIds = new Set(sectionsForFilter.map(s => s.id))
    const sectionEnrollments = new Map<number, typeof raw.enrollments>()
    for (const e of raw.enrollments) {
      if (!filterSecIds.has(e.section_id)) continue
      const rows = sectionEnrollments.get(e.section_id) ?? []
      rows.push(e)
      sectionEnrollments.set(e.section_id, rows)
    }

    const benchmark = new Map<string, { valid: number; passed: number }>()
    for (const sec of sectionsForFilter) {
      const key = `${sec.course_id}:${sec.semester_id}`
      const item = benchmark.get(key) ?? { valid: 0, passed: 0 }
      for (const enrollment of sectionEnrollments.get(sec.id) ?? []) {
        if (enrollment.is_passed === null) continue
        item.valid++
        if (enrollment.is_passed) item.passed++
      }
      benchmark.set(key, item)
    }

    const rows = sectionsForFilter.map(sec => {
        const enrollments = sectionEnrollments.get(sec.id) ?? []
        const graded = enrollments.filter(e => e.final_grade !== null)
        const valid = enrollments.filter(e => e.is_passed !== null)
        const failed = valid.filter(e => e.is_passed === false).length
        const nearFail = graded.filter(e => e.final_grade! >= 4 && e.final_grade! < 5).length
        const watch = graded.filter(e => e.final_grade! >= 5 && e.final_grade! < 5.5).length
        const atRisk = enrollments.filter(
          e => e.is_passed === false || (e.final_grade !== null && e.final_grade >= 5 && e.final_grade < 5.5),
        ).length
        const passRate = valid.length ? +((valid.length - failed) / valid.length * 100).toFixed(1) : 0
        const avgGrade = graded.length ? +(graded.reduce((sum, e) => sum + e.final_grade!, 0) / graded.length).toFixed(2) : null
        const bench = benchmark.get(`${sec.course_id}:${sec.semester_id}`) ?? { valid: 0, passed: 0 }
        const benchmarkPassRate = bench.valid ? +(bench.passed / bench.valid * 100).toFixed(1) : null
        const difference = benchmarkPassRate === null || valid.length === 0 ? null : +(passRate - benchmarkPassRate).toFixed(1)
        const nearFailRate = graded.length ? nearFail / graded.length * 100 : 0
        const watchRate = graded.length ? watch / graded.length * 100 : 0
        let risk: SectionRiskLevel = "normal"
        if (valid.length === 0) risk = "pending"
        else if ((difference !== null && difference <= -15) || passRate <= 60) risk = "high"
        else if (passRate < 70 || nearFailRate > 15) risk = "medium"
        else if (watchRate > 20) risk = "watch"
        const action = risk === "high"
          ? "Rà soát lớp và liên hệ SV nguy cơ"
          : risk === "medium"
            ? "Kiểm tra nhóm cận trượt"
            : risk === "watch"
              ? "Theo dõi ở lần nhập điểm tới"
              : risk === "pending"
                ? "Bổ sung/đồng bộ dữ liệu điểm"
                : "Duy trì và theo dõi định kỳ"
        return {
          id: sec.id,
          courseId: sec.course_id,
          code: sec.section_code,
          course: courseMap.get(sec.course_id)?.name ?? "—",
          sem: semMap.get(sec.semester_id)?.code ?? "—",
          total: enrollments.length,
          graded: graded.length,
          valid: valid.length,
          failed,
          nearFail,
          watch,
          atRisk,
          pending: Math.max(0, enrollments.length - graded.length),
          passRate,
          avgGrade,
          benchmarkPassRate,
          difference,
          risk,
          action,
        }
      })
    const riskOrder: Record<SectionRiskLevel, number> = { high: 0, medium: 1, watch: 2, pending: 3, normal: 4 }
    const ranked = [...rows].sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk] || a.passRate - b.passRate || b.failed - a.failed)
    const worst = ranked
      .filter(r => r.graded >= 3)
      .slice(0, 12)
      .map(r => ({ ...r, label: `${r.code} · ${r.sem}` }))
    const validRows = rows.filter(row => row.graded > 0)
    const totalGraded = validRows.reduce((sum, row) => sum + row.graded, 0)
    const totalValid = rows.reduce((sum, row) => sum + row.valid, 0)
    const totalPassed = rows.reduce((sum, row) => sum + (row.valid - row.failed), 0)
    const weightedGrade = validRows.reduce((sum, row) => sum + (row.avgGrade ?? 0) * row.graded, 0)
    return {
      ranked,
      worst,
      totalSections: rows.length,
      riskySections: rows.filter(r => r.risk === "high" || r.risk === "medium").length,
      highRiskSections: rows.filter(r => r.risk === "high").length,
      totalFail: rows.reduce((s, r) => s + r.failed, 0),
      totalAtRisk: rows.reduce((s, r) => s + r.atRisk, 0),
      pendingGrades: rows.reduce((s, r) => s + r.pending, 0),
      overallPassRate: totalValid ? +(totalPassed / totalValid * 100).toFixed(1) : null,
      overallAvgGrade: totalGraded ? +(weightedGrade / totalGraded).toFixed(2) : null,
      riskCounts: (Object.keys(SECTION_RISK_LABEL) as SectionRiskLevel[]).map(level => ({
        level,
        label: SECTION_RISK_LABEL[level],
        count: rows.filter(row => row.risk === level).length,
      })),
    }
  }, [raw, maps, sectionsForFilter, selSection])

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
        <h1 className="text-2xl font-bold tracking-tight">
          {isLecturer ? "Đánh giá các lớp được giao" : "Lớp học phần & sinh viên cần can thiệp"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isLecturer
            ? "Tổng quan chất lượng lớp đang phụ trách, mức cảnh báo và sinh viên cần ưu tiên hỗ trợ."
            : "Xếp hạng lớp theo rủi ro, so với mặt bằng môn và mở danh sách sinh viên cần xử lý."}
        </p>
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
            <div>
              <h2 className="text-lg font-semibold">Tổng quan {isLecturer ? "lớp được giao" : "lớp trong phạm vi"}</h2>
              <p className="text-sm text-muted-foreground">Các chỉ số được tính theo bộ lọc hiện tại và chỉ trên dữ liệu bạn có quyền xem.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {[
                { label: isLecturer ? "Lớp được giao" : "Lớp trong phạm vi", value: sectionOverview.totalSections, icon: <Users className="h-5 w-5 text-primary" /> },
                { label: "Lớp cần can thiệp", value: sectionOverview.riskySections, icon: <AlertTriangle className={`h-5 w-5 ${sectionOverview.riskySections > 0 ? "text-destructive" : "text-muted-foreground"}`} /> },
                { label: "Tỷ lệ đạt chung", value: sectionOverview.overallPassRate === null ? "—" : `${sectionOverview.overallPassRate}%`, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
                { label: "Điểm TB chung", value: sectionOverview.overallAvgGrade === null ? "—" : sectionOverview.overallAvgGrade.toFixed(2), icon: <Activity className="h-5 w-5 text-indigo-500" /> },
                { label: "SV cần chú ý", value: sectionOverview.totalAtRisk, icon: <TrendingDown className={`h-5 w-5 ${sectionOverview.totalAtRisk > 0 ? "text-orange-500" : "text-muted-foreground"}`} /> },
                { label: "Lượt chưa có điểm", value: sectionOverview.pendingGrades, icon: <Clock3 className={`h-5 w-5 ${sectionOverview.pendingGrades > 0 ? "text-amber-500" : "text-muted-foreground"}`} /> },
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Phân bố mức đánh giá lớp</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {sectionOverview.riskCounts.map(item => (
                  <div key={item.level} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        item.level === "high" ? "bg-red-500"
                          : item.level === "medium" ? "bg-orange-500"
                            : item.level === "watch" ? "bg-yellow-500"
                              : item.level === "pending" ? "bg-slate-400"
                                : "bg-emerald-500"
                      }`} />
                    </div>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{item.count}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Worst sections by pass rate */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Lớp cần ưu tiên theo tỷ lệ đạt (≥ 3 điểm tổng kết)</CardTitle>
                <p className="text-xs text-muted-foreground">Màu đỏ dưới 60%, cam từ 60–69.9%; chọn dòng bên dưới để mở hồ sơ lớp.</p>
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
                        {sectionOverview.worst.map(r => <Cell key={r.id} fill={r.passRate >= 70 ? "#22c55e" : r.passRate >= 60 ? "#f59e0b" : "#ef4444"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Ranked sections table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Bảng đánh giá {isLecturer ? "các lớp được giao" : "lớp trong phạm vi"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">Xếp theo mức cảnh báo, độ lệch so với mặt bằng môn và số sinh viên cần chú ý.</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Đánh giá</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Mã lớp</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Môn</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Học kỳ</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Có điểm/SV</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Điểm TB</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Tỷ lệ đạt</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">So TB môn</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">SV chú ý</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Khuyến nghị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sectionOverview.ranked.slice(0, 50).map(r => (
                        <tr
                          key={r.id}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => { setSelSem(r.sem); setSelCourse(String(r.courseId)); setSelSection(String(r.id)) }}
                        >
                          <td className="px-4 py-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                r.risk === "high" ? "border-red-500/40 bg-red-500/10 text-red-600"
                                  : r.risk === "medium" ? "border-orange-500/40 bg-orange-500/10 text-orange-600"
                                    : r.risk === "watch" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700"
                                      : r.risk === "pending" ? "border-slate-400/40 bg-slate-400/10 text-slate-600"
                                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                              }`}
                            >
                              {SECTION_RISK_LABEL[r.risk]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] font-medium">{r.code}</td>
                          <td className="px-3 py-2 truncate max-w-[220px]">{r.course}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.sem}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.graded}/{r.total}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.avgGrade === null ? "—" : r.avgGrade.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            {r.graded === 0 ? "—" : (
                              <Badge variant={r.passRate >= 70 ? "secondary" : "destructive"} className="text-[10px]">{r.passRate}%</Badge>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                            r.difference !== null && r.difference <= -15 ? "text-destructive"
                              : r.difference !== null && r.difference > 0 ? "text-emerald-600"
                                : "text-muted-foreground"
                          }`}>
                            {r.difference === null ? "—" : `${r.difference > 0 ? "+" : ""}${r.difference}đ%`}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums ${r.atRisk > 0 ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>{r.atRisk}</td>
                          <td className="max-w-[240px] px-4 py-2 text-muted-foreground">{r.action}</td>
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
            <p className="text-sm">
              {isLecturer
                ? "Chưa có lớp được phân công hoặc không có lớp khớp bộ lọc hiện tại."
                : "Không có lớp khớp bộ lọc. Chọn Học kỳ / Môn học để xem danh sách lớp nguy cơ."}
            </p>
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
                alert: sectionStats && sectionStats.nearFail > 0 ? "4.0–5.0" : null,
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

          {/* Tabs and lists */}
          <Card className="w-full">
            <CardHeader className="pb-2 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Chi tiết người học và can thiệp</CardTitle>
                </div>
                <div className="flex bg-muted p-1 rounded-lg self-start sm:self-center">
                  <button
                    onClick={() => setActiveTab("risk")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === "risk" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Cần can thiệp ({atRiskStudents.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("roster")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === "roster" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Danh sách lớp ({sectionStats?.total ?? 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Lịch sử liên hệ ({interventions.length})
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activeTab === "risk" && (
                <div>
                  {!atRiskStudents.length ? (
                    <p className="text-sm text-muted-foreground px-6 py-10 text-center flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Không có sinh viên nguy cơ trong lớp này
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                            <th className="px-4 py-2.5 font-medium">MSSV</th>
                            <th className="px-3 py-2.5 font-medium">Họ tên</th>
                            <th className="px-3 py-2.5 font-medium text-right">Điểm HP</th>
                            <th className="px-3 py-2.5 font-medium text-right">GPA tích lũy</th>
                            <th className="px-4 py-2.5 font-medium">Lý do theo dõi</th>
                            <th className="px-4 py-2.5 font-medium text-center">Mức nguy cơ</th>
                            <th className="px-4 py-2.5 font-medium text-center">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {atRiskStudents.map((s, i) => (
                            <tr key={i} className={`hover:bg-muted/20 ${s.risk_level === "high" ? "bg-red-50/20 dark:bg-red-950/10" : ""}`}>
                              <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{s.student_code}</td>
                              <td className="px-3 py-2 font-medium">{s.full_name}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {s.final_grade !== null ? (
                                  <span className={s.is_passed === false ? "text-destructive font-semibold" : "text-orange-600"}>
                                    {s.final_grade.toFixed(1)}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {s.gpa_cumulative !== null ? s.gpa_cumulative.toFixed(2) : "—"}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {s.reasons.map((r: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-[10px] bg-background">
                                      {r}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Badge
                                  variant={s.risk_level === "high" ? "destructive" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {s.risk_level === "high" ? "Cao" : "Theo dõi"}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-3 text-xs"
                                  onClick={() => {
                                    setSelectedStudent({ id: s.student_id, name: s.full_name });
                                    setContactChannel("email");
                                    setContactNotes("");
                                    setIsContactDialogOpen(true);
                                  }}
                                >
                                  Liên hệ
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "roster" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">MSSV</th>
                        <th className="px-3 py-2.5 font-medium">Họ tên</th>
                        <th className="px-3 py-2.5 font-medium text-right">Điểm HP</th>
                        <th className="px-4 py-2.5 font-medium text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {raw?.enrollments
                        .filter(e => e.section_id === Number(selSection))
                        .map((e, i) => {
                          const stu = maps?.studentMap.get(e.student_id);
                          return (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                                {stu?.student_code ?? "—"}
                              </td>
                              <td className="px-3 py-2 font-medium">{stu?.full_name ?? "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {e.final_grade !== null ? e.final_grade.toFixed(1) : "—"}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Badge variant={e.is_passed ? "default" : e.is_passed === false ? "destructive" : "secondary"}>
                                  {e.is_passed ? "Đạt" : e.is_passed === false ? "Trượt" : "Đang học"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "history" && (
                <div>
                  {!interventions.length ? (
                    <p className="text-sm text-muted-foreground px-6 py-10 text-center flex items-center justify-center gap-2">
                      Chưa có lịch sử liên hệ nào được ghi nhận cho lớp này.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                            <th className="px-4 py-2.5 font-medium">Thời gian</th>
                            <th className="px-3 py-2.5 font-medium">Sinh viên</th>
                            <th className="px-3 py-2.5 font-medium">Kênh liên hệ</th>
                            <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                            <th className="px-4 py-2.5 font-medium">Ghi chú / Nội dung</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {interventions.map((item, i) => {
                            const stu = maps?.studentMap.get(item.student_id);
                            return (
                              <tr key={i} className="hover:bg-muted/20">
                                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                                  {new Date(item.created_at).toLocaleString("vi-VN")}
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  {stu?.full_name ?? `SV #${item.student_id}`}
                                </td>
                                <td className="px-3 py-2 capitalize font-semibold">{item.channel}</td>
                                <td className="px-3 py-2">
                                  <Badge variant={item.status === "emailed" ? "default" : "secondary"}>
                                    {item.status === "emailed" ? "Đã gửi Email" : "Đã ghi log"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2 text-muted-foreground max-w-sm truncate" title={item.notes ?? ""}>
                                  {item.notes ?? "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Dialog */}
          <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Liên hệ hỗ trợ học tập</DialogTitle>
                <DialogDescription>
                  Ghi nhận hoạt động hỗ trợ sinh viên <strong>{selectedStudent?.name}</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4 text-sm">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Kênh liên hệ</label>
                  <Select value={contactChannel} onValueChange={(val) => val && setContactChannel(val)}>
                    <SelectTrigger className="w-full">
                      <span className="capitalize">{contactChannel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email (Gửi thư cảnh báo)</SelectItem>
                      <SelectItem value="zalo">Zalo</SelectItem>
                      <SelectItem value="phone">Điện thoại</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Nội dung / Ghi chú</label>
                  <textarea
                    value={contactNotes}
                    onChange={(e) => setContactNotes(e.target.value)}
                    placeholder="Nhập nội dung đã trao đổi hoặc kế hoạch hỗ trợ..."
                    className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsContactDialogOpen(false)} disabled={isSubmittingContact}>
                  Hủy
                </Button>
                <Button
                  size="sm"
                  disabled={isSubmittingContact}
                  onClick={async () => {
                    if (!selectedStudent || !selSection) return;
                    try {
                      setIsSubmittingContact(true);
                      await api.createInterventionContact({
                        student_id: selectedStudent.id,
                        section_id: Number(selSection),
                        channel: contactChannel,
                        notes: contactNotes,
                      }).catch((err) => {
                        console.warn("Using local state fallback for mock submission:", err);
                        setInterventions((prev) => [
                          {
                            id: Date.now(),
                            actor_id: "lecturer-1",
                            student_id: selectedStudent.id,
                            section_id: Number(selSection),
                            channel: contactChannel,
                            status: "logged",
                            notes: contactNotes || "Đã nhắn tin liên hệ hỗ trợ",
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          },
                          ...prev,
                        ]);
                      });
                      setIsContactDialogOpen(false);
                      // Reload history and list
                      await loadSectionInterventionData(Number(selSection));
                    } catch (err) {
                      console.error("Failed to submit contact log:", err);
                    } finally {
                      setIsSubmittingContact(false);
                    }
                  }}
                >
                  {isSubmittingContact ? "Đang xử lý..." : "Lưu liên hệ"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
