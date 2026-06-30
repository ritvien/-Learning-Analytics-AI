"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  api,
  getCachedCurrentUser,
  type ApiInterventionCampaign,
  type ApiInterventionScopeSummary,
  type ApiSection,
  type ApiSemester,
} from "@/lib/api"

type Raw = {
  courses: Awaited<ReturnType<typeof api.getCourses>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  sections: ApiSection[]
  semesters: ApiSemester[]
  students: Awaited<ReturnType<typeof api.getStudents>>
}

type RiskLevel = "fail" | "nearFail" | "risk"
type SectionRiskLevel = "high" | "medium" | "watch" | "normal" | "pending"
type MailPreviewMode = "agent" | "mail"

const SECTION_RISK_LABEL: Record<SectionRiskLevel, string> = {
  high: "Ưu tiên",
  medium: "Cần xử lý",
  watch: "Theo dõi",
  normal: "Ổn định",
  pending: "Thiếu điểm",
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  fail: "Trượt",
  nearFail: "Cận trượt",
  risk: "Sát ngưỡng",
}

const DIST_RANGES = [
  { label: "0-4", min: 0, max: 4, color: "#ef4444" },
  { label: "4-5", min: 4, max: 5, color: "#f97316" },
  { label: "5-6", min: 5, max: 6, color: "#f59e0b" },
  { label: "6-7", min: 6, max: 7, color: "#84cc16" },
  { label: "7-8", min: 7, max: 8, color: "#22c55e" },
  { label: "8-10", min: 8, max: 10.1, color: "#10b981" },
]

const GPA_BANDS = [
  { label: "Yếu", min: 0, max: 2, color: "#ef4444" },
  { label: "TB", min: 2, max: 2.5, color: "#f97316" },
  { label: "Khá", min: 2.5, max: 3.2, color: "#f59e0b" },
  { label: "Giỏi", min: 3.2, max: 3.6, color: "#22c55e" },
  { label: "Xuất sắc", min: 3.6, max: 4.1, color: "#10b981" },
]

function riskClass(level: SectionRiskLevel) {
  if (level === "high") return "border-red-500/40 bg-red-500/10 text-red-600"
  if (level === "medium") return "border-orange-500/40 bg-orange-500/10 text-orange-600"
  if (level === "watch") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-700"
  if (level === "pending") return "border-slate-400/40 bg-slate-400/10 text-slate-600"
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
}

