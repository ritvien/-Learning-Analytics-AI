"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowLeftRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  Info,
  Library,
  ListChecks,
  Loader2,
  Play,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react"

import {
  api,
  type ApiCourse,
  type ApiProgram,
  type ApiReport,
  type ApiReportAgentAskResponse,
  type ApiReportAgentMode,
  type ApiReportAgentPendingAction,
  type ApiReportType,
  type ApiSection,
  type ApiSemester,
} from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type TemplateId =
  | "weekly_class_risk"
  | "course_clo"
  | "program_plo"
  | "faculty_performance"
  | "school_executive"
  | "student_outcome"
  | "accreditation_evidence"
  | "outcome_gap"
  | "course_improvement"

interface ReportTemplate {
  id: TemplateId
  title: string
  purpose: string
  actor: string
  backendType: ApiReportType
  scopeType: "school" | "program" | "section"
  detail: string
}

const templates: ReportTemplate[] = [
  {
    id: "weekly_class_risk",
    title: "Báo cáo rủi ro lớp hằng tuần",
    purpose: "Nhìn nhanh lớp nào có rủi ro trong tuần và cần can thiệp.",
    actor: "Giảng viên, cố vấn",
    backendType: "section_intervention",
    scopeType: "section",
    detail: "Danh sách cần chú ý, tỷ lệ đạt, điểm trung bình, hành động theo lớp.",
  },
  {
    id: "course_clo",
    title: "Báo cáo CLO học phần",
    purpose: "Theo dõi CLO học phần và điểm nghẽn đánh giá.",
    actor: "Giảng viên, trưởng bộ môn",
    backendType: "section_intervention",
    scopeType: "section",
    detail: "CLO yếu, điểm thành phần, đề xuất cải tiến học phần.",
  },
  {
    id: "program_plo",
    title: "Báo cáo PLO ngành",
    purpose: "Chốt ảnh chụp chuẩn đầu ra theo ngành.",
    actor: "Trưởng ngành, quản lý",
    backendType: "program_health",
    scopeType: "program",
    detail: "PLO, học phần nghẽn, rủi ro theo khóa/ngành.",
  },
  {
    id: "faculty_performance",
    title: "Báo cáo hiệu quả khoa",
    purpose: "Tổng hợp sức khỏe học vụ theo khoa.",
    actor: "Trưởng khoa, quản lý",
    backendType: "program_health",
    scopeType: "program",
    detail: "Bản hiện tại dùng phạm vi ngành làm đại diện trước khi có bộ thu thập dữ liệu cấp khoa.",
  },
  {
    id: "school_executive",
    title: "Báo cáo điều hành toàn trường",
    purpose: "Báo cáo toàn trường cho quản trị.",
    actor: "Ban giám hiệu, quản lý",
    backendType: "school_overview",
    scopeType: "school",
    detail: "Tỷ lệ đạt, điểm trung bình, sinh viên nguy cơ, hành động cấp trường.",
  },
  {
    id: "student_outcome",
    title: "Hồ sơ đầu ra sinh viên",
    purpose: "Hồ sơ can thiệp cá nhân cho sinh viên.",
    actor: "Cố vấn, giảng viên",
    backendType: "section_intervention",
    scopeType: "section",
    detail: "Bản hiện tại dùng danh sách lớp cần chú ý trước khi có hồ sơ cá nhân.",
  },
  {
    id: "accreditation_evidence",
    title: "Báo cáo minh chứng kiểm định",
    purpose: "Đóng gói bằng chứng kiểm định.",
    actor: "Đảm bảo chất lượng, phòng đào tạo",
    backendType: "program_health",
    scopeType: "program",
    detail: "Minh chứng, phụ lục dữ liệu, trạng thái phê duyệt.",
  },
  {
    id: "outcome_gap",
    title: "Báo cáo khoảng cách chuẩn đầu ra",
    purpose: "Chỉ ra khoảng cách chuẩn đầu ra cần xử lý.",
    actor: "Quản lý, trưởng ngành",
    backendType: "program_health",
    scopeType: "program",
    detail: "Khoảng cách PLO/CLO, nguyên nhân và danh sách hành động.",
  },
  {
    id: "course_improvement",
    title: "Báo cáo cải tiến học phần",
    purpose: "Biến kết quả học phần thành kế hoạch cải tiến.",
    actor: "Giảng viên, bộ môn",
    backendType: "section_intervention",
    scopeType: "section",
    detail: "Điểm chưa tốt, rủi ro, đề xuất cải tiến lần dạy sau.",
  },
]

interface ActorRole {
  value: string
  label: string
  description: string
  templates: TemplateId[]
}

const actorRoles: ActorRole[] = [
  {
    value: "lecturer",
    label: "Giảng viên",
    description: "Theo dõi lớp học phần đang giảng dạy",
    templates: ["weekly_class_risk", "course_clo", "student_outcome", "course_improvement"],
  },
  {
    value: "advisor",
    label: "Cố vấn học tập",
    description: "Theo dõi sinh viên cần can thiệp",
    templates: ["weekly_class_risk", "student_outcome"],
  },
  {
    value: "dept_head",
    label: "Trưởng bộ môn",
    description: "Quản lý học phần và CLO theo bộ môn",
    templates: ["course_clo", "program_plo", "faculty_performance", "outcome_gap", "course_improvement"],
  },
  {
    value: "manager",
    label: "Quản lý đào tạo",
    description: "Theo dõi sức khỏe ngành và tiêu chuẩn",
    templates: ["program_plo", "faculty_performance", "school_executive", "accreditation_evidence", "outcome_gap"],
  },
  {
    value: "executive",
    label: "Ban giám hiệu",
    description: "Báo cáo tổng hợp toàn trường",
    templates: ["school_executive", "accreditation_evidence", "program_plo"],
  },
  {
    value: "qa",
    label: "Đảm bảo chất lượng",
    description: "Minh chứng kiểm định và khoảng cách PLO",
    templates: ["accreditation_evidence", "program_plo", "outcome_gap"],
  },
]

const modeLabels: Record<ApiReportAgentMode, string> = {
  explain: "Giải thích chỉ số",
  root_cause: "Phân tích nguyên nhân",
  narrative: "Viết phần diễn giải",
  action_planning: "Đề xuất hành động",
  workflow: "Tạo luồng công việc",
  compare: "So sánh",
}

const formatLabels: Record<string, string> = {
  web: "Trang web",
  web_pdf: "Trang web + PDF",
  web_pdf_excel: "Trang web + PDF + Excel",
}

const detailLabels: Record<string, string> = {
  summary: "Tóm tắt",
  standard: "Tiêu chuẩn",
  detailed: "Chi tiết",
}

const reportTypeLabels: Record<string, string> = {
  school_overview: "Toàn trường",
  program_health: "Sức khỏe ngành",
  section_intervention: "Can thiệp lớp học phần",
}

const scopeTypeLabels: Record<string, string> = {
  school: "Toàn trường",
  program: "Ngành",
  section: "Lớp học phần",
}

