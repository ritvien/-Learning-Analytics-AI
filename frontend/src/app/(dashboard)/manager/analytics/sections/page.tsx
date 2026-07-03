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
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  type ApiDepartment,
  type ApiInterventionCampaign,
  type ApiInterventionScopeSummary,
  type ApiSectionInterventionWorklist,
  type ApiProgram,
} from "@/lib/api"
import { requestDashboardAgent, setDashboardAgentContext } from "@/lib/dashboard-agent-context"

type Raw = {
  departments: ApiDepartment[]
  courses: Awaited<ReturnType<typeof api.getCourses>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  programs: ApiProgram[]
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

function riskDotColor(level: SectionRiskLevel) {
  if (level === "high") return "#dc2626"
  if (level === "medium") return "#f97316"
  if (level === "watch") return "#f59e0b"
  if (level === "pending") return "#64748b"
  return "#16a34a"
}

export default function SectionsRiskPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [selSem, setSelSem] = React.useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("vinuni_selected_semester") || "all"
    return "all"
  })
  const [selDept, setSelDept] = React.useState("all")
  const [selProg, setSelProg] = React.useState("all")
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
  const [interventionWorklist, setInterventionWorklist] = React.useState<ApiSectionInterventionWorklist | null>(null)

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
      ? { section_id: Number.isFinite(parsedSectionId) ? parsedSectionId : undefined, limit: 50000 }
      : queryCourse
        ? { course_id: Number.isFinite(parsedCourseId) ? parsedCourseId : undefined, limit: 50000 }
        : { limit: 50000 }

    setLoading(true)
    setLoadError("")
    Promise.all([
      api.getDepartments({ limit: 100 }),
      api.getCourses({ limit: 500 }),
      api.getEnrollments(enrollmentFilter),
      api.getPrograms({ limit: 1000 }),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
      api.getStudents({ limit: 5000 }),
      api.getSectionInterventionWorklist({ limit: 2000 }).catch(() => null),
    ])
      .then(([departments, courses, enrollments, programs, sections, semesters, students, worklist]) => {
        setRaw({ departments, courses, enrollments, programs, sections, semesters, students })
        setInterventionWorklist(worklist)
        const defaultDept = lockedDepartmentId ?? "all"
        setSelDept(defaultDept)
        setSelProg("all")
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
          const linkedCourse = courses.find((course) => course.id === linkedSection.course_id)
          if (linkedCourse) {
            setSelDept(String(linkedCourse.department_id))
            setSelProg(linkedCourse.program_ids.length === 1 ? String(linkedCourse.program_ids[0]) : "all")
          }
        } else if (queryCourse && courses.some((course) => String(course.id) === queryCourse)) {
          setSelCourse(queryCourse)
          const linkedCourse = courses.find((course) => String(course.id) === queryCourse)
          if (linkedCourse) {
            setSelDept(String(linkedCourse.department_id))
            setSelProg(linkedCourse.program_ids.length === 1 ? String(linkedCourse.program_ids[0]) : "all")
          }
        }
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Không tải được dữ liệu lớp học phần."))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const semId = selSem === "all" ? null : raw.semesters.find((semester) => semester.code === selSem)?.id ?? null
    const selectedDeptId = selDept === "all" ? null : Number(selDept)
    const selectedProgId = selProg === "all" ? null : Number(selProg)
    const courseIdsForSem = semId === null
      ? null
      : new Set(raw.sections.filter((section) => section.semester_id === semId).map((section) => section.course_id))
    return raw.courses
      .filter((course) => (courseIdsForSem === null || courseIdsForSem.has(course.id)))
      .filter((course) => selectedDeptId === null || course.department_id === selectedDeptId)
      .filter((course) => selectedProgId === null || course.program_ids.includes(selectedProgId))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [raw, selDept, selProg, selSem])

  const programsForDept = React.useMemo(() => {
    if (!raw) return []
    const selectedDeptId = selDept === "all" ? null : Number(selDept)
    return raw.programs
      .filter((program) => selectedDeptId === null || program.department_id === selectedDeptId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [raw, selDept])

  React.useEffect(() => {
    if (!raw) return
    if (selDept !== "all" && selProg !== "all") {
      const currentProgram = raw.programs.find((program) => program.id === Number(selProg))
      if (currentProgram && currentProgram.department_id !== Number(selDept)) {
        setSelProg("all")
      }
    }
  }, [raw, selDept, selProg])

  const sectionsForFilter = React.useMemo(() => {
    if (!raw) return []
    const semId = selSem === "all" ? null : raw.semesters.find((semester) => semester.code === selSem)?.id
    const selectedDeptId = selDept === "all" ? null : Number(selDept)
    const selectedProgId = selProg === "all" ? null : Number(selProg)
    return raw.sections.filter((section) => {
      const course = raw.courses.find((item) => item.id === section.course_id)
      const matchesSemester = semId === null || section.semester_id === semId
      const matchesCourse = selCourse === "all" || section.course_id === Number(selCourse)
      const matchesDept = selectedDeptId === null || course?.department_id === selectedDeptId
      const matchesProgram = selectedProgId === null || !!course?.program_ids.includes(selectedProgId)
      return matchesSemester && matchesCourse && matchesDept && matchesProgram
    })
  }, [raw, selCourse, selDept, selProg, selSem])

  const sectionRows = React.useMemo(() => {
    if (!raw || !maps) return []
    const { courseMap, semMap } = maps
    const filterSecIds = new Set(sectionsForFilter.map((section) => section.id))
    const interventionMap = new Map((interventionWorklist?.sections ?? []).map((section) => [section.id, section]))
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
      const intervention = interventionMap.get(section.id)
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
      const riskReasons = [
        !valid.length ? "Chưa đủ điểm" : null,
        passRate !== null && passRate <= 60 ? "Tỷ lệ đạt <= 60%" : null,
        diff !== null && diff <= -15 ? "Thấp hơn benchmark >= 15đ" : null,
        passRate !== null && passRate > 60 && passRate < 70 ? "Tỷ lệ đạt dưới 70%" : null,
        nearFailRate > 15 ? "Cận trượt > 15%" : null,
        watchRate > 20 ? "Sát ngưỡng > 20%" : null,
      ].filter((item): item is string => Boolean(item))
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
        riskReasons,
        supportPriority: intervention?.support_priority ?? "normal",
        supportStudents: intervention?.students_with_signals ?? atRisk,
        highSupportStudents: intervention?.high_students ?? 0,
        watchSupportStudents: intervention?.watch_students ?? 0,
        openCases: intervention?.case_summary.open ?? 0,
        overdueCases: intervention?.case_summary.overdue ?? 0,
        courseRiskCoverage: intervention?.data_confidence.course_risk_coverage ?? null,
        predictionCoverage: intervention?.data_confidence.prediction_coverage ?? intervention?.data_confidence.ml_coverage ?? null,
        interventionSignals: intervention?.signals ?? [],
      }
    })
  }, [raw, maps, sectionsForFilter, interventionWorklist])

  const selectedSemester = raw?.semesters.find(s => s.code === selSem)
  const selectedCourse = maps?.courseMap.get(Number(selCourse))
  const selectedSection = maps?.secMap.get(Number(selSection))
  const selectedSectionSemester = selectedSection ? maps?.semMap.get(selectedSection.semester_id) : undefined
  const semLabel = selectedSemester ? `${selectedSemester.name} (${selectedSemester.code})` : "Tất cả học kỳ"
  const courseLabel = selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : "Tất cả môn"
  const sectionLabel = selectedSection ? `${selectedSection.section_code} - ${selectedSectionSemester?.code ?? "chưa rõ kỳ"}` : "Tất cả lớp học phần"

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isLecturer ? "Đánh giá các lớp được giao" : "Lớp học phần cần hỗ trợ"}
          </h1>
          <p className="text-sm text-muted-foreground">Dashboard kỳ hiện tại để lọc, so sánh và mở phân tích chuyên sâu cho từng lớp học phần.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => requestDashboardAgent("Phân tích dashboard lớp học phần hiện tại: nêu lớp rủi ro nhất, xu hướng từ biểu đồ, cảnh báo cần ưu tiên và bước xử lý tiếp theo.")}
        >
          <MessageSquare className="mr-2 h-4 w-4" />Agent phân tích màn hình
        </Button>
      </div>

      {loadError ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</div> : null}

      <Card>
        <CardContent className="grid gap-3 py-4 lg:grid-cols-[170px_180px_220px_minmax(240px,1fr)_220px]">
          <Select value={selSem} onValueChange={(value) => {
            const next = value ?? "all"
            setSelSem(next)
            sessionStorage.setItem("vinuni_selected_semester", next)
            setSelSection("all")
            setSelCourse("all")
            setSelProg("all")
          }}>
            <SelectTrigger><span className="truncate">{semLabel}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {semestersWithData.map((semester) => <SelectItem key={semester.id} value={semester.code}>{semester.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={selDept}
            onValueChange={(value) => {
              setSelDept(value ?? "all")
              setSelProg("all")
              setSelCourse("all")
              setSelSection("all")
            }}
            disabled={Boolean(lockedDepartmentId)}
          >
            <SelectTrigger>
              <span className="truncate">{deptLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {!lockedDepartmentId ? <SelectItem value="all">Tất cả khoa</SelectItem> : null}
              {raw?.departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selProg}
            onValueChange={(value) => {
              setSelProg(value ?? "all")
              setSelCourse("all")
              setSelSection("all")
            }}
            disabled={selDept === "all" || (Boolean(lockedDepartmentId) && programsForDept.length === 0)}
          >
            <SelectTrigger>
              <span className="truncate">{progLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ngành</SelectItem>
              {programsForDept.map((program) => (
                <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>
              ))}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bản đồ rủi ro lớp học phần</CardTitle>
            <p className="text-xs text-muted-foreground">Mỗi điểm là một lớp; càng lệch xuống dưới và càng gần bên trái càng cần mở phân tích trước.</p>
          </CardHeader>
          <CardContent>
            {riskScatterRows.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ left: 0, right: 16, top: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="passRate"
                    name="Tỷ lệ đạt"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="diff"
                    name="So benchmark"
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 10 }}
                    width={42}
                  />
                  <ZAxis type="number" dataKey="size" range={[70, 420]} />
                  <ReferenceLine x={70} stroke="#f59e0b" strokeDasharray="5 4" />
                  <ReferenceLine y={-15} stroke="#dc2626" strokeDasharray="5 4" />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(value, name, item) => {
                      const row = item.payload as (typeof riskScatterRows)[number]
                      if (name === "Tỷ lệ đạt") return [`${Number(value).toFixed(1)}%`, `${row.code} · ${row.reason}`]
                      if (name === "So benchmark") return [`${Number(value).toFixed(1)} điểm %`, `${row.atRisk} SV cần hỗ trợ · ${row.total} SV`]
                      return [value, name]
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Scatter
                    data={riskScatterRows}
                    onClick={(point: unknown) => {
                      const row = point as { id?: number }
                      if (row.id) router.push(`/manager/analytics/sections/${row.id}`)
                    }}
                    className="cursor-pointer"
                  >
                    {riskScatterRows.map((row) => (
                      <Cell key={row.id} fill={riskDotColor(row.risk)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">Chưa có lớp đủ dữ liệu điểm và benchmark để vẽ bản đồ rủi ro.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cơ cấu cảnh báo</CardTitle>
            <p className="text-xs text-muted-foreground">Phân bổ lớp theo mức ưu tiên trong phạm vi lọc.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskDistribution.map((item) => {
              const count = item.value
              const percent = overview.totalSections ? Math.round(count / overview.totalSections * 100) : 0
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">{count} lớp · {percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
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
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRows.slice(0, 100).map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-primary/5"
                    onClick={() => router.push(`/manager/analytics/sections/${row.id}`)}
                  >
                    <td className="px-4 py-2"><Badge variant="outline" className={`text-[10px] ${riskClass(row.risk)}`}>{SECTION_RISK_LABEL[row.risk]}</Badge></td>
                    <td className="px-3 py-2 font-mono text-[11px] font-medium">{row.code}<p className="font-sans text-[10px] text-muted-foreground">{row.semester}</p></td>
                    <td className="max-w-[320px] truncate px-3 py-2">{row.course}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.graded}/{row.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.avgGrade === null ? "-" : row.avgGrade.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{row.passRate === null ? "-" : `${row.passRate}%`}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${row.supportStudents ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>
                      {row.supportStudents}
                      <p className="text-[10px] font-normal text-muted-foreground">
                        case {row.openCases} Â· risk {row.courseRiskCoverage === null ? "N/A" : `${Math.round(row.courseRiskCoverage * 100)}%`}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {(row.riskReasons.length ? row.riskReasons.slice(0, 2) : ["Không có cảnh báo"]).map((reason) => (
                          <Badge key={reason} variant="outline" className="text-[10px]">{reason}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRows.length ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Không có lớp phù hợp bộ lọc.</p> : null}
          </div>
        </CardContent>
      </Card>

      {selectedSection && selectedRow && (
        <div className="grid gap-5">
          <Card className="border-primary/20">
            <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{selectedSection.section_code}</h2>
                  <Badge variant="outline" className={riskClass(selectedRow.risk)}>{SECTION_RISK_LABEL[selectedRow.risk]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{selectedCourse?.name ?? "Môn học"} · {selectedSemester?.name ?? selectedSemester?.code ?? "-"}</p>
                {selectedRow.riskReasons.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedRow.riskReasons.map((reason) => (
                      <Badge key={reason} variant="outline" className="text-[10px]">{reason}</Badge>
                    ))}
                  </div>
                ) : null}
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
                <p className="text-xs text-muted-foreground">So theo tỷ lệ đạt; thanh xanh là lớp đang chọn.</p>
              </CardHeader>
              <CardContent>
                {(sectionStats?.peerComparison.length ?? 0) > 1 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={sectionStats?.peerComparison ?? []} layout="vertical" margin={{ left: 4, right: 20, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value, _name, item) => [
                          `${Number(value).toFixed(1)}%`,
                          `Tỷ lệ đạt · điểm TB ${item.payload.avgGrade.toFixed(2)} · ${item.payload.atRisk} SV hỗ trợ`,
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 6 }}
                      />
                      <ReferenceLine x={70} stroke="#f59e0b" strokeDasharray="5 4" />
                      <Bar dataKey="passRate" radius={[0, 5, 5, 0]}>
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
            ) : <p className="py-10 text-center text-sm text-muted-foreground">Chưa tạo campaign. Mở “Xem kế hoạch / mail” để bắt đầu.</p>
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
                  <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : "Tạo nháp email"}
                </Button>
                <Button onClick={createBulkNotifications} disabled={bulkLoading || !campaign || campaign.messages.every((message) => message.status === "failed")}>
                  <Sparkles className="mr-2 h-4 w-4" />{bulkLoading ? "Đang gửi..." : "Gửi email"}
                </Button>
              </>
            ) : null}
            <Button variant="outline" onClick={() => setMailPreviewOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      )}
    </div>
  )
}