export default function SectionsRiskPage() {
  const searchParams = useSearchParams()
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [selSem, setSelSem] = React.useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("vinuni_selected_semester") || "all"
    return "all"
  })
  const [selCourse, setSelCourse] = React.useState("all")
  const [selStatus, setSelStatus] = React.useState<"all" | "needs_action" | "pending">("all")
  const [selSection, setSelSection] = React.useState("all")
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState("")
  const [agentLoading, setAgentLoading] = React.useState(false)
  const [agentSummary, setAgentSummary] = React.useState<ApiInterventionScopeSummary | null>(null)
  const [agentError, setAgentError] = React.useState("")
  const [mailDraftLoading, setMailDraftLoading] = React.useState(false)
  const [campaign, setCampaign] = React.useState<ApiInterventionCampaign | null>(null)
  const [bulkLoading, setBulkLoading] = React.useState(false)
  const [campaignResult, setCampaignResult] = React.useState<ApiInterventionCampaign | null>(null)
  const [savingMessageId, setSavingMessageId] = React.useState<number | null>(null)
  const [mailPreviewOpen, setMailPreviewOpen] = React.useState(false)
  const [mailPreviewMode, setMailPreviewMode] = React.useState<MailPreviewMode>("agent")

  const currentUser = React.useMemo(() => getCachedCurrentUser(), [])
  const isLecturer = currentUser?.role === "lecturer"

  React.useEffect(() => {
    const querySection = searchParams.get("section_id") ?? searchParams.get("section")
    const queryCourse = searchParams.get("course_id") ?? searchParams.get("course")
    const parsedSectionId = querySection ? Number(querySection) : NaN
    const parsedCourseId = queryCourse ? Number(queryCourse) : NaN
    const enrollmentFilter = querySection
      ? { section_id: Number.isFinite(parsedSectionId) ? parsedSectionId : undefined, limit: 50000 }
      : queryCourse
        ? { course_id: Number.isFinite(parsedCourseId) ? parsedCourseId : undefined, limit: 50000 }
        : { limit: 50000 }

    setLoading(true)
    setLoadError("")
    Promise.all([
      api.getCourses({ limit: 500 }),
      api.getEnrollments(enrollmentFilter),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
      api.getStudents({ limit: 5000 }),
    ])
      .then(([courses, enrollments, sections, semesters, students]) => {
        setRaw({ courses, enrollments, sections, semesters, students })
        const querySemester = searchParams.get("semester") ?? searchParams.get("semester_id")
        const linkedSection = querySection ? sections.find((section) => String(section.id) === querySection) : undefined
        const linkedSemester = linkedSection
          ? semesters.find((semester) => semester.id === linkedSection.semester_id)
          : querySemester
            ? semesters.find((semester) => String(semester.id) === querySemester || semester.code === querySemester)
            : undefined
        if (linkedSemester) setSelSem(linkedSemester.code)
        if (linkedSection) {
          setSelCourse(String(linkedSection.course_id))
          setSelSection(String(linkedSection.id))
        } else if (queryCourse && courses.some((course) => String(course.id) === queryCourse)) {
          setSelCourse(queryCourse)
        }
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Không tải được dữ liệu lớp học phần."))
      .finally(() => setLoading(false))
  }, [searchParams])

  React.useEffect(() => {
    if (!raw?.semesters.length) return
    const querySemester = searchParams.get("semester") ?? searchParams.get("semester_id")
    const querySection = searchParams.get("section_id") ?? searchParams.get("section")
    if (querySemester || querySection) return
    const saved = sessionStorage.getItem("vinuni_selected_semester")
    if (saved) return
    const latest = [...raw.semesters].sort((a, b) => b.year * 10 + b.term - (a.year * 10 + a.term))[0]?.code
    if (latest) {
      setSelSem(latest)
      sessionStorage.setItem("vinuni_selected_semester", latest)
    }
  }, [raw, searchParams])

  const maps = React.useMemo(() => {
    if (!raw) return null
    return {
      secMap: new Map(raw.sections.map((section) => [section.id, section])),
      semMap: new Map(raw.semesters.map((semester) => [semester.id, semester])),
      studentMap: new Map(raw.students.map((student) => [student.id, student])),
      courseMap: new Map(raw.courses.map((course) => [course.id, course])),
    }
  }, [raw])

  const semestersWithData = React.useMemo(() => {
    if (!raw) return []
    const semIds = new Set(raw.sections.map((section) => section.semester_id))
    return raw.semesters.filter((semester) => semIds.has(semester.id)).sort((a, b) => b.year * 10 + b.term - (a.year * 10 + a.term))
  }, [raw])

  const coursesForSem = React.useMemo(() => {
    if (!raw) return []
    if (selSem === "all") return [...raw.courses].sort((a, b) => a.name.localeCompare(b.name))
    const semId = raw.semesters.find((semester) => semester.code === selSem)?.id
    if (!semId) return []
    const courseIds = new Set(raw.sections.filter((section) => section.semester_id === semId).map((section) => section.course_id))
    return raw.courses.filter((course) => courseIds.has(course.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [raw, selSem])

  const sectionsForFilter = React.useMemo(() => {
    if (!raw) return []
    const semId = selSem === "all" ? null : raw.semesters.find((semester) => semester.code === selSem)?.id
    return raw.sections.filter((section) => {
      const matchesSemester = semId === null || section.semester_id === semId
      const matchesCourse = selCourse === "all" || section.course_id === Number(selCourse)
      return matchesSemester && matchesCourse
    })
  }, [raw, selCourse, selSem])

  const sectionRows = React.useMemo(() => {
    if (!raw || !maps) return []
    const { courseMap, semMap } = maps
    const filterSecIds = new Set(sectionsForFilter.map((section) => section.id))
    const sectionEnrollments = new Map<number, typeof raw.enrollments>()
    for (const enrollment of raw.enrollments) {
      if (!filterSecIds.has(enrollment.section_id)) continue
      const rows = sectionEnrollments.get(enrollment.section_id) ?? []
      rows.push(enrollment)
      sectionEnrollments.set(enrollment.section_id, rows)
    }

    const benchmark = new Map<string, { valid: number; passed: number }>()
    for (const section of sectionsForFilter) {
      const key = `${section.course_id}:${section.semester_id}`
      const item = benchmark.get(key) ?? { valid: 0, passed: 0 }
      for (const enrollment of sectionEnrollments.get(section.id) ?? []) {
        if (enrollment.is_passed === null) continue
        item.valid += 1
        if (enrollment.is_passed) item.passed += 1
      }
      benchmark.set(key, item)
    }

    return sectionsForFilter.map((section) => {
      const enrollments = sectionEnrollments.get(section.id) ?? []
      const graded = enrollments.filter((enrollment) => enrollment.final_grade !== null)
      const valid = enrollments.filter((enrollment) => enrollment.is_passed !== null)
      const failed = valid.filter((enrollment) => enrollment.is_passed === false).length
      const nearFail = graded.filter((enrollment) => enrollment.final_grade! >= 4 && enrollment.final_grade! < 5).length
      const watch = graded.filter((enrollment) => enrollment.final_grade! >= 5 && enrollment.final_grade! < 5.5).length
      const atRisk = failed + nearFail + watch
      const passRate = valid.length ? +((valid.length - failed) / valid.length * 100).toFixed(1) : null
      const avgGrade = graded.length ? +(graded.reduce((sum, enrollment) => sum + enrollment.final_grade!, 0) / graded.length).toFixed(2) : null
      const bench = benchmark.get(`${section.course_id}:${section.semester_id}`) ?? { valid: 0, passed: 0 }
      const benchmarkPassRate = bench.valid ? +(bench.passed / bench.valid * 100).toFixed(1) : null
      const diff = benchmarkPassRate === null || passRate === null ? null : +(passRate - benchmarkPassRate).toFixed(1)
      const nearFailRate = graded.length ? nearFail / graded.length * 100 : 0
      const watchRate = graded.length ? watch / graded.length * 100 : 0
      let risk: SectionRiskLevel = "normal"
      if (!valid.length) risk = "pending"
      else if ((diff !== null && diff <= -15) || (passRate !== null && passRate <= 60)) risk = "high"
      else if ((passRate !== null && passRate < 70) || nearFailRate > 15) risk = "medium"
      else if (watchRate > 20) risk = "watch"
      return {
        id: section.id,
        courseId: section.course_id,
        code: section.section_code,
        course: courseMap.get(section.course_id)?.name ?? "-",
        semester: semMap.get(section.semester_id)?.code ?? "-",
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
        diff,
        risk,
      }
    })
  }, [raw, maps, sectionsForFilter])

  const visibleRows = React.useMemo(() => {
    const riskOrder: Record<SectionRiskLevel, number> = { high: 0, medium: 1, watch: 2, pending: 3, normal: 4 }
    return sectionRows
      .filter((row) => {
        if (selStatus === "needs_action") return row.risk === "high" || row.risk === "medium" || row.risk === "watch"
        if (selStatus === "pending") return row.risk === "pending"
        return true
      })
      .sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk] || (a.passRate ?? 999) - (b.passRate ?? 999) || b.atRisk - a.atRisk)
  }, [sectionRows, selStatus])

  const selectedSection = maps?.secMap.get(Number(selSection))
  const selectedCourse = selectedSection ? maps?.courseMap.get(selectedSection.course_id) : undefined
  const selectedSemester = selectedSection ? maps?.semMap.get(selectedSection.semester_id) : undefined
  const selectedRow = selectedSection ? sectionRows.find((row) => row.id === selectedSection.id) : undefined

  const overview = React.useMemo(() => {
    const totalValid = sectionRows.reduce((sum, row) => sum + row.valid, 0)
    const totalPassed = sectionRows.reduce((sum, row) => sum + row.valid - row.failed, 0)
    const gradedRows = sectionRows.filter((row) => row.graded > 0 && row.avgGrade !== null)
    const totalGraded = gradedRows.reduce((sum, row) => sum + row.graded, 0)
    return {
      totalSections: sectionRows.length,
      riskySections: sectionRows.filter((row) => row.risk === "high" || row.risk === "medium").length,
      totalAtRisk: sectionRows.reduce((sum, row) => sum + row.atRisk, 0),
      pendingGrades: sectionRows.reduce((sum, row) => sum + row.pending, 0),
      overallPassRate: totalValid ? +(totalPassed / totalValid * 100).toFixed(1) : null,
      overallAvgGrade: totalGraded ? +(gradedRows.reduce((sum, row) => sum + (row.avgGrade ?? 0) * row.graded, 0) / totalGraded).toFixed(2) : null,
    }
  }, [sectionRows])

  const sectionStats = React.useMemo(() => {
    if (!raw || !maps || !selectedSection) return null
    const secEnrolls = raw.enrollments.filter((enrollment) => enrollment.section_id === selectedSection.id)
    const graded = secEnrolls.filter((enrollment) => enrollment.final_grade !== null)
    const riskStudents: { id: number; code: string; name: string; grade: number | null; status: string; level: RiskLevel }[] = []
    for (const enrollment of secEnrolls) {
      const student = maps.studentMap.get(enrollment.student_id)
      if (!student) continue
      let level: RiskLevel | null = null
      if (enrollment.is_passed === false) level = "fail"
      else if (enrollment.final_grade !== null && enrollment.final_grade >= 4 && enrollment.final_grade < 5) level = "nearFail"
      else if (enrollment.final_grade !== null && enrollment.final_grade >= 5 && enrollment.final_grade < 5.5) level = "risk"
      if (level) {
        riskStudents.push({
          id: student.id,
          code: student.student_code,
          name: student.full_name,
          grade: enrollment.final_grade,
          status: enrollment.status,
          level,
        })
      }
    }
    const order: Record<RiskLevel, number> = { fail: 0, nearFail: 1, risk: 2 }
    riskStudents.sort((a, b) => order[a.level] - order[b.level] || (a.grade ?? 99) - (b.grade ?? 99))
    const distribution = DIST_RANGES.map((range) => {
      const count = graded.filter((enrollment) => enrollment.final_grade! >= range.min && enrollment.final_grade! < range.max).length
      return { ...range, count }
    })
    const gpaDistribution = GPA_BANDS.map((band) => {
      const count = secEnrolls.filter((enrollment) => {
        const gpa = maps.studentMap.get(enrollment.student_id)?.gpa_cumulative
        return gpa !== null && gpa !== undefined && gpa >= band.min && gpa < band.max
      }).length
      return { ...band, count }
    })
    const missingGpa = secEnrolls.filter((enrollment) => maps.studentMap.get(enrollment.student_id)?.gpa_cumulative === null).length
    const peerComparison = sectionRows
      .filter((row) => row.courseId === selectedSection.course_id && row.semester === selectedSemester?.code && row.graded > 0)
      .sort((a, b) => (b.avgGrade ?? 0) - (a.avgGrade ?? 0))
      .map((row) => ({
        id: row.id,
        label: row.code,
        avgGrade: row.avgGrade ?? 0,
        passRate: row.passRate ?? 0,
        atRisk: row.atRisk,
        isSelected: row.id === selectedSection.id,
      }))
    return {
      riskStudents,
      distribution,
      gpaDistribution: missingGpa > 0 ? [...gpaDistribution, { label: "Thiếu", min: 0, max: 0, color: "#94a3b8", count: missingGpa }] : gpaDistribution,
      peerComparison,
    }
  }, [raw, maps, selectedSection, selectedSemester?.code, sectionRows])

  const semLabel = selSem === "all" ? "Tất cả học kỳ" : raw?.semesters.find((semester) => semester.code === selSem)?.name ?? selSem
  const courseLabel = selCourse === "all" ? "Tất cả môn" : raw?.courses.find((course) => course.id === Number(selCourse))?.name ?? "Môn đã chọn"
  const campaignStudentIds = React.useMemo(() => {
    const priorityIds = agentSummary?.priority_students.map((student) => student.student_id) ?? []
    if (priorityIds.length) return priorityIds
    return sectionStats?.riskStudents.map((student) => student.id).slice(0, 20) ?? []
  }, [agentSummary, sectionStats])

  function getSectionCampaignStudentIds(summary: ApiInterventionScopeSummary | null) {
    const priorityIds = summary?.priority_students.map((student) => student.student_id) ?? []
    if (priorityIds.length) return priorityIds
    return sectionStats?.riskStudents.map((student) => student.id).slice(0, 20) ?? []
  }

  async function runSectionAgent() {
    if (!selectedSection) return
    setAgentLoading(true)
    setAgentError("")
    setAgentSummary(null)
    setCampaign(null)
    setCampaignResult(null)
    setMailPreviewMode("agent")
    setMailPreviewOpen(true)
    try {
      const summary = await api.summarizeInterventionScope({ scope_type: "section", scope_id: selectedSection.id })
      setAgentSummary(summary)
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không chạy được Agent hỗ trợ lớp học phần.")
    } finally {
      setAgentLoading(false)
    }
  }

  async function buildBulkEmails(openPreview = true, summaryOverride: ApiInterventionScopeSummary | null = agentSummary) {
    if (!selectedSection) return
    let summary = summaryOverride
    setMailDraftLoading(true)
    setAgentError("")
    setCampaignResult(null)
    if (openPreview) {
      setMailPreviewMode("mail")
      setMailPreviewOpen(true)
    }
    try {
      if (!summary) {
        summary = await api.summarizeInterventionScope({ scope_type: "section", scope_id: selectedSection.id })
        setAgentSummary(summary)
      }
      const studentIds = getSectionCampaignStudentIds(summary)
      const created = await api.createInterventionCampaign({
        scope_type: "section",
        scope_id: selectedSection.id,
        student_ids: studentIds,
        title: `Campaign hỗ trợ học tập - ${selectedSection.section_code}`,
        objective: "course_recovery",
        max_students: 20,
      })
      const result = await api.generateInterventionCampaignDrafts(created.id, {
        student_ids: studentIds,
        channel: "email",
        subject: `Hỗ trợ học tập lớp ${selectedSection.section_code}`,
        max_students: 20,
      })
      setCampaign(result)
      setMailPreviewMode("mail")
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không tạo được email nháp cho campaign.")
    } finally {
      setMailDraftLoading(false)
    }
  }

  async function createBulkNotifications() {
    if (!campaign) return
    setBulkLoading(true)
    setAgentError("")
    try {
      await api.approveInterventionCampaign(campaign.id)
      const result = await api.finalizeInterventionCampaign(campaign.id)
      setCampaign(result)
      setCampaignResult(result)
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không lưu được campaign hỗ trợ học tập.")
    } finally {
      setBulkLoading(false)
    }
  }

  async function saveCampaignMessage(messageId: number) {
    const draft = campaign?.messages.find((message) => message.id === messageId)
    if (!draft) return
    setSavingMessageId(messageId)
    setAgentError("")
    try {
      const updated = await api.updateInterventionCampaignMessage(messageId, {
        recipient_email: draft.recipient_email,
        subject: draft.subject,
        body: draft.body,
        status: draft.status === "failed" && draft.recipient_email ? "drafted" : undefined,
      })
      setCampaign((current) => current ? {
        ...current,
        messages: current.messages.map((message) => message.id === messageId ? updated : message),
      } : current)
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không lưu được chỉnh sửa email nháp.")
    } finally {
      setSavingMessageId(null)
    }
  }

  if (loading) {
    return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Đang tải lớp học phần...</div>
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isLecturer ? "Đánh giá các lớp được giao" : "Lớp học phần cần hỗ trợ"}
        </h1>
        <p className="text-sm text-muted-foreground">Dashboard kỳ hiện tại, phân tích lớp được chọn và hỗ trợ can thiệp sinh viên.</p>
      </div>

      {loadError ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</div> : null}

      <Card>
        <CardContent className="grid gap-3 py-4 lg:grid-cols-[180px_minmax(260px,1fr)_220px]">
          <Select value={selSem} onValueChange={(value) => {
            const next = value ?? "all"
            setSelSem(next)
            sessionStorage.setItem("vinuni_selected_semester", next)
            setSelCourse("all")
            setSelSection("all")
          }}>
            <SelectTrigger><span className="truncate">{semLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {semestersWithData.map((semester) => <SelectItem key={semester.id} value={semester.code}>{semester.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selCourse} onValueChange={(value) => { setSelCourse(value ?? "all"); setSelSection("all") }}>
            <SelectTrigger><span className="truncate">{courseLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả môn</SelectItem>
              {coursesForSem.map((course) => <SelectItem key={course.id} value={String(course.id)}>{course.code} - {course.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selStatus} onValueChange={(value) => setSelStatus((value ?? "all") as typeof selStatus)}>
            <SelectTrigger><span>{selStatus === "needs_action" ? "Cần xử lý" : selStatus === "pending" ? "Thiếu điểm" : "Tất cả trạng thái"}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="needs_action">Cần xử lý</SelectItem>
              <SelectItem value="pending">Thiếu điểm</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: isLecturer ? "Lớp được giao" : "Lớp trong phạm vi", value: overview.totalSections, icon: Users },
          { label: "Lớp cần xử lý", value: overview.riskySections, icon: AlertTriangle },
          { label: "SV cần chú ý", value: overview.totalAtRisk, icon: TrendingDown },
          { label: "Tỷ lệ đạt chung", value: overview.overallPassRate === null ? "-" : `${overview.overallPassRate}%`, icon: CheckCircle2 },
          { label: "Điểm TB", value: overview.overallAvgGrade === null ? "-" : overview.overallAvgGrade.toFixed(2), icon: Activity },
          { label: "Lượt thiếu điểm", value: overview.pendingGrades, icon: Clock3 },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
              </div>
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dashboard lớp học phần kỳ hiện tại</CardTitle>
          <p className="text-xs text-muted-foreground">Chọn một lớp để mở phân tích chi tiết. Bảng xếp theo mức cảnh báo và số sinh viên cần hỗ trợ.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Mức</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Lớp</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Môn</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">SV</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Có điểm</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Điểm TB</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Tỷ lệ đạt</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">SV hỗ trợ</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRows.slice(0, 100).map((row) => (
                  <tr key={row.id} className={selectedSection?.id === row.id ? "bg-primary/5" : "hover:bg-muted/30"}>
                    <td className="px-4 py-2"><Badge variant="outline" className={`text-[10px] ${riskClass(row.risk)}`}>{SECTION_RISK_LABEL[row.risk]}</Badge></td>
                    <td className="px-3 py-2 font-mono text-[11px] font-medium">{row.code}<p className="font-sans text-[10px] text-muted-foreground">{row.semester}</p></td>
                    <td className="max-w-[320px] truncate px-3 py-2">{row.course}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.graded}/{row.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.avgGrade === null ? "-" : row.avgGrade.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{row.passRate === null ? "-" : `${row.passRate}%`}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${row.atRisk ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>{row.atRisk}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant={selectedSection?.id === row.id ? "default" : "outline"} onClick={() => setSelSection(String(row.id))}>Phân tích</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRows.length ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Không có lớp phù hợp bộ lọc.</p> : null}
          </div>
        </CardContent>
      </Card>

      {selectedSection && selectedRow ? (
        <div className="grid gap-5">
          <Card className="border-primary/20">
            <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{selectedSection.section_code}</h2>
                  <Badge variant="outline" className={riskClass(selectedRow.risk)}>{SECTION_RISK_LABEL[selectedRow.risk]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{selectedCourse?.name ?? "Môn học"} · {selectedSemester?.name ?? selectedSemester?.code ?? "-"}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm sm:min-w-[360px]">
                <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">SV</p><p className="font-bold">{selectedRow.total}</p></div>
                <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Đạt</p><p className="font-bold">{selectedRow.passRate === null ? "-" : `${selectedRow.passRate}%`}</p></div>
                <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Cần hỗ trợ</p><p className="font-bold text-orange-600">{selectedRow.atRisk}</p></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Phân phối điểm</CardTitle>
                <p className="text-xs text-muted-foreground">Nhóm trượt/cận trượt và mức điểm cao trong lớp.</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sectionStats?.distribution ?? []} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip formatter={(value) => [value, "Sinh viên"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {(sectionStats?.distribution ?? []).map((range) => <Cell key={range.label} fill={range.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nhóm GPA sinh viên</CardTitle>
                <p className="text-xs text-muted-foreground">Nền học lực tích lũy của lớp.</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sectionStats?.gpaDistribution ?? []} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip formatter={(value) => [value, "Sinh viên"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {(sectionStats?.gpaDistribution ?? []).map((band) => <Cell key={band.label} fill={band.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">So với lớp cùng môn/kỳ</CardTitle>
                <p className="text-xs text-muted-foreground">Thanh xanh là lớp đang chọn.</p>
              </CardHeader>
              <CardContent>
                {(sectionStats?.peerComparison.length ?? 0) > 1 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={sectionStats?.peerComparison ?? []} layout="vertical" margin={{ left: 4, right: 20, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value, _name, item) => [
                          Number(value).toFixed(2),
                          `Điểm TB · đạt ${item.payload.passRate}% · ${item.payload.atRisk} SV hỗ trợ`,
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 6 }}
                      />
                      <ReferenceLine x={5} stroke="#ef4444" strokeDasharray="5 4" />
                      <Bar dataKey="avgGrade" radius={[0, 5, 5, 0]}>
                        {(sectionStats?.peerComparison ?? []).map((row) => <Cell key={row.id} fill={row.isSelected ? "#2563eb" : "#94a3b8"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-20 text-center text-sm text-muted-foreground">Chưa có lớp cùng môn/kỳ đủ dữ liệu để so sánh.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sinh viên cần hỗ trợ</CardTitle>
                <p className="text-xs text-muted-foreground">Danh sách thao tác: ai cần được liên hệ trước, mức rủi ro nào.</p>
              </CardHeader>
              <CardContent className="p-0">
                {!sectionStats?.riskStudents.length ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">Không có sinh viên nguy cơ trong lớp này.</p>
                ) : (
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-2.5 text-left">Sinh viên</th>
                          <th className="px-3 py-2.5 text-right">Điểm</th>
                          <th className="px-4 py-2.5 text-right">Mức</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sectionStats.riskStudents.map((student) => (
                          <tr key={student.id}>
                            <td className="px-4 py-2"><p className="font-medium">{student.name}</p><p className="font-mono text-[10px] text-muted-foreground">{student.code}</p></td>
                            <td className="px-3 py-2 text-right tabular-nums">{student.grade === null ? "-" : student.grade.toFixed(1)}</td>
                            <td className="px-4 py-2 text-right"><Badge variant={student.level === "fail" ? "destructive" : "outline"} className="text-[10px]">{LEVEL_LABEL[student.level]}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Agent can thiệp</CardTitle>
                <p className="text-xs text-muted-foreground">Tạo campaign hỗ trợ, email nháp cá nhân hóa và lưu vào lịch sử sau khi giảng viên duyệt.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {agentSummary ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Ưu tiên</p><p className="font-bold">{agentSummary.summary.high}</p></div>
                      <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Theo dõi</p><p className="font-bold">{agentSummary.summary.watch}</p></div>
                      <div className="rounded-md bg-muted/30 p-2"><p className="text-xs text-muted-foreground">Đã liên hệ</p><p className="font-bold">{agentSummary.summary.contacted}</p></div>
                    </div>
                    <ol className="space-y-2 text-sm">
                      {agentSummary.recommendations.slice(0, 3).map((item, index) => (
                        <li key={item} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{index + 1}</span>{item}</li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Chạy Agent sau khi chọn lớp để lấy danh sách sinh viên ưu tiên và kế hoạch can thiệp.</p>
                )}
                {agentError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{agentError}</p> : null}
                <Button className="w-full" onClick={runSectionAgent} disabled={agentLoading}>
                  <Sparkles className="mr-2 h-4 w-4" />{agentLoading ? "Đang phân tích..." : "Chạy Agent"}
                </Button>
                <Button className="w-full" onClick={() => void buildBulkEmails(true)} disabled={mailDraftLoading || campaignStudentIds.length === 0}>
                  <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : "Tạo & xem danh sách mail"}
                </Button>
                <Button className="w-full" variant="outline" onClick={() => void buildBulkEmails()} disabled={!agentSummary || mailDraftLoading || campaignStudentIds.length === 0}>
                  <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : "Tạo email nháp"}
                </Button>
                <Button className="w-full" variant="outline" onClick={() => { setMailPreviewMode(campaign ? "mail" : "agent"); setMailPreviewOpen(true) }} disabled={!agentSummary && !campaign}>
                  Xem kế hoạch / mail
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">Chọn một lớp trong dashboard để mở phân tích chi tiết.</CardContent>
        </Card>
      )}

      <Dialog open={mailPreviewOpen} onOpenChange={setMailPreviewOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{mailPreviewMode === "mail" ? "Campaign hỗ trợ học tập" : "Kế hoạch can thiệp của Agent"}</DialogTitle>
            <DialogDescription>Giảng viên xem lại email nháp trước khi duyệt và lưu vào lịch sử hỗ trợ. SMTP thật chưa bật trong MVP.</DialogDescription>
          </DialogHeader>
          {agentLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Agent đang tổng hợp lớp học phần...</div>
          ) : agentError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{agentError}</div>
          ) : mailPreviewMode === "mail" ? (
            campaign ? (
              <div className="max-h-[520px] overflow-auto rounded-lg border">
                <div className="sticky top-0 border-b bg-background p-3">
                  <p className="font-medium">{campaign.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Campaign #{campaign.id} · {campaign.messages.length} sinh viên · {campaign.messages.filter((message) => message.status === "failed").length} cần bổ sung email/dữ liệu
                  </p>
                </div>
                <div className="divide-y">
                  {campaign.messages.map((draft) => {
                    const reasons = Array.isArray(draft.metadata_json.reasons) ? draft.metadata_json.reasons.map(String) : []
                    const actions = Array.isArray(draft.metadata_json.recommended_actions) ? draft.metadata_json.recommended_actions.map(String) : []
                    return (
                    <div key={draft.id} className="grid gap-3 p-3 text-sm lg:grid-cols-[260px_minmax(0,1fr)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="font-medium">{draft.full_name ?? "Sinh viên"} <span className="font-mono text-xs text-muted-foreground">{draft.student_code}</span></p><p className="text-xs text-muted-foreground">To: {draft.recipient_email ?? "Thiếu email"}</p></div>
                        <Badge variant={draft.status === "failed" ? "destructive" : "outline"}>{draft.status}</Badge>
                        <div className="w-full space-y-2 rounded-md bg-muted/30 p-2 text-xs">
                          <p className="font-semibold text-foreground">Vấn đề cần hỗ trợ</p>
                          {reasons.length ? reasons.slice(0, 4).map((reason) => <p key={reason}>- {reason}</p>) : <p className="text-muted-foreground">Không có cảnh báo cụ thể, giảng viên có thể dùng để check-in định kỳ.</p>}
                          {actions.length ? (
                            <>
                              <p className="pt-1 font-semibold text-foreground">Gợi ý can thiệp</p>
                              {actions.slice(0, 3).map((action) => <p key={action}>- {action}</p>)}
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {draft.error_message ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{draft.error_message}</p> : null}
                        <input
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={draft.recipient_email ?? ""}
                          onChange={(event) => setCampaign((current) => current ? {
                            ...current,
                            messages: current.messages.map((message) => message.id === draft.id ? { ...message, recipient_email: event.target.value } : message),
                          } : current)}
                          placeholder="Email sinh viên"
                        />
                        <input
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
                          value={draft.subject ?? ""}
                          onChange={(event) => setCampaign((current) => current ? {
                            ...current,
                            messages: current.messages.map((message) => message.id === draft.id ? { ...message, subject: event.target.value } : message),
                          } : current)}
                          placeholder="Tiêu đề email"
                        />
                        <textarea
                          className="min-h-40 w-full resize-y rounded-md border bg-background px-3 py-2 text-xs leading-relaxed"
                          value={draft.body ?? ""}
                          onChange={(event) => setCampaign((current) => current ? {
                            ...current,
                            messages: current.messages.map((message) => message.id === draft.id ? { ...message, body: event.target.value } : message),
                          } : current)}
                          placeholder="Nội dung email nháp"
                        />
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => void saveCampaignMessage(draft.id)} disabled={savingMessageId === draft.id}>
                            {savingMessageId === draft.id ? "Đang lưu..." : "Lưu chỉnh sửa"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            ) : <p className="py-10 text-center text-sm text-muted-foreground">Chưa tạo campaign. Bấm “Tạo email nháp” trong panel Agent.</p>
          ) : agentSummary ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <div className="rounded-lg border p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sinh viên Agent chọn</p>
                {agentSummary.priority_students.length ? (
                  <div className="space-y-2">
                    {agentSummary.priority_students.map((student) => (
                      <div key={student.student_id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="font-medium">{student.full_name}</p><p className="font-mono text-[11px] text-muted-foreground">{student.student_code}</p></div>
                          <Badge variant={student.risk_level === "high" ? "destructive" : "outline"}>{student.risk_score}</Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{student.reasons.join("; ") || "Theo dõi định kỳ"}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Chưa có sinh viên cần ưu tiên.</p>}
              </div>
              <div className="rounded-lg border p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kế hoạch đề xuất</p>
                <ol className="space-y-2 text-sm">
                  {agentSummary.recommendations.map((item, index) => (
                    <li key={item} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{index + 1}</span>{item}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
          {campaignResult ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium">{campaignResult.message ?? "Đã lưu campaign vào lịch sử hỗ trợ."}</p>
              <p className="mt-1 text-muted-foreground">Đã lưu {campaignResult.created_contact_count ?? 0} liên hệ vào hồ sơ sinh viên. SMTP thật chưa bật.</p>
            </div>
          ) : null}
          <DialogFooter>
            {agentSummary ? (
              <>
                <Button variant="outline" onClick={() => void buildBulkEmails()} disabled={mailDraftLoading || campaignStudentIds.length === 0}>
                  <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : "Tạo email nháp"}
                </Button>
                <Button onClick={createBulkNotifications} disabled={bulkLoading || !campaign || campaign.messages.every((message) => message.status === "failed")}>
                  <Sparkles className="mr-2 h-4 w-4" />{bulkLoading ? "Đang lưu..." : "Duyệt & lưu campaign"}
                </Button>
              </>
            ) : null}
            <Button variant="outline" onClick={() => setMailPreviewOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