const statusLabels: Record<string, string> = {
  draft: "Bản nháp",
  final: "Bản chính thức",
  approved: "Đã duyệt",
  archived: "Đã lưu trữ",
  ready: "Sẵn sàng",
  planned: "Đã lên kế hoạch",
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  canceled: "Đã hủy",
}

function labelFromMap(value: unknown, map: Record<string, string>, fallback = "Chưa rõ") {
  const key = String(value ?? "")
  return map[key] ?? (key ? key : fallback)
}

function localizeReportText(value: unknown) {
  return String(value ?? "")
    .replace(/\bpass rate\b/gi, "tỷ lệ đạt")
    .replace(/\bat risk\b/gi, "nguy cơ")
    .replace(/\bwatchlist\b/gi, "danh sách cần chú ý")
    .replace(/\brule-based fallback\b/gi, "diễn giải theo luật")
    .replace(/\brule-based\b/gi, "theo luật")
    .replace(/\breport snapshot\b/gi, "ảnh chụp báo cáo")
    .replace(/\bsnapshot\b/gi, "ảnh chụp")
    .replace(/\breport\b/gi, "báo cáo")
    .replace(/\baction list\b/gi, "danh sách hành động")
    .replace(/\baction\b/gi, "hành động")
    .replace(/\bissue\b/gi, "vấn đề")
    .replace(/\brisk\b/gi, "rủi ro")
    .replace(/\bcompleted\b/gi, "đã hoàn thành")
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "-"
}

function metricNumber(report: ApiReport | null, key: string) {
  const value = report?.metrics_json?.[key]
  return typeof value === "number" ? value : null
}

function riskVariant(value: unknown): "destructive" | "secondary" | "outline" {
  if (value === "Cao") return "destructive"
  if (value === "Trung bình") return "secondary"
  return "outline"
}

function reportStatusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "approved") return "default"
  if (status === "final") return "secondary"
  return "outline"
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

interface WatchlistEntry {
  studentCode?: string
  fullName?: string
  grade?: number | null
  reason?: string
}

// Backend stores `watchlist` as objects {student_code, full_name, grade, reason}.
// Normalize so the UI never renders "[object Object]".
function normalizeWatchlist(value: unknown): WatchlistEntry[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>
      return {
        studentCode: o.student_code != null ? String(o.student_code) : undefined,
        fullName: o.full_name != null ? String(o.full_name) : undefined,
        grade: typeof o.grade === "number" ? o.grade : null,
        reason: o.reason != null ? String(o.reason) : undefined,
      }
    }
    return { fullName: String(item) }
  })
}

function getMetric(report: ApiReport | null, key: string) {
  return report?.metrics_json?.[key]
}

function asPercent(value: unknown) {
  return typeof value === "number" ? Math.max(0, Math.min(100, value)) : 0
}

function confidenceSample(report: ApiReport | null) {
  const completed = getMetric(report, "completed_enrollments")
  const evidence = getMetric(report, "evidence_count")
  const graded = getMetric(report, "graded_count")
  return Number(completed ?? evidence ?? graded ?? 0)
}

function dataConfidence(report: ApiReport | null) {
  if (!report) return 0
  const sample = confidenceSample(report)
  if (sample >= 200) return 92
  if (sample >= 50) return 78
  if (sample > 0) return 58
  return 42
}

// Explains, in plain Vietnamese, what the confidence score is computed from —
// so the number is auditable instead of looking arbitrary.
function dataConfidenceBasis(report: ApiReport | null): string {
  if (!report) return "Chưa có dữ liệu để chấm độ tin cậy."
  const m = report.metrics_json ?? {}
  const sample = confidenceSample(report)
  const parts: string[] = []
  if (m.graded_count != null && m.student_count != null) {
    parts.push(`${m.graded_count}/${m.student_count} sinh viên đã có kết quả`)
  } else if (m.completed_enrollments != null) {
    parts.push(`${m.completed_enrollments} lượt học phần đã hoàn tất`)
  } else if (m.evidence_count != null) {
    parts.push(`${m.evidence_count} minh chứng đã thu thập`)
  }
  const band =
    sample >= 200
      ? "cỡ mẫu lớn (≥ 200) → 92%"
      : sample >= 50
        ? "cỡ mẫu vừa (50–199) → 78%"
        : sample > 0
          ? "cỡ mẫu nhỏ (1–49) → 58%"
          : "chưa đủ mẫu → 42%"
  parts.push(`xếp bậc theo ${band}`)
  if (!m.llm_enhanced) parts.push("nội dung đang diễn giải theo luật, chưa qua mô hình ngôn ngữ")
  return `Tính từ: ${parts.join(" · ")}.`
}

function buildSectionLabel(
  section: ApiSection,
  courseMap: Map<number, ApiCourse>,
  semesterMap: Map<number, ApiSemester>,
): string {
  const course = courseMap.get(section.course_id)
  const semester = semesterMap.get(section.semester_id)
  const parts: string[] = []
  if (course) parts.push(course.name || course.code)
  parts.push(section.section_code)
  if (semester) parts.push(semester.name)
  return parts.join(" · ")
}

function downloadReportHtml(report: ApiReport) {
  const html = buildReportHtml(report)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${report.title.replace(/[^\w-]+/g, "-").toLowerCase() || "bao-cao"}.html`
  link.click()
  URL.revokeObjectURL(url)
}

function printReport(report: ApiReport) {
  const printWindow = window.open("", "_blank", "width=1100,height=900")
  if (!printWindow) return
  printWindow.document.write(buildReportHtml(report))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function buildReportHtml(report: ApiReport) {
  const metrics = report.metrics_json ?? {}
  const issues = stringList(metrics.issues)
  const risks = stringList(metrics.risks)
  const actions = stringList(metrics.actions)
  const goodSignals = stringList(metrics.good_signals)
  const rows = Object.entries(metrics)
    .filter(([, value]) => !Array.isArray(value) && typeof value !== "object")
    .map(([key, value]) => `<tr><td>${key}</td><td>${localizeReportText(value)}</td></tr>`)
    .join("")

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${report.title}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #172033; margin: 0; background: #f4f7fb; }
    main { max-width: 980px; margin: 0 auto; padding: 40px 28px; }
    .hero { background: #fff; border: 1px solid #d8e1ee; border-radius: 16px; padding: 28px; }
    h1 { margin: 0; font-size: 30px; } h2 { margin-top: 28px; font-size: 18px; } p { line-height: 1.6; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; }
    .box { background: #fff; border: 1px solid #d8e1ee; border-radius: 12px; padding: 16px; }
    .label { font-size: 12px; color: #64748b; } .value { margin-top: 6px; font-size: 24px; font-weight: 700; }
    ul { padding-left: 20px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    td { border: 1px solid #d8e1ee; padding: 10px; font-size: 13px; }
    pre { white-space: pre-wrap; background: #fff; border: 1px solid #d8e1ee; border-radius: 12px; padding: 16px; }
    @media print { body { background: #fff; } main { padding: 0; } }
  </style>
</head>
<body><main>
  <section class="hero">
    <div class="label">${labelFromMap(report.report_type, reportTypeLabels)} · ${formatDate(report.created_at)}</div>
    <h1>${report.title}</h1><p>${localizeReportText(report.summary)}</p>
    <div class="meta">
      <div class="box"><div class="label">Trạng thái</div><div class="value">${labelFromMap(report.status, statusLabels)}</div></div>
      <div class="box"><div class="label">Rủi ro</div><div class="value">${String(metrics.risk_level ?? "-")}</div></div>
      <div class="box"><div class="label">Tỷ lệ đạt</div><div class="value">${String(metrics.pass_rate ?? "-")}%</div></div>
      <div class="box"><div class="label">Cần chú ý</div><div class="value">${String(metrics.at_risk_students ?? metrics.watchlist_count ?? "-")}</div></div>
    </div>
  </section>
  <h2>Tín hiệu tốt</h2><ul>${goodSignals.map((i) => `<li>${localizeReportText(i)}</li>`).join("") || "<li>Chưa có.</li>"}</ul>
  <h2>Điểm chưa tốt</h2><ul>${issues.map((i) => `<li>${localizeReportText(i)}</li>`).join("") || "<li>Chưa có.</li>"}</ul>
  <h2>Rủi ro</h2><ul>${risks.map((i) => `<li>${localizeReportText(i)}</li>`).join("") || "<li>Chưa có.</li>"}</ul>
  <h2>Danh sách hành động</h2><ul>${actions.map((i) => `<li>${localizeReportText(i)}</li>`).join("") || "<li>Chưa có.</li>"}</ul>
  <h2>Phụ lục chỉ số</h2><table>${rows}</table>
  <h2>Nội dung báo cáo</h2><pre>${localizeReportText(report.content_markdown)}</pre>
</main></body></html>`
}

export default function ReportsPage() {
  const [reports, setReports] = React.useState<ApiReport[]>([])
  const [programs, setPrograms] = React.useState<ApiProgram[]>([])
  const [sections, setSections] = React.useState<ApiSection[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [semesters, setSemesters] = React.useState<ApiSemester[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<TemplateId>("program_plo")
  const [selectedReport, setSelectedReport] = React.useState<ApiReport | null>(null)
  const [selectedProgramId, setSelectedProgramId] = React.useState("")
  const [selectedSectionId, setSelectedSectionId] = React.useState("")
  const [selectedSemesterId, setSelectedSemesterId] = React.useState("")
  const [detailLevel, setDetailLevel] = React.useState("standard")
  const [formats, setFormats] = React.useState("web_pdf_excel")
  const [agentMode, setAgentMode] = React.useState<ApiReportAgentMode>("explain")
  const [agentQuestion, setAgentQuestion] = React.useState(
    "Giải thích tỷ lệ đạt của báo cáo này được tính như thế nào và có đáng tin không?",
  )
  const [agentSessionId, setAgentSessionId] = React.useState<string | undefined>()
  const [agentAnswer, setAgentAnswer] = React.useState<ApiReportAgentAskResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isAsking, setIsAsking] = React.useState(false)
  const [error, setError] = React.useState("")
  // Phase 2 — wizard
  const [wizardMode, setWizardMode] = React.useState(false)
  const [wizardStep, setWizardStep] = React.useState<1 | 2 | 3>(1)
  const [wizardActorRole, setWizardActorRole] = React.useState("lecturer")
  // Phase 2 — library filters
  const [librarySearch, setLibrarySearch] = React.useState("")
  const [libraryTypeFilter, setLibraryTypeFilter] = React.useState("all")
  // Phase 3 — comparison
  const [compareReportId, setCompareReportId] = React.useState<string | null>(null)

  const courseMap = React.useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const semesterMap = React.useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0]
  const selectedProgram = programs.find((p) => String(p.id) === selectedProgramId)
  const selectedSemester = semesters.find((s) => String(s.id) === selectedSemesterId)

  const filteredSections = React.useMemo(() => {
    if (!selectedSemesterId) return sections
    return sections.filter((s) => String(s.semester_id) === selectedSemesterId)
  }, [sections, selectedSemesterId])

  const selectedSection = filteredSections.find((s) => String(s.id) === selectedSectionId)

  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      const matchType = libraryTypeFilter === "all" || r.report_type === libraryTypeFilter
      const q = librarySearch.toLowerCase()
      const matchSearch =
        !q || r.title.toLowerCase().includes(q) || localizeReportText(r.summary).toLowerCase().includes(q)
      return matchType && matchSearch
    })
  }, [reports, libraryTypeFilter, librarySearch])

  const passRate = metricNumber(selectedReport, "pass_rate")
  const atRisk = metricNumber(selectedReport, "at_risk_students") ?? metricNumber(selectedReport, "watchlist_count")
  const risk = selectedReport?.metrics_json?.risk_level ?? "Chưa rõ"
  const actions = Array.isArray(selectedReport?.metrics_json?.actions)
    ? (selectedReport!.metrics_json.actions as unknown[])
    : []
  const issues = Array.isArray(selectedReport?.metrics_json?.issues)
    ? (selectedReport!.metrics_json.issues as unknown[])
    : []

  // Reset section when semester changes and current section no longer exists
  React.useEffect(() => {
    if (selectedSectionId && !filteredSections.find((s) => String(s.id) === selectedSectionId)) {
      setSelectedSectionId(filteredSections[0] ? String(filteredSections[0].id) : "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSections])

  const refreshReports = React.useCallback(async () => {
    const list = await api.getReports({ limit: 80 })
    setReports(list)
    setSelectedReport((cur) => list.find((r) => r.id === cur?.id) ?? list[0] ?? null)
  }, [])

  React.useEffect(() => {
    async function load() {
      setError("")
      try {
        const [reportList, programList, sectionList, courseList, semesterList] = await Promise.all([
          api.getReports({ limit: 80 }),
          api.getPrograms({ limit: 500 }),
          api.getSections({ limit: 1000 }),
          api.getCourses({ limit: 500 }),
          api.getSemesters(),
        ])
        setReports(reportList)
        setSelectedReport(reportList[0] ?? null)
        setPrograms(programList)
        setSections(sectionList)
        setCourses(courseList)
        setSemesters(semesterList)
        setSelectedProgramId(programList[0] ? String(programList[0].id) : "")
        const currentSem = semesterList.find((s) => s.is_current) ?? semesterList[0]
        if (currentSem) {
          setSelectedSemesterId(String(currentSem.id))
          const semSections = sectionList.filter((s) => s.semester_id === currentSem.id)
          setSelectedSectionId(semSections[0] ? String(semSections[0].id) : "")
        } else {
          setSelectedSectionId(sectionList[0] ? String(sectionList[0].id) : "")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được Trung tâm báo cáo.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  async function handleGenerate(kind: "preview" | "final") {
    setError("")
    const scopeId =
      selectedTemplate.scopeType === "program"
        ? selectedProgramId
        : selectedTemplate.scopeType === "section"
          ? selectedSectionId
          : undefined

    if (selectedTemplate.scopeType !== "school" && !scopeId) {
      setError("Cần chọn phạm vi trước khi tạo báo cáo.")
      return
    }
    setIsGenerating(true)
    try {
      const report = await api.generateReport({
        report_type: selectedTemplate.backendType,
        actor_role: selectedTemplate.scopeType === "section" ? "lecturer" : "manager",
        scope_type: selectedTemplate.scopeType,
        scope_id: scopeId,
      })
      await refreshReports()
      setSelectedReport(report)
      setAgentAnswer(null)
      setAgentSessionId(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được báo cáo.")
    } finally {
      setIsGenerating(false)
    }
  }

  async function askAgent(question = agentQuestion, mode = agentMode) {
    if (!selectedReport) {
      setError("Cần chọn hoặc tạo một báo cáo trước khi hỏi trợ lý.")
      return
    }
    setIsAsking(true)
    setError("")
    try {
      const response = await api.askReportAgent({
        report_id: selectedReport.id,
        session_id: agentSessionId,
        mode,
        message: question,
        context: {
          metric_key: question.includes("risk") || question.includes("rủi ro") ? "risk_level" : "pass_rate",
          scope: {
            report_type: selectedReport.report_type,
            scope_type: selectedReport.scope_type,
            scope_id: selectedReport.scope_id,
          },
          template: selectedTemplate.title,
          semester: selectedSemester?.name,
        },
      })
      setAgentSessionId(response.session_id)
      setAgentAnswer(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trợ lý chưa trả lời được.")
    } finally {
      setIsAsking(false)
    }
  }

  async function confirmPending(action: ApiReportAgentPendingAction, decision: "confirm" | "cancel") {
    setError("")
    try {
      const result = await api.confirmReportAgentAction(action.id, { action: decision })
      setAgentAnswer((cur) =>
        cur
          ? {
              ...cur,
              pending_actions: cur.pending_actions.map((item) =>
                item.id === action.id ? { ...item, status: result.status } : item,
              ),
            }
          : cur,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận được action.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trung tâm báo cáo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo ảnh chụp báo cáo, rút danh sách hành động và hỏi trợ lý báo cáo dựa trên dữ liệu đã lưu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Kịch bản v2026-06-18.1</Badge>
          <Badge variant="outline">Kiểm vết công cụ</Badge>
          <Badge variant="outline">Bộ nhớ ngắn + dài hạn</Badge>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <WorkflowCard icon={FileBarChart2} title="1. Chọn mẫu" detail={selectedTemplate.title} state="active" />
        <WorkflowCard
          icon={ShieldCheck}
          title="2. Kiểm dữ liệu"
          detail={`${dataConfidence(selectedReport)}% độ tin cậy`}
          state={selectedReport ? "active" : "idle"}
        />
        <WorkflowCard
          icon={Sparkles}
          title="3. Diễn giải"
          detail={selectedReport?.metrics_json?.llm_enhanced ? "Có AI diễn giải" : "Diễn giải theo luật"}
          state={selectedReport ? "active" : "idle"}
        />
        <WorkflowCard
          icon={Download}
          title="4. Xuất báo cáo"
          detail="Trang web / PDF"
          state={selectedReport ? "active" : "idle"}
        />
      </div>

      <div className="grid gap-4">
        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg p-1">
            <TabsTrigger value="templates" className="min-w-fit">Mẫu báo cáo</TabsTrigger>
            <TabsTrigger value="generate" className="min-w-fit">Tạo báo cáo</TabsTrigger>
            <TabsTrigger value="library" className="min-w-fit">Lịch sử báo cáo</TabsTrigger>
            <TabsTrigger value="compare" className="min-w-fit">So sánh</TabsTrigger>
            <TabsTrigger value="scheduled" className="min-w-fit">Lịch hẹn</TabsTrigger>
            <TabsTrigger value="actions" className="min-w-fit">Hành động</TabsTrigger>
          </TabsList>

          {/* ── Mẫu báo cáo ── */}
          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplateId(template.id)
                    setWizardMode(false)
                  }}
                  className={`rounded-lg border p-4 text-left transition hover:bg-muted/50 ${
                    selectedTemplateId === template.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <FileBarChart2 className="mt-0.5 size-5 text-primary" />
                    <Badge variant="outline">{template.actor}</Badge>
                  </div>
                  <div className="mt-3 font-semibold">{template.title}</div>
                  <p className="mt-2 min-h-12 text-sm text-muted-foreground">{template.purpose}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{template.detail}</p>
                </button>
              ))}
            </div>
          </TabsContent>

          {/* ── Tạo báo cáo ── */}
          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wand2 className="size-5" />
                        Tạo báo cáo
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedTemplate.purpose}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{selectedTemplate.actor}</Badge>
                      <Button
                        variant={wizardMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setWizardMode(!wizardMode)
                          setWizardStep(1)
                        }}
                      >
                        <Users className="mr-1 size-4" />
                        {wizardMode ? "Biểu mẫu nhanh" : "Hướng dẫn"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {wizardMode ? (
                  <CardContent>
                    <WizardPanel
                      step={wizardStep}
                      setStep={setWizardStep}
                      actorRole={wizardActorRole}
                      setActorRole={setWizardActorRole}
                      selectedTemplateId={selectedTemplateId}
                      setSelectedTemplateId={setSelectedTemplateId}
                      selectedProgramId={selectedProgramId}
                      setSelectedProgramId={setSelectedProgramId}
                      selectedSectionId={selectedSectionId}
                      setSelectedSectionId={setSelectedSectionId}
                      selectedSemesterId={selectedSemesterId}
                      setSelectedSemesterId={setSelectedSemesterId}
                      programs={programs}
                      filteredSections={filteredSections}
                      semesters={semesters}
                      courseMap={courseMap}
                      semesterMap={semesterMap}
                      isGenerating={isGenerating}
                      onGenerate={() => handleGenerate("final")}
                    />
                  </CardContent>
                ) : (
                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {/* Loại báo cáo */}
                    <div className="space-y-2">
                      <Label>Loại báo cáo</Label>
                      <Select
                        value={selectedTemplateId}
                        onValueChange={(v) => { if (v) setSelectedTemplateId(v as TemplateId) }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>{selectedTemplate.title}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Học kỳ */}
                    <div className="space-y-2">
                      <Label>Học kỳ</Label>
                      <Select value={selectedSemesterId} onValueChange={(v) => { if (v) setSelectedSemesterId(v) }}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn học kỳ">
                            {selectedSemester
                              ? `${selectedSemester.name}${selectedSemester.is_current ? " ✦" : ""}`
                              : "Chọn học kỳ"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                              {s.is_current ? " (hiện tại)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Phạm vi ngành */}
                    {selectedTemplate.scopeType === "program" ? (
                      <div className="space-y-2">
                        <Label>Phạm vi ngành</Label>
                        <Select value={selectedProgramId} onValueChange={(v) => { if (v) setSelectedProgramId(v) }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Chọn ngành">
                              {selectedProgram
                                ? `${selectedProgram.code} - ${selectedProgram.name}`
                                : "Chọn ngành"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {programs.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.code} - {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {/* Phạm vi lớp học phần */}
                    {selectedTemplate.scopeType === "section" ? (
                      <div className="space-y-2">
                        <Label>Lớp học phần</Label>
                        <Select value={selectedSectionId} onValueChange={(v) => { if (v) setSelectedSectionId(v) }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Chọn lớp">
                              {selectedSection
                                ? buildSectionLabel(selectedSection, courseMap, semesterMap)
                                : filteredSections.length === 0
                                  ? "Không có lớp trong học kỳ"
                                  : "Chọn lớp học phần"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {filteredSections.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {buildSectionLabel(s, courseMap, semesterMap)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {/* Định dạng + Chi tiết */}
                    <div className="grid gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Định dạng
                          <Badge variant="secondary" className="text-[10px]">Sắp có</Badge>
                        </Label>
                        <Select value={formats} onValueChange={(v) => { if (v) setFormats(v) }} disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue>{formatLabels[formats] ?? formats}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="web">Trang web</SelectItem>
                            <SelectItem value="web_pdf">Trang web + PDF</SelectItem>
                            <SelectItem value="web_pdf_excel">Trang web + PDF + Excel</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Hiện xuất trang web / in PDF từ nút trong bản xem trước.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Mức chi tiết
                          <Badge variant="secondary" className="text-[10px]">Sắp có</Badge>
                        </Label>
                        <Select value={detailLevel} onValueChange={(v) => { if (v) setDetailLevel(v) }} disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue>{detailLabels[detailLevel] ?? detailLevel}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="summary">Tóm tắt</SelectItem>
                            <SelectItem value="standard">Tiêu chuẩn</SelectItem>
                            <SelectItem value="detailed">Chi tiết</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid gap-2 md:col-span-2 sm:grid-cols-2 xl:col-span-4">
                      <Button
                        variant="outline"
                        onClick={() => handleGenerate("preview")}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 size-4" />
                        )}
                        Xem trước
                      </Button>
                      <Button onClick={() => handleGenerate("final")} disabled={isGenerating}>
                        <FileText className="mr-2 size-4" />
                        Chốt bản chính thức
                      </Button>
                      <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">
                        Tự động hẹn lịch và gửi báo cáo định kỳ đang được phát triển.
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              <ReportPreview report={selectedReport} isLoading={isLoading} />
            </div>
          </TabsContent>

          {/* ── Thư viện ── */}
          <TabsContent value="library" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tiêu đề hoặc tóm tắt..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={libraryTypeFilter} onValueChange={(v) => { if (v) setLibraryTypeFilter(v) }}>
                <SelectTrigger className="w-full sm:w-52">
                  <Filter className="mr-2 size-4 shrink-0 text-muted-foreground" />
                  <SelectValue>
                    {libraryTypeFilter === "all"
                      ? "Tất cả loại"
                      : (reportTypeLabels[libraryTypeFilter] ?? libraryTypeFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="school_overview">Toàn trường</SelectItem>
                  <SelectItem value="program_health">Sức khỏe ngành</SelectItem>
                  <SelectItem value="section_intervention">Can thiệp lớp học phần</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filteredReports.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                {reports.length === 0
                  ? "Chưa có báo cáo. Tạo báo cáo đầu tiên trong tab Tạo báo cáo."
                  : "Không tìm thấy báo cáo phù hợp."}
              </div>
            ) : null}
            {filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() => {
                  setSelectedReport(report)
                  setAgentAnswer(null)
                  setAgentSessionId(undefined)
                }}
                className={`w-full rounded-lg border p-4 text-left hover:bg-muted/50 ${
                  selectedReport?.id === report.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{report.title}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {localizeReportText(report.summary)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={reportStatusVariant(report.status)}>
                      {labelFromMap(report.status, statusLabels)}
                    </Badge>
                    <Badge variant={riskVariant(report.metrics_json?.risk_level)}>
                      {String(report.metrics_json?.risk_level ?? "Chưa có rủi ro")}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{labelFromMap(report.report_type, reportTypeLabels)}</span>
                  <span>
                    {labelFromMap(report.scope_type, scopeTypeLabels)}:{report.scope_id ?? "tất cả"}
                  </span>
                  <span>{formatDate(report.created_at)}</span>
                </div>
              </button>
            ))}
          </TabsContent>

          {/* ── So sánh (Phase 3) ── */}
          <TabsContent value="compare" className="space-y-4">
            <ComparePanel
              reports={reports}
              leftReport={selectedReport}
              compareReportId={compareReportId}
              setCompareReportId={setCompareReportId}
            />
          </TabsContent>

          {/* ── Lịch hẹn (Phase 3) ── */}
          <TabsContent value="scheduled" className="space-y-4">
            <div className="rounded-lg border p-10 text-center">
              <CalendarClock className="mx-auto size-10 text-muted-foreground" />
              <h3 className="mt-4 flex items-center justify-center gap-2 text-base font-semibold">
                Lịch gửi báo cáo tự động
                <Badge variant="secondary">Sắp có</Badge>
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Khi hoàn thiện, bạn sẽ đặt được lịch định kỳ (hằng tuần / hằng tháng / cuối kỳ) và chọn người
                nhận để hệ thống tự tạo và gửi báo cáo. Hiện tại hãy tạo báo cáo thủ công trong tab Tạo báo cáo.
              </p>
            </div>
          </TabsContent>

          {/* ── Hành động ── */}
          <TabsContent value="actions" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard
                label="Tỷ lệ đạt"
                value={passRate == null ? "-" : `${passRate}%`}
                metricKey="pass_rate"
                onAsk={() =>
                  askAgent("Giải thích tỷ lệ đạt, công thức, dữ liệu nguồn và điểm cần nghi ngờ.", "explain")
                }
              />
              <MetricCard
                label="Sinh viên cần chú ý"
                value={atRisk ?? "-"}
                metricKey="at_risk_students"
                onAsk={() =>
                  askAgent("Danh sách nguy cơ này nên chuyển thành hành động gì?", "action_planning")
                }
              />
              <MetricCard
                label="Mức rủi ro"
                value={String(risk)}
                metricKey="risk_level"
                onAsk={() =>
                  askAgent("Truy vết risk_level và giải thích vì sao mức này hợp lý.", "root_cause")
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="size-5" />
                    Vấn đề & rủi ro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issues.length ? (
                    issues.map((item, index) => (
                      <div key={index} className="rounded-md border p-3 text-sm">
                        {localizeReportText(item)}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có vấn đề trong ảnh chụp báo cáo.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-5" />
                    Danh sách hành động
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {actions.length ? (
                    actions.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm"
                      >
                        <span>{localizeReportText(item)}</span>
                        <Badge variant="outline">đề xuất</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có hành động trong ảnh chụp báo cáo.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <AgentPanel
          selectedReport={selectedReport}
          mode={agentMode}
          setMode={setAgentMode}
          question={agentQuestion}
          setQuestion={setAgentQuestion}
          answer={agentAnswer}
          isAsking={isAsking}
          onAsk={() => askAgent()}
          onQuickAsk={askAgent}
          onConfirm={confirmPending}
        />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WorkflowCard({
  icon: Icon,
  title,
  detail,
  state,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  detail: string
  state: "active" | "idle"
}) {
  return (
    <div className={`rounded-lg border p-3 ${state === "active" ? "bg-card" : "bg-muted/30"}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className={`size-4 ${state === "active" ? "text-primary" : "text-muted-foreground"}`} />
        {title}
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

// ── Phase 2: Wizard ───────────────────────────────────────────────────────────

function WizardPanel({
  step,
  setStep,
  actorRole,
  setActorRole,
  selectedTemplateId,
  setSelectedTemplateId,
  selectedProgramId,
  setSelectedProgramId,
  selectedSectionId,
  setSelectedSectionId,
  selectedSemesterId,
  setSelectedSemesterId,
  programs,
  filteredSections,
  semesters,
  courseMap,
  semesterMap,
  isGenerating,
  onGenerate,
}: {
  step: 1 | 2 | 3
  setStep: (s: 1 | 2 | 3) => void
  actorRole: string
  setActorRole: (r: string) => void
  selectedTemplateId: TemplateId
  setSelectedTemplateId: (id: TemplateId) => void
  selectedProgramId: string
  setSelectedProgramId: (id: string) => void
  selectedSectionId: string
  setSelectedSectionId: (id: string) => void
  selectedSemesterId: string
  setSelectedSemesterId: (id: string) => void
  programs: ApiProgram[]
  filteredSections: ApiSection[]
  semesters: ApiSemester[]
  courseMap: Map<number, ApiCourse>
  semesterMap: Map<number, ApiSemester>
  isGenerating: boolean
  onGenerate: () => void
}) {
  const actor = actorRoles.find((a) => a.value === actorRole) ?? actorRoles[0]
  const availableTemplates = templates.filter((t) => actor.templates.includes(t.id))
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? availableTemplates[0]
  const selectedSemester = semesters.find((s) => String(s.id) === selectedSemesterId)
  const currentSection = filteredSections.find((s) => String(s.id) === selectedSectionId)
  const stepLabels = ["Tôi là...", "Chọn loại báo cáo", "Xác nhận & tạo"]

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <React.Fragment key={s}>
            <button
              onClick={() => {
                if (s < step) setStep(s)
              }}
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                    ? "cursor-pointer bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? "✓" : s}
            </button>
            {s < 3 ? (
              <div className={`h-px flex-1 transition ${step > s ? "bg-emerald-200" : "bg-muted"}`} />
            ) : null}
          </React.Fragment>
        ))}
        <span className="ml-2 text-sm font-medium">{stepLabels[step - 1]}</span>
      </div>

      {/* Step 1: Actor */}
      {step === 1 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {actorRoles.map((role) => (
            <button
              key={role.value}
              onClick={() => {
                setActorRole(role.value)
                const first = templates.find((t) => role.templates.includes(t.id))
                if (first) setSelectedTemplateId(first.id)
                setStep(2)
              }}
              className={`rounded-lg border p-4 text-left transition hover:bg-muted/50 ${
                actorRole === role.value ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="font-medium text-sm">{role.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Template */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            Vai của bạn: <span className="font-medium">{actor.label}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {availableTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplateId(t.id)
                  setStep(3)
                }}
                className={`rounded-lg border p-3 text-left transition hover:bg-muted/50 ${
                  selectedTemplateId === t.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="font-medium text-sm">{t.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t.purpose}</p>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep(1)}>
            ← Quay lại
          </Button>
        </div>
      )}

      {/* Step 3: Scope + generate */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
            <div className="font-medium text-sm">{selectedTemplate?.title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{selectedTemplate?.purpose}</p>
          </div>

          {selectedTemplate?.scopeType !== "school" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Học kỳ</Label>
                <Select value={selectedSemesterId} onValueChange={(v) => { if (v) setSelectedSemesterId(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn học kỳ">
                      {selectedSemester
                        ? `${selectedSemester.name}${selectedSemester.is_current ? " ✦" : ""}`
                        : "Chọn học kỳ"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                        {s.is_current ? " (hiện tại)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate?.scopeType === "program" && (
                <div className="space-y-2">
                  <Label>Ngành</Label>
                  <Select value={selectedProgramId} onValueChange={(v) => { if (v) setSelectedProgramId(v) }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn ngành" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.code} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTemplate?.scopeType === "section" && (
                <div className="space-y-2">
                  <Label>Lớp học phần</Label>
                  <Select value={selectedSectionId} onValueChange={(v) => { if (v) setSelectedSectionId(v) }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn lớp">
                        {currentSection
                          ? buildSectionLabel(currentSection, courseMap, semesterMap)
                          : "Chọn lớp học phần"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSections.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {buildSectionLabel(s, courseMap, semesterMap)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>
              ← Quay lại
            </Button>
            <Button onClick={onGenerate} disabled={isGenerating} className="flex-1">
              {isGenerating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Tạo báo cáo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Phase 3: Compare ──────────────────────────────────────────────────────────

function ComparePanel({
  reports,
  leftReport,
  compareReportId,
  setCompareReportId,
}: {
  reports: ApiReport[]
  leftReport: ApiReport | null
  compareReportId: string | null
  setCompareReportId: (id: string | null) => void
}) {
  const rightReport = reports.find((r) => r.id === compareReportId) ?? null

  if (reports.length < 2) {
    return (
      <div className="rounded-lg border p-10 text-center">
        <ArrowLeftRight className="mx-auto size-10 text-muted-foreground" />
        <h3 className="mt-4 text-base font-semibold">Cần ít nhất 2 báo cáo</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Tạo thêm báo cáo trong tab Tạo báo cáo để so sánh.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-xs text-muted-foreground">Báo cáo A (đang chọn)</span>
          <div className="mt-0.5 truncate font-medium">{leftReport?.title ?? "Chưa chọn"}</div>
        </div>
        <ArrowLeftRight className="mx-2 size-5 shrink-0 text-muted-foreground" />
        <Select value={compareReportId ?? ""} onValueChange={(v) => setCompareReportId(v ?? null)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Chọn báo cáo B">
              {rightReport?.title ?? "Chọn báo cáo B để so sánh"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {reports
              .filter((r) => r.id !== leftReport?.id)
              .map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title} · {formatDate(r.created_at)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {leftReport && rightReport ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <CompareCard report={leftReport} label="A" />
            <CompareCard report={rightReport} label="B" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">So sánh chỉ số chính</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-medium text-muted-foreground">Chỉ số</th>
                      <th className="py-2 text-center font-medium">A</th>
                      <th className="py-2 text-center font-medium">B</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">B − A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["pass_rate", "at_risk_students", "watchlist_count", "evidence_count"].flatMap((key) => {
                      const a = leftReport.metrics_json?.[key]
                      const b = rightReport.metrics_json?.[key]
                      if (a == null && b == null) return []
                      const diff =
                        typeof a === "number" && typeof b === "number" ? b - a : null
                      return [
                        <tr key={key} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground">{key}</td>
                          <td className="py-2 text-center font-medium">{a != null ? String(a) : "—"}</td>
                          <td className="py-2 text-center font-medium">{b != null ? String(b) : "—"}</td>
                          <td
                            className={`py-2 text-center text-xs ${
                              diff == null
                                ? "text-muted-foreground"
                                : diff > 0
                                  ? "text-emerald-600"
                                  : diff < 0
                                    ? "text-red-500"
                                    : "text-muted-foreground"
                            }`}
                          >
                            {diff != null ? (diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)) : "—"}
                          </td>
                        </tr>,
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Chọn báo cáo B ở trên để xem so sánh song song.
        </div>
      )}
    </div>
  )
}

function CompareCard({ report, label }: { report: ApiReport; label: string }) {
  const metrics = report.metrics_json ?? {}
  const passRate = asPercent(metrics.pass_rate)
  const risk = String(metrics.risk_level ?? "Chưa rõ")
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge>{label}</Badge>
          <CardTitle className="truncate text-sm">{report.title}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(report.created_at)}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div
            className={`rounded-md border p-2 ${passRate < 70 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
          >
            <div className="text-xs text-muted-foreground">Tỷ lệ đạt</div>
            <div className="text-lg font-semibold">
              {metrics.pass_rate != null ? `${metrics.pass_rate}%` : "—"}
            </div>
          </div>
          <div
            className={`rounded-md border p-2 ${riskVariant(risk) === "destructive" ? "border-red-200 bg-red-50" : "border-slate-100"}`}
          >
            <div className="text-xs text-muted-foreground">Rủi ro</div>
            <div className="text-lg font-semibold">{risk}</div>
          </div>
        </div>
        <p className="line-clamp-3 text-xs text-muted-foreground">{localizeReportText(report.summary)}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {labelFromMap(report.report_type, reportTypeLabels)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {labelFromMap(report.scope_type, scopeTypeLabels)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Report Preview (Phase 2: per-type format) ─────────────────────────────────

function ReportPreview({ report, isLoading }: { report: ApiReport | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Đang tải báo cáo...</CardContent>
      </Card>
    )
  }
  if (!report) {
    return (
      <Card>
        <CardContent className="grid min-h-[520px] place-items-center p-8 text-center">
          <div className="max-w-sm">
            <Eye className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Chưa có bản xem trước</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Chọn mẫu và phạm vi, sau đó bấm Xem trước để tạo bản báo cáo tương tác.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const metrics = report.metrics_json ?? {}
  const issues = stringList(metrics.issues)
  const risks = stringList(metrics.risks)
  const actions = stringList(metrics.actions)
  const goodSignals = stringList(metrics.good_signals)
  const confidence = dataConfidence(report)
  const passRate = asPercent(metrics.pass_rate)
  const risk = String(metrics.risk_level ?? "Chưa rõ")
  const atRisk = metrics.at_risk_students ?? metrics.watchlist_count ?? "—"

  // Per-type data — progressive enhancement when backend returns these keys
  const cloAttainment =
    report.report_type === "section_intervention" &&
    metrics.clo_attainment != null &&
    typeof metrics.clo_attainment === "object" &&
    !Array.isArray(metrics.clo_attainment)
      ? (metrics.clo_attainment as Record<string, number>)
      : null

  const ploAttainment =
    report.report_type === "program_health" &&
    metrics.plo_attainment != null &&
    typeof metrics.plo_attainment === "object" &&
    !Array.isArray(metrics.plo_attainment)
      ? (metrics.plo_attainment as Record<string, number>)
      : null

  const watchlistStudents =
    report.report_type === "section_intervention"
      ? normalizeWatchlist(metrics.watchlist ?? metrics.watchlist_students)
      : []

  const coursesAtRisk =
    report.report_type === "program_health" ? stringList(metrics.courses_at_risk) : []

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="border-b bg-gradient-to-r from-slate-50 via-white to-emerald-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{labelFromMap(report.report_type, reportTypeLabels)}</Badge>
                <Badge variant={riskVariant(risk)}>Rủi ro {risk}</Badge>
                <Badge variant={metrics.llm_enhanced ? "default" : "outline"}>
                  {metrics.llm_enhanced ? "Có AI diễn giải" : "Diễn giải theo luật"}
                </Badge>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">{report.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {localizeReportText(report.summary)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadReportHtml(report)}>
                <Download className="mr-2 size-4" />
                Tải trang web
              </Button>
              <Button variant="outline" onClick={() => printReport(report)}>
                <Printer className="mr-2 size-4" />
                In PDF
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="space-y-6 p-6">
          {/* Main metric cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReportMetricCard
              title="Tỷ lệ đạt"
              value={`${metrics.pass_rate ?? "—"}%`}
              caption="đạt / đã hoàn thành"
              tone={passRate < 70 ? "danger" : "good"}
            />
            <ReportMetricCard
              title="Cần chú ý"
              value={String(atRisk)}
              caption="danh sách chú ý / nguy cơ"
              tone={Number(atRisk) > 0 ? "warn" : "good"}
            />
            <ReportMetricCard
              title="Độ tin cậy dữ liệu"
              value={`${confidence}%`}
              caption="cỡ mẫu + độ đầy đủ"
              tone={confidence < 65 ? "warn" : "good"}
            />
            <ReportMetricCard
              title="Phạm vi"
              value={labelFromMap(report.scope_type, scopeTypeLabels)}
              caption={report.scope_id ?? "tất cả"}
              tone="neutral"
            />
          </div>

          {/* Per-type: CLO attainment for section_intervention */}
          {cloAttainment && Object.keys(cloAttainment).length > 0 ? (
            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Mức đạt CLO học phần</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium text-muted-foreground">CLO</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">Mức đạt</th>
                      <th className="py-2 text-left font-medium text-muted-foreground">Tiến trình</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(cloAttainment).map(([clo, val]) => (
                      <tr key={clo} className="border-b last:border-0">
                        <td className="py-2 font-medium">{clo}</td>
                        <td
                          className={`py-2 text-center font-semibold ${val < 70 ? "text-red-500" : "text-emerald-600"}`}
                        >
                          {val}%
                        </td>
                        <td className="py-2">
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full ${val < 70 ? "bg-red-400" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, val)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Per-type: Watchlist for section_intervention */}
          {watchlistStudents.length > 0 ? (
            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">
                Danh sách sinh viên cần chú ý ({watchlistStudents.length})
              </h3>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {watchlistStudents.map((student, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {student.fullName ?? student.studentCode ?? "Sinh viên"}
                      </div>
                      {student.studentCode && student.fullName ? (
                        <div className="text-xs text-muted-foreground">{student.studentCode}</div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      {student.grade != null ? (
                        <div className="font-semibold tabular-nums">{student.grade}</div>
                      ) : null}
                      {student.reason ? (
                        <div className="text-xs text-amber-700">{student.reason}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Per-type: PLO attainment for program_health */}
          {ploAttainment && Object.keys(ploAttainment).length > 0 ? (
            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Mức đạt PLO ngành</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(ploAttainment).map(([plo, val]) => (
                  <div key={plo} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{plo}</span>
                      <span className={val < 70 ? "text-red-500" : "text-emerald-600"}>{val}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${val < 70 ? "bg-red-400" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(100, val)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Per-type: Courses at risk for program_health */}
          {coursesAtRisk.length > 0 ? (
            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Học phần cần chú ý ({coursesAtRisk.length})</h3>
              <div className="mt-3 space-y-1.5">
                {coursesAtRisk.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm"
                  >
                    {c}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Data confidence */}
          <section className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Độ tin cậy dữ liệu</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Điểm này giúp người đọc biết báo cáo có đủ dữ liệu để kết luận chưa.
                </p>
              </div>
              <Badge variant={confidence < 65 ? "secondary" : "default"}>{confidence}%</Badge>
            </div>
            <Progress value={confidence} className="mt-4 h-2" />
            <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              {dataConfidenceBasis(report)}
            </div>
          </section>

          {/* Generic lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportListSection
              icon={CheckCircle2}
              title="Tín hiệu tốt"
              empty="Chưa có tín hiệu tốt trong ảnh chụp."
              items={goodSignals}
            />
            <ReportListSection
              icon={AlertTriangle}
              title="Điểm chưa tốt"
              empty="Chưa có vấn đề trong ảnh chụp."
              items={issues}
            />
            <ReportListSection
              icon={Gauge}
              title="Rủi ro cần chú ý"
              empty="Chưa có rủi ro trong ảnh chụp."
              items={risks}
            />
            <ReportListSection
              icon={ClipboardCheck}
              title="Hành động đề xuất"
              empty="Chưa có hành động trong ảnh chụp."
              items={actions}
            />
          </div>

          <details className="rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Phụ lục: ảnh chụp chỉ số
            </summary>
            <div className="border-t p-4">
              <div className="grid gap-2 md:grid-cols-2">
                {Object.entries(metrics)
                  .filter(([, value]) => !Array.isArray(value) && typeof value !== "object")
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium">{localizeReportText(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

function ReportMetricCard({
  title,
  value,
  caption,
  tone,
}: {
  title: string
  value: string
  caption: string
  tone: "good" | "warn" | "danger" | "neutral"
}) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-950"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : tone === "good"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-slate-200 bg-slate-50 text-slate-950"
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-xs opacity-70">{title}</div>
      <div className="mt-1 break-words text-xl font-semibold leading-tight">{value}</div>
      <div className="mt-2 text-xs opacity-70">{caption}</div>
    </div>
  )
}

function ReportListSection({
  icon: Icon,
  title,
  items,
  empty,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  items: string[]
  empty: string
}) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h3>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div key={index} className="rounded-md bg-muted/40 p-3 text-sm leading-6">
              {localizeReportText(item)}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  metricKey,
  onAsk,
}: {
  label: string
  value: React.ReactNode
  metricKey: string
  onAsk: () => void
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
            <div className="mt-2 text-xs text-muted-foreground">Mã chỉ số: {metricKey}</div>
          </div>
          <Button size="sm" variant="outline" onClick={onAsk}>
            <Bot className="mr-1 size-3" />
            Hỏi
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AgentPanel({
  selectedReport,
  mode,
  setMode,
  question,
  setQuestion,
  answer,
  isAsking,
  onAsk,
  onQuickAsk,
  onConfirm,
}: {
  selectedReport: ApiReport | null
  mode: ApiReportAgentMode
  setMode: (mode: ApiReportAgentMode) => void
  question: string
  setQuestion: (value: string) => void
  answer: ApiReportAgentAskResponse | null
  isAsking: boolean
  onAsk: () => void
  onQuickAsk: (question: string, mode: ApiReportAgentMode) => void
  onConfirm: (action: ApiReportAgentPendingAction, decision: "confirm" | "cancel") => void
}) {
  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-primary" />
            Trợ lý báo cáo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Trợ lý chỉ dùng ảnh chụp báo cáo, kết quả công cụ và bộ nhớ đã lưu.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedReport ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Ngữ cảnh báo cáo</span>
                <Badge variant={selectedReport.metrics_json?.llm_enhanced ? "default" : "outline"} className="text-[10px]">
                  {selectedReport.metrics_json?.llm_enhanced ? "AI đang bật" : "Trả lời theo luật"}
                </Badge>
              </div>
              <div className="mt-1 text-muted-foreground">{selectedReport.title}</div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              Chọn một báo cáo (ở tab Tạo báo cáo hoặc Lịch sử báo cáo) để bắt đầu hỏi trợ lý.
            </div>
          )}

          <div className="space-y-2">
            <Label>Chế độ trợ lý</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ApiReportAgentMode)}>
              <SelectTrigger className="w-full">
                <SelectValue>{modeLabels[mode]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Câu hỏi</Label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} />
          </div>

          <Button className="w-full" onClick={onAsk} disabled={!selectedReport || isAsking}>
            {isAsking ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Bot className="mr-2 size-4" />
            )}
            Hỏi trợ lý báo cáo
          </Button>

          <div className="grid gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onQuickAsk(
                  "Chỉ số tỷ lệ đạt lấy từ đâu, công thức nào, cỡ mẫu có đủ không?",
                  "explain",
                )
              }
            >
              Giải thích tỷ lệ đạt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onQuickAsk(
                  "Vì sao báo cáo này có rủi ro, dấu hiệu nào là thật và giả thuyết nào cần kiểm chứng?",
                  "root_cause",
                )
              }
            >
              Phân tích rủi ro
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onQuickAsk(
                  "Tạo task xử lý action quan trọng nhất từ báo cáo này",
                  "action_planning",
                )
              }
            >
              Đề xuất task
            </Button>
          </div>
        </CardContent>
      </Card>

      {answer ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-5" />
              Câu trả lời
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-6">
              {answer.response}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">phiên {answer.session_id.slice(0, 8)}</Badge>
              <Badge variant="outline">kịch bản {answer.prompt_version}</Badge>
              <Badge variant="outline">{answer.latency_ms}ms</Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="size-4" />
                Vết gọi công cụ
              </div>
              {answer.tool_calls.map((call, index) => (
                <details key={`${call.tool_name}-${index}`} className="rounded-md border p-3 text-xs">
                  <summary className="cursor-pointer font-medium">
                    {call.tool_name} · {labelFromMap(call.status, statusLabels)} · {call.latency_ms}ms
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-muted-foreground">
                    {JSON.stringify(call.tool_output, null, 2)}
                  </pre>
                </details>
              ))}
            </div>

            {answer.pending_actions.length ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Library className="size-4" />
                  Hành động chờ xác nhận
                </div>
                {answer.pending_actions.map((action) => (
                  <div key={action.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{action.action_type}</span>
                      <Badge variant={action.status === "pending" ? "secondary" : "outline"}>
                        {labelFromMap(action.status, statusLabels)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Trợ lý đề xuất ghi dữ liệu, cần xác nhận trước khi thực thi.
                    </p>
                    {action.status === "pending" ? (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => onConfirm(action, "confirm")}>
                          <CheckCircle2 className="mr-1 size-3" />
                          Xác nhận
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onConfirm(action, "cancel")}>
                          Hủy
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </aside>
  )
}
