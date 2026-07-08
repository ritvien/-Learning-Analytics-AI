"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  FileSpreadsheet,
  Filter,
  Info,
  Library,
  ListTodo,
  Loader2,
  Plus,
  Printer,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react"

import {
  api,
  getCachedCurrentUser,
  setReportBuildContext,
  type ApiCourse,
  type ApiDepartment,
  type ApiUser,
  type ApiProgram,
  type ApiReport,
  type ApiReportAgentAskResponse,
  type ApiReportAgentMode,
  type ApiReportAgentPendingAction,
  type ApiReportSchedule,
  type ApiReportType,
  type ApiSection,
  type ApiSemester,
} from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportPreviewSkeleton } from "@/components/loading/page-skeletons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  ReportBarChart,
  ReportDonutChart,
  ReportRadarChart,
  ReportSectionBarChart,
  ReportTrendLine,
} from "@/components/reports/report-charts"

type TemplateId = "department_report" | "program_report" | "course_report" | "section_report" | "school_report"
type ReportWorkspace = "actions" | "library"
type ReportUserRole = ApiUser["role"] | "unknown"

interface ReportTemplate {
  id: TemplateId
  title: string
  emoji: string
  description: string
  actor: string
  backendType: ApiReportType
  scopeType: "school" | "department" | "program" | "course" | "section"
}

interface RoleReportPreset {
  id: string
  templateId: TemplateId
  label: string
  description: string
  departmentId?: string
  programId?: string
  courseId?: string
  sectionId?: string
  semesterId?: string
}

const templates: ReportTemplate[] = [
  {
    id: "department_report",
    title: "Khoa",
    emoji: "🏢",
    description: "Tổng quan khoa, ngành yếu, môn bottleneck và hành động ưu tiên",
    actor: "Trưởng khoa, quản lý đào tạo",
    backendType: "department_health",
    scopeType: "department",
  },
  {
    id: "section_report",
    title: "Lớp học phần",
    emoji: "🏫",
    description: "Theo dõi tình hình lớp, sinh viên rủi ro và CLO",
    actor: "Giảng viên, cố vấn học tập",
    backendType: "section_intervention",
    scopeType: "section",
  },
  {
    id: "program_report",
    title: "Ngành / Khoa",
    emoji: "📚",
    description: "Sức khỏe ngành, PLO, học phần bottleneck",
    actor: "Trưởng ngành, trưởng khoa, quản lý đào tạo",
    backendType: "program_health",
    scopeType: "program",
  },
  {
    id: "course_report",
    title: "Môn học",
    emoji: "📘",
    description: "Sức khỏe môn, lớp bất thường, CLO yếu và hướng cải thiện",
    actor: "Trưởng bộ môn, giảng viên phụ trách",
    backendType: "course_health",
    scopeType: "course",
  },
  {
    id: "school_report",
    title: "Toàn trường",
    emoji: "🏛️",
    description: "Tổng quan học vụ, khoa/ngành rủi ro, chỉ số cấp trường",
    actor: "Ban giám hiệu, quản lý",
    backendType: "school_overview",
    scopeType: "school",
  },
]

function reportPresetsForRole(role: ReportUserRole): RoleReportPreset[] {
  if (role === "superadmin" || role === "admin") {
    return [
      { id: "school-current", templateId: "school_report", label: "Toàn trường · kỳ hiện tại", description: "Tổng quan điều hành và các vùng rủi ro chính" },
      { id: "department-current", templateId: "department_report", label: "Theo khoa · kỳ hiện tại", description: "Sức khỏe một khoa và các ngành cần chú ý" },
      { id: "program-current", templateId: "program_report", label: "Theo ngành · kỳ hiện tại", description: "PLO, môn học và điểm nghẽn của ngành" },
    ]
  }
  if (role === "manager") {
    return [
      { id: "my-department", templateId: "department_report", label: "Khoa phụ trách", description: "Tự chọn khoa được phân quyền và kỳ hiện tại" },
      { id: "my-program", templateId: "program_report", label: "Ngành thuộc khoa", description: "Chọn sẵn một ngành trong phạm vi quản lý" },
      { id: "my-section", templateId: "section_report", label: "Lớp cần can thiệp", description: "Chọn nhanh lớp học phần trong kỳ hiện tại" },
    ]
  }
  if (role === "lecturer") {
    return [
      { id: "teaching-section", templateId: "section_report", label: "Lớp đang giảng dạy", description: "Tình hình lớp và sinh viên cần hỗ trợ" },
      { id: "teaching-course", templateId: "course_report", label: "Môn đang phụ trách", description: "Kết quả và CLO của môn học" },
    ]
  }
  return []
}

function allowedTemplatesForRole(role: ReportUserRole) {
  if (role === "superadmin" || role === "admin") return templates
  if (role === "manager") {
    return templates.filter((item) => item.scopeType !== "school")
  }
  if (role === "lecturer") {
    return templates.filter((item) => item.scopeType === "course" || item.scopeType === "section")
  }
  return []
}

function reportActorLabel(role: ReportUserRole) {
  if (role === "superadmin") return "Superadmin"
  if (role === "admin") return "Admin"
  if (role === "manager") return "Trưởng khoa / quản lý khoa"
  if (role === "lecturer") return "Giảng viên"
  return "Người dùng"
}

const scheduledReportPlans = [
  {
    name: "Báo cáo rủi ro lớp hằng tuần",
    templateId: "section_report" as TemplateId,
    actor: "Giảng viên, cố vấn học tập",
    scope: "Lớp học phần",
    frequency: "Thứ 2 hằng tuần",
    trigger: "Tự động sau khi có điểm mới hoặc trước 07:00 thứ 2",
    nextRun: "Thứ 2 kế tiếp",
    output: "Trang web + PDF",
    status: "Đang phát triển",
  },
  {
    name: "Báo cáo khoa hằng tháng",
    templateId: "program_report" as TemplateId,
    actor: "Trưởng khoa, quản lý đào tạo",
    scope: "Khoa / các ngành trong khoa",
    frequency: "Ngày 1 hằng tháng",
    trigger: "Tổng hợp dữ liệu tháng trước",
    nextRun: "Ngày 1 tháng tới",
    output: "Trang web + PDF + phụ lục",
    status: "Đang phát triển",
  },
  {
    name: "Báo cáo giữa kỳ",
    templateId: "section_report" as TemplateId,
    actor: "Giảng viên, trưởng bộ môn",
    scope: "Môn / lớp học phần",
    frequency: "Tuần giữa kỳ",
    trigger: "Sau khi điểm giữa kỳ được cập nhật",
    nextRun: "Theo lịch học kỳ",
    output: "Trang web",
    status: "Đang phát triển",
  },
  {
    name: "Báo cáo PLO cuối kỳ",
    templateId: "program_report" as TemplateId,
    actor: "Trưởng ngành, đảm bảo chất lượng",
    scope: "Ngành / chương trình đào tạo",
    frequency: "Cuối học kỳ",
    trigger: "Sau khi khóa nhập điểm học kỳ",
    nextRun: "Cuối kỳ hiện tại",
    output: "Trang web + PDF + Excel",
    status: "Đang phát triển",
  },
]

function allowedScheduledPlansForTemplates(allowed: ReportTemplate[]) {
  const allowedIds = new Set(allowed.map((template) => template.id))
  return scheduledReportPlans.filter((plan) => allowedIds.has(plan.templateId))
}

const actorReportViews = [
  { actor: "Ban giám hiệu", scope: "Toàn trường", reports: "Điều hành toàn trường, rủi ro lớn, PLO dưới mục tiêu", detail: "Tóm tắt" },
  { actor: "Trưởng khoa", scope: "Khoa", reports: "Hiệu quả khoa, ngành yếu, môn rủi ro, hành động khoa", detail: "Tiêu chuẩn" },
  { actor: "Trưởng ngành", scope: "Ngành", reports: "PLO, CLO kéo tụt, học phần đóng góp, minh chứng", detail: "Chi tiết" },
  { actor: "Giảng viên", scope: "Môn / lớp", reports: "CLO học phần, lớp rủi ro, sinh viên cần hỗ trợ", detail: "Chi tiết trong phạm vi lớp" },
  { actor: "Cố vấn học tập", scope: "Sinh viên phụ trách", reports: "Hồ sơ đầu ra, danh sách nguy cơ, hành động liên hệ", detail: "Giới hạn theo quyền" },
  { actor: "Đảm bảo chất lượng", scope: "Kiểm định", reports: "Minh chứng PLO/CLO, chất lượng dữ liệu, khoảng cách chuẩn đầu ra", detail: "Chi tiết" },
]

export const modeLabels: Record<ApiReportAgentMode, string> = {
  explain: "Giải thích chỉ số",
  root_cause: "Phân tích nguyên nhân",
  narrative: "Viết phần diễn giải",
  action_planning: "Đề xuất hành động",
  workflow: "Tạo luồng công việc",
  compare: "So sánh",
}

const reportTypeLabels: Record<string, string> = {
  school_overview: "Toàn trường",
  department_health: "Sức khỏe khoa",
  program_health: "Sức khỏe ngành",
  course_health: "Sức khỏe môn học",
  section_intervention: "Can thiệp lớp học phần",
}

const scopeTypeLabels: Record<string, string> = {
  school: "Toàn trường",
  department: "Khoa",
  program: "Ngành",
  course: "Môn học",
  section: "Lớp học phần",
}

const statusLabels: Record<string, string> = {
  generated: "Bản được hệ thống lập",
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

function reportScopeDisplay(report: ApiReport) {
  const metrics = report.metrics_json ?? {}
  const scopeType = String(report.scope_type ?? "")
  if (scopeType === "school") return "Toàn trường"
  if (scopeType === "department" && metrics.department_name) return `Khoa - ${localizeReportText(metrics.department_name)}`
  if (scopeType === "program" && metrics.program_name) return `Ngành - ${localizeReportText(metrics.program_name)}`
  if (scopeType === "course" && metrics.course_name) return `Môn học - ${localizeReportText(metrics.course_name)}`
  if (scopeType === "section") {
    const sectionCode = localizeReportText(metrics.section_code ?? report.scope_id)
    const courseName = metrics.course_name ? ` · ${localizeReportText(metrics.course_name)}` : ""
    return `Lớp học phần - ${sectionCode}${courseName}`
  }
  const typeLabel = labelFromMap(report.scope_type, scopeTypeLabels)
  return report.scope_id ? `${typeLabel} - ${report.scope_id}` : typeLabel
}

function reportUrl(reportId: string) {
  return `/manager/reports?report=${encodeURIComponent(reportId)}`
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
    .replace(/\baction plan\b/gi, "kế hoạch hành động")
    .replace(/\baction\b/gi, "hành động")
    .replace(/\bbottleneck\b/gi, "điểm nghẽn")
    .replace(/\binsight\b/gi, "nhận định")
    .replace(/\bmapping\b/gi, "ánh xạ")
    .replace(/\bissue\b/gi, "vấn đề")
    .replace(/\brisk\b/gi, "rủi ro")
    .replace(/\bcompleted\b/gi, "đã hoàn thành")
}

export function renderAgentInline(text: string) {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\((\/manager\/reports\?report=[^)]+)\)|(\/manager\/reports\?report=[a-zA-Z0-9_-]+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      nodes.push(<strong key={`${match.index}-bold`}>{match[2]}</strong>)
    } else {
      const label = match[3] ?? match[5]
      const href = match[4] ?? match[5]
      nodes.push(
        <a key={`${match.index}-link`} href={href} className="font-medium text-primary underline underline-offset-2">
          {label}
        </a>,
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function renderAgentResponse(text: string) {
  return text.split("\n").map((line, index) =>
    line.trim() ? (
      <p key={`${index}-${line.slice(0, 12)}`} className="min-h-5">
        {renderAgentInline(line)}
      </p>
    ) : (
      <div key={`blank-${index}`} className="h-2" />
    ),
  )
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "-"
}

function formatDateOnly(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "-"
}

function formalReportDate(value?: string) {
  const date = value ? new Date(value) : new Date()
  return `Hà Nội, ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`
}

function reportReference(report: ApiReport) {
  const year = new Date(report.created_at).getFullYear()
  return `${report.id.slice(0, 8).toUpperCase()}/${year}/BC-ĐHĐL`
}

function reportRecipient(report: ApiReport) {
  return report.actor_role === "lecturer" ? "Giảng viên, cố vấn học tập phụ trách" : "Lãnh đạo đơn vị và cán bộ quản lý đào tạo"
}

function startOfDayIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function endOfDayIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

function reportPeriodLabel(report: ApiReport) {
  const start = report.period_start ?? (typeof report.metrics_json?.period_start === "string" ? report.metrics_json.period_start : null)
  const end = report.period_end ?? (typeof report.metrics_json?.period_end === "string" ? report.metrics_json.period_end : null)
  if (start && end) return `${formatDateOnly(start)} - ${formatDateOnly(end)}`
  if (start) return `Từ ${formatDateOnly(start)}`
  if (end) return `Đến ${formatDateOnly(end)}`
  if (typeof report.metrics_json?.period_label === "string") return report.metrics_json.period_label
  return "Toàn bộ dữ liệu hiện có"
}

function riskVariant(value: unknown): "destructive" | "secondary" | "outline" {
  if (value === "Cao") return "destructive"
  if (value === "Trung bình") return "secondary"
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

function printReport(report: ApiReport) {
  const printWindow = window.open("", "_blank", "width=1100,height=900")
  if (!printWindow) return
  printWindow.document.write(buildReportHtml(report))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function downloadReportWord(report: ApiReport) {
  const blob = new Blob(["\ufeff", buildReportHtml(report)], { type: "application/msword" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "bao-cao"}.doc`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function reportHtmlText(value: unknown) {
  return escapeHtml(localizeReportText(value))
}

function reportHtmlList(items: string[], empty = "Chưa có nội dung ghi nhận.") {
  const list = items.length ? items : [empty]
  return list.map((item) => `<li>${reportHtmlText(item)}</li>`).join("")
}

function normalizeDeepDiveHref(href: unknown) {
  if (typeof href !== "string" || !href.trim()) return null
  const raw = href.trim()
  if (!raw.startsWith("/manager/analytics")) return null
  try {
    const url = new URL(raw, "http://localhost")
    if (!url.pathname.startsWith("/manager/analytics")) return null
    const courseId = url.searchParams.get("course_id") ?? url.searchParams.get("course")
    const programId = url.searchParams.get("program_id") ?? url.searchParams.get("program")
    const sectionId = url.searchParams.get("section_id") ?? url.searchParams.get("section")
    if (courseId && /^\d+$/.test(courseId)) {
      url.searchParams.set("course_id", courseId)
      url.searchParams.set("course", courseId)
    }
    if (programId && /^\d+$/.test(programId)) {
      url.searchParams.set("program_id", programId)
      url.searchParams.set("program", programId)
    }
    if (sectionId && /^\d+$/.test(sectionId)) {
      url.searchParams.set("section_id", sectionId)
      url.searchParams.set("section", sectionId)
    }
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

function reportHtmlLink(href: unknown, label = "Mở") {
  const safeHref = normalizeDeepDiveHref(href)
  if (!safeHref) return "-"
  return `<a href="${escapeHtml(safeHref)}">${escapeHtml(label)}</a>`
}

function reportHtmlRootCauseRows(metrics: Record<string, unknown>) {
  const rows = Array.isArray(metrics.root_causes) ? (metrics.root_causes as Record<string, unknown>[]) : []
  if (!rows.length) return `<tr><td colspan="5">Chưa có phân tích nguyên nhân khả dĩ.</td></tr>`
  return rows
    .map(
      (item, index) =>
        `<tr><td>${index + 1}</td><td>${reportHtmlText(item.evidence)}</td><td>${reportHtmlText(item.hypothesis)}</td><td>${reportHtmlText(item.next_check)}</td><td>${reportHtmlLink(item.href)}</td></tr>`,
    )
    .join("")
}

function reportHtmlDeepInsightRows(metrics: Record<string, unknown>) {
  const rows = Array.isArray(metrics.deep_insights) ? (metrics.deep_insights as Record<string, unknown>[]) : []
  if (!rows.length) return `<tr><td colspan="5">Chưa có insight phân tích sâu.</td></tr>`
  return rows
    .map(
      (item, index) =>
        `<tr><td>${index + 1}</td><td><strong>${reportHtmlText(item.title ?? "Insight")}</strong><br/>${reportHtmlText(item.finding)}</td><td>${reportHtmlText(item.evidence)}</td><td>${reportHtmlText(item.action)}</td><td>${reportHtmlLink(item.href)}</td></tr>`,
    )
    .join("")
}

function reportHtmlActionPlanRows(metrics: Record<string, unknown>, fallbackActions: string[], actorRole: string) {
  const rows = Array.isArray(metrics.action_plan) ? (metrics.action_plan as Record<string, unknown>[]) : []
  if (rows.length) {
    return rows
      .map(
        (item, index) =>
          `<tr><td>${index + 1}</td><td>${reportHtmlText(item.task)}</td><td>${reportHtmlText(item.owner)}</td><td>${reportHtmlText(item.reason)}</td><td>${reportHtmlText(item.deadline)}</td><td>${reportHtmlText(item.priority)}</td><td>${reportHtmlLink(item.href)}</td></tr>`,
      )
      .join("")
  }
  const owner = actorRole === "lecturer" ? "Giảng viên" : "Quản lý / trưởng đơn vị"
  return fallbackActions.length
    ? fallbackActions
        .map(
          (action, index) =>
            `<tr><td>${index + 1}</td><td>${reportHtmlText(action)}</td><td>${reportHtmlText(owner)}</td><td>Theo khuyến nghị từ dữ liệu báo cáo.</td><td>${index === 0 ? "7 ngày" : "30 ngày"}</td><td>${index === 0 ? "Cao" : "Trung bình"}</td><td>-</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="7">Chưa có action plan.</td></tr>`
}

function reportHtmlMetricRows(metrics: Record<string, unknown>) {
  const labels: Record<string, string> = {
    pass_rate: "Tỷ lệ đạt",
    avg_gpa: "GPA trung bình",
    avg_grade: "Điểm trung bình",
    completed_enrollments: "Lượt học phần hoàn tất",
    passed_enrollments: "Lượt đạt",
    failed_enrollments: "Lượt chưa đạt",
    at_risk_students: "Sinh viên nguy cơ",
    watchlist_count: "Sinh viên cần chú ý",
    active_students: "Sinh viên đang học",
    program_count: "Số chương trình/ngành",
    evidence_count: "Số minh chứng",
    risk_level: "Mức rủi ro",
  }

  const preferredKeys = Object.keys(labels).filter((key) => metrics[key] != null)
  const extraKeys = Object.keys(metrics)
    .filter((key) => !preferredKeys.includes(key))
    .filter((key) => {
      const value = metrics[key]
      return !Array.isArray(value) && (value == null || typeof value !== "object")
    })
    .slice(0, 10)

  return [...preferredKeys, ...extraKeys]
    .map((key) => {
      const label = labels[key] ?? key
      const value = metrics[key]
      const display = key.includes("rate") && typeof value === "number" ? `${value}%` : localizeReportText(value)
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(display)}</td></tr>`
    })
    .join("")
}

function buildReportHtml(report: ApiReport) {
  const metrics = report.metrics_json ?? {}
  const issues = stringList(metrics.issues)
  const risks = stringList(metrics.risks)
  const actions = stringList(metrics.actions)
  const goodSignals = stringList(metrics.good_signals)
  const passRate = typeof metrics.pass_rate === "number" ? `${metrics.pass_rate}%` : "Chưa có"
  const atRisk = metrics.at_risk_students ?? metrics.watchlist_count ?? "Chưa có"
  const confidence = dataConfidence(report)
  const rows = reportHtmlMetricRows(metrics)
  const sample = confidenceSample(report)
  const riskLevel = localizeReportText(metrics.risk_level ?? "Chưa rõ")
  const focusStatement = issues[0] ?? risks[0] ?? goodSignals[0] ?? "Chưa có nhận định trọng tâm."
  const nextAction = actions[0] ?? "Rà soát dữ liệu chi tiết và xác nhận với đơn vị phụ trách."

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page { size: A4; margin: 25mm 20mm 20mm 30mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #eef2f7;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
    }
    main {
      width: 210mm;
      min-height: 297mm;
      margin: 24px auto;
      background: #fff;
      padding: 25mm 20mm 20mm 30mm;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15);
    }
    .hero {
      margin: -8mm -6mm 10mm;
      padding: 12mm;
      border-radius: 18px;
      background: linear-gradient(135deg, #0f172a, #1e3a8a 58%, #065f46);
      color: #fff;
    }
    .eyebrow { font-size: 9pt; text-transform: uppercase; letter-spacing: 2px; color: #bfdbfe; font-weight: 700; }
    h1 {
      margin: 10px 0 8px;
      font-size: 22pt;
      line-height: 1.35;
    }
    .hero-summary { max-width: 660px; color: #dbeafe; font-size: 11pt; }
    .hero-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
    .kpi { border: 1px solid rgba(255,255,255,.22); border-radius: 14px; padding: 10px; background: rgba(255,255,255,.10); }
    .kpi-label { font-size: 8.5pt; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; }
    .kpi-value { margin-top: 4px; font-size: 17pt; font-weight: 800; }
    .meta-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 12px; }
    .meta-card { border: 1px solid #dbe3ef; border-radius: 12px; background: #f8fafc; padding: 9px 10px; }
    .meta-label { font-size: 8.5pt; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .meta-value { margin-top: 3px; font-weight: 700; }
    .brief { display: grid; grid-template-columns: 1.3fr .9fr; gap: 12px; margin: 12px 0 16px; }
    .panel { border: 1px solid #dbe3ef; border-radius: 14px; padding: 12px; background: #fff; }
    .panel.accent { background: #eff6ff; border-color: #bfdbfe; }
    h2 { margin: 18px 0 8px; font-size: 13pt; text-transform: uppercase; letter-spacing: .3px; }
    h3 { margin: 12px 0 6px; font-size: 12pt; }
    p { margin: 6px 0; text-align: justify; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; margin: 8px 0 14px; font-size: 10pt; border: 1px solid #dbe3ef; border-radius: 12px; }
    th, td { border-bottom: 1px solid #dbe3ef; padding: 7px 8px; vertical-align: top; }
    th { background: #0f172a; color: #fff; text-align: left; font-weight: 700; }
    tr:last-child td { border-bottom: 0; }
    thead { display: table-header-group; }
    tr, .summary { break-inside: avoid; page-break-inside: avoid; }
    h2, h3 { break-after: avoid; page-break-after: avoid; }
    ul { margin: 6px 0 12px 22px; padding: 0; }
    li { margin: 4px 0; text-align: justify; }
    .summary { border: 1px solid #dbe3ef; border-left: 5px solid #2563eb; border-radius: 12px; padding: 10px 12px; margin: 10px 0 14px; background: #f8fafc; }
    .signature {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 32px;
      text-align: center;
    }
    .muted { color: #374151; }
    @media print {
      body { background: #fff; }
      main { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
      .hero { margin: 0 0 10mm; }
    }
  </style>
</head>
<body><main>
  <div class="hero">
    <div class="eyebrow">EduInsight Report · ${escapeHtml(labelFromMap(report.report_type, reportTypeLabels))}</div>
    <h1>${escapeHtml(report.title)}</h1>
    <p class="hero-summary">${reportHtmlText(report.summary)}</p>
    <div class="hero-grid">
      <div class="kpi"><div class="kpi-label">Tỷ lệ đạt</div><div class="kpi-value">${escapeHtml(passRate)}</div></div>
      <div class="kpi"><div class="kpi-label">Mức rủi ro</div><div class="kpi-value">${escapeHtml(riskLevel)}</div></div>
      <div class="kpi"><div class="kpi-label">Độ tin cậy</div><div class="kpi-value">${confidence}%</div></div>
    </div>
  </div>

  <div class="meta-strip">
    <div class="meta-card"><div class="meta-label">Phạm vi</div><div class="meta-value">${escapeHtml(reportScopeDisplay(report))}</div></div>
    <div class="meta-card"><div class="meta-label">Kỳ dữ liệu</div><div class="meta-value">${escapeHtml(reportPeriodLabel(report))}</div></div>
    <div class="meta-card"><div class="meta-label">Mã báo cáo</div><div class="meta-value">${escapeHtml(reportReference(report))}</div></div>
    <div class="meta-card"><div class="meta-label">Ngày sinh</div><div class="meta-value">${escapeHtml(formalReportDate(report.created_at))}</div></div>
  </div>

  <div class="brief">
    <div class="panel">
      <h2 style="margin-top:0">Điểm cần đọc trước</h2>
      <p>${reportHtmlText(focusStatement)}</p>
      <p><strong>Bước tiếp theo:</strong> ${reportHtmlText(nextAction)}</p>
    </div>
    <div class="panel accent">
      <h2 style="margin-top:0">Độ chắc dữ liệu</h2>
      <p><strong>${confidence}%</strong> · ${sample.toLocaleString("vi-VN")} mẫu/minh chứng.</p>
      <p>${reportHtmlText(dataConfidenceBasis(report))}</p>
    </div>
  </div>

  <h2>I. Thông tin báo cáo</h2>
  <table>
    <tr><td><strong>Loại báo cáo</strong></td><td>${escapeHtml(labelFromMap(report.report_type, reportTypeLabels))}</td></tr>
    <tr><td><strong>Phạm vi</strong></td><td>${escapeHtml(reportScopeDisplay(report))}</td></tr>
    <tr><td><strong>Kỳ dữ liệu phân tích</strong></td><td>${escapeHtml(reportPeriodLabel(report))}</td></tr>
    <tr><td><strong>Đối tượng tiếp nhận</strong></td><td>${escapeHtml(reportRecipient(report))}</td></tr>
    <tr><td><strong>Mã tra cứu</strong></td><td>${escapeHtml(report.id)}</td></tr>
    <tr><td><strong>Trạng thái</strong></td><td>${escapeHtml(labelFromMap(report.status, statusLabels))}</td></tr>
    <tr><td><strong>Độ tin cậy dữ liệu</strong></td><td>${confidence}% - ${reportHtmlText(dataConfidenceBasis(report))}</td></tr>
  </table>

  <h2>II. Tóm tắt điều hành</h2>
  <div class="summary">${reportHtmlText(report.summary)}</div>
  <table>
    <tr><th>Chỉ số</th><th>Giá trị</th></tr>
    <tr><td>Tỷ lệ đạt</td><td>${escapeHtml(passRate)}</td></tr>
    <tr><td>Mức rủi ro</td><td>${reportHtmlText(metrics.risk_level ?? "Chưa có")}</td></tr>
    <tr><td>Đối tượng cần chú ý</td><td>${reportHtmlText(atRisk)}</td></tr>
  </table>

  <h2>III. Phạm vi và chất lượng dữ liệu</h2>
  <p>Báo cáo được tổng hợp từ dữ liệu đã lưu trong hệ thống tại thời điểm sinh báo cáo. Các nhận định cần được đọc cùng độ tin cậy dữ liệu và mức đầy đủ của minh chứng.</p>
  <table><tr><th>Chỉ số</th><th>Giá trị</th></tr>${rows || "<tr><td colspan=\"2\">Chưa có phụ lục chỉ số.</td></tr>"}</table>

  <h2>IV. Kết quả chính</h2>
  <h3>1. Điểm tốt</h3>
  <ul>${reportHtmlList(goodSignals, "Chưa có tín hiệu tốt nổi bật.")}</ul>
  <h3>2. Điểm chưa tốt</h3>
  <ul>${reportHtmlList(issues, "Chưa có vấn đề nổi bật.")}</ul>

  <h2>V. Phân tích sâu từ dữ liệu</h2>
  <table>
    <tr><th>#</th><th>Nhận định</th><th>Bằng chứng</th><th>Hành động</th><th>Mở sâu</th></tr>
    ${reportHtmlDeepInsightRows(metrics)}
  </table>

  <h2>VI. Rủi ro và nguyên nhân cần theo dõi</h2>
  <ul>${reportHtmlList(risks, "Chưa có rủi ro rõ ràng trong snapshot.")}</ul>
  <h3>Nguyên nhân khả dĩ cần kiểm chứng</h3>
  <table>
    <tr><th>#</th><th>Dấu hiệu từ dữ liệu</th><th>Giả thuyết</th><th>Cần kiểm chứng</th><th>Mở sâu</th></tr>
    ${reportHtmlRootCauseRows(metrics)}
  </table>

  <h2>VII. Khuyến nghị và kế hoạch hành động</h2>
  <table>
    <tr><th>#</th><th>Hành động</th><th>Phụ trách</th><th>Lý do</th><th>Hạn</th><th>Ưu tiên</th><th>Mở sâu</th></tr>
    ${reportHtmlActionPlanRows(metrics, actions, report.actor_role)}
  </table>

  <h2>VIII. Kết luận</h2>
  <p>Báo cáo này là căn cứ ban đầu để đơn vị phụ trách xem xét, xác minh dữ liệu chi tiết và triển khai biện pháp cải tiến. Các quyết định chính thức cần được đối chiếu với hồ sơ học vụ, điểm thành phần và quy định hiện hành của Nhà trường.</p>

  <div class="signature">
    <div><strong>NGƯỜI LẬP BÁO CÁO</strong><br/><span class="muted">(Ký, ghi rõ họ tên)</span></div>
    <div><strong>NGƯỜI KIỂM TRA</strong><br/><span class="muted">(Ký, ghi rõ họ tên)</span></div>
    <div><strong>THỦ TRƯỞNG ĐƠN VỊ</strong><br/><span class="muted">(Ký, đóng dấu nếu có)</span></div>
  </div>
  <div style="margin-top: 54px; border-top: 1px solid #9ca3af; padding-top: 8px; font-size: 10.5pt;">
    <strong>Nơi nhận:</strong> Như trên; lưu đơn vị lập báo cáo.<br/>
    <span class="muted">Mã tra cứu: ${escapeHtml(report.id)} · Phiên bản 1.0 · Tài liệu sử dụng nội bộ.</span>
  </div>
</main></body></html>`
}

export default function ReportsPage() {
  const searchParams = useSearchParams()
  const [reports, setReports] = React.useState<ApiReport[]>([])
  const [reportSchedules, setReportSchedules] = React.useState<ApiReportSchedule[]>([])
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [programs, setPrograms] = React.useState<ApiProgram[]>([])
  const [sections, setSections] = React.useState<ApiSection[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [semesters, setSemesters] = React.useState<ApiSemester[]>([])
  const [currentUser, setCurrentUser] = React.useState<ApiUser | null>(() => {
    if (typeof window === "undefined") return null
    return getCachedCurrentUser()
  })
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<TemplateId>("program_report")
  const [workspace, setWorkspace] = React.useState<ReportWorkspace>("actions")
  const [selectedReport, setSelectedReport] = React.useState<ApiReport | null>(null)
  const [selectedDepartmentId, setSelectedDepartmentId] = React.useState("")
  const [selectedProgramId, setSelectedProgramId] = React.useState("")
  const [selectedCourseId, setSelectedCourseId] = React.useState("")
  const [selectedSectionId, setSelectedSectionId] = React.useState("")
  const [selectedSemesterId, setSelectedSemesterId] = React.useState("")
  const [periodStartDate, setPeriodStartDate] = React.useState("")
  const [periodEndDate, setPeriodEndDate] = React.useState("")
  const [includeAiNarrative, setIncludeAiNarrative] = React.useState(false)
  const [courseSearch, setCourseSearch] = React.useState("")
  const [sectionSearch, setSectionSearch] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState("")
  // Dialog state
  const [generateOpen, setGenerateOpen] = React.useState(false)
  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  // Library filters
  const [librarySearch, setLibrarySearch] = React.useState("")
  const [libraryTypeFilter, setLibraryTypeFilter] = React.useState("all")
  const [libraryDateFrom, setLibraryDateFrom] = React.useState("")
  const [libraryDateTo, setLibraryDateTo] = React.useState("")
  // Semester range filter (theo thứ tự năm*10+kỳ); "" = không giới hạn đầu/cuối
  const [fromSemId, setFromSemId] = React.useState("")
  const [toSemId, setToSemId] = React.useState("")

  const hasLibraryFilters = Boolean(
    librarySearch || libraryTypeFilter !== "all" || fromSemId || toSemId || libraryDateFrom || libraryDateTo,
  )

  const resetLibraryFilters = () => {
    setLibrarySearch("")
    setLibraryTypeFilter("all")
    setLibraryDateFrom("")
    setLibraryDateTo("")
    setFromSemId("")
    setToSemId("")
  }

  const courseMap = React.useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const semesterMap = React.useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters])
  const currentRole: ReportUserRole = currentUser?.role ?? "unknown"
  const lockedDepartmentId =
    currentUser?.role === "manager" && currentUser.department_id != null ? String(currentUser.department_id) : ""
  const managerMissingScope = currentUser?.role === "manager" && currentUser.department_id == null
  const effectiveDepartmentId = lockedDepartmentId || selectedDepartmentId
  const scopedDepartments = React.useMemo(() => {
    if (!lockedDepartmentId) return departments
    return departments.filter((department) => String(department.id) === lockedDepartmentId)
  }, [departments, lockedDepartmentId])
  const availableTemplates = React.useMemo(() => allowedTemplatesForRole(currentRole), [currentRole])
  const availableScheduledPlans = React.useMemo(
    () => allowedScheduledPlansForTemplates(availableTemplates),
    [availableTemplates],
  )
  const canGenerateReports = availableTemplates.length > 0 && !managerMissingScope

  const selectedTemplate = availableTemplates.find((t) => t.id === selectedTemplateId) ?? availableTemplates[0] ?? templates[0]
  const selectedDepartment = departments.find((d) => String(d.id) === effectiveDepartmentId)
  const selectedProgram = programs.find((p) => String(p.id) === selectedProgramId)
  const selectedSemester = semesters.find((s) => String(s.id) === selectedSemesterId)

  React.useEffect(() => {
    if (!availableTemplates.length) return
    if (!availableTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(availableTemplates[0].id)
    }
  }, [availableTemplates, selectedTemplateId])

  React.useEffect(() => {
    if (!lockedDepartmentId || selectedDepartmentId === lockedDepartmentId) return
    setSelectedDepartmentId(lockedDepartmentId)
    setSelectedProgramId("")
    setSelectedCourseId("")
    setSelectedSectionId("")
  }, [lockedDepartmentId, selectedDepartmentId])

  React.useEffect(() => {
    const scopeId = selectedTemplate.scopeType === "department"
      ? effectiveDepartmentId
      : selectedTemplate.scopeType === "program"
        ? selectedProgramId
        : selectedTemplate.scopeType === "course"
          ? selectedCourseId
          : selectedTemplate.scopeType === "section"
            ? selectedSectionId
            : undefined
    setReportBuildContext({
      source: "report_page",
      route: "/manager/reports",
      scope: {
        scope_type: selectedTemplate.scopeType,
        scope_id: scopeId || undefined,
        semester_id: selectedSemesterId || undefined,
        period: { from: periodStartDate || undefined, to: periodEndDate || undefined },
      },
      filters: {
        report_type: selectedTemplate.backendType,
        department_id: effectiveDepartmentId || undefined,
        program_id: selectedProgramId || undefined,
        course_id: selectedCourseId || undefined,
        section_id: selectedSectionId || undefined,
      },
    })
  }, [selectedTemplate, effectiveDepartmentId, selectedProgramId, selectedCourseId, selectedSectionId, selectedSemesterId, periodStartDate, periodEndDate])

  const programOptions = React.useMemo(() => {
    if (!effectiveDepartmentId) return programs
    return programs.filter((p) => String(p.department_id) === effectiveDepartmentId)
  }, [programs, effectiveDepartmentId])

  const courseOptions = React.useMemo(() => {
    return courses.filter((course) => {
      if (selectedProgramId && !course.program_ids.includes(Number(selectedProgramId))) return false
      if (!selectedProgramId && effectiveDepartmentId && String(course.department_id) !== effectiveDepartmentId) return false
      return true
    })
  }, [courses, effectiveDepartmentId, selectedProgramId])

  const filteredCourseOptions = React.useMemo(() => {
    const q = courseSearch.trim().toLowerCase()
    const list = q
      ? courseOptions.filter((course) => `${course.code} ${course.name}`.toLowerCase().includes(q))
      : courseOptions
    return list.slice(0, 80)
  }, [courseOptions, courseSearch])

  const filteredSections = React.useMemo(() => {
    const q = sectionSearch.trim().toLowerCase()
    return sections
      .filter((section) => !selectedSemesterId || String(section.semester_id) === selectedSemesterId)
      .filter((section) => {
        if (selectedCourseId) return String(section.course_id) === selectedCourseId
        if (selectedProgramId) return courseMap.get(section.course_id)?.program_ids.includes(Number(selectedProgramId))
        if (effectiveDepartmentId) return String(courseMap.get(section.course_id)?.department_id) === effectiveDepartmentId
        return true
      })
      .filter((section) => {
        if (!q) return true
        return buildSectionLabel(section, courseMap, semesterMap).toLowerCase().includes(q)
      })
      .slice(0, 120)
  }, [sections, selectedSemesterId, selectedCourseId, selectedProgramId, effectiveDepartmentId, sectionSearch, courseMap, semesterMap])

  const selectedSection = filteredSections.find((s) => String(s.id) === selectedSectionId)

  // Học kỳ xếp theo thứ tự thời gian (mới nhất trước) để chọn khoảng "từ kỳ → đến kỳ".
  const orderedSemesters = React.useMemo(
    () => [...semesters].sort((a, b) => b.year * 10 + b.term - (a.year * 10 + a.term)),
    [semesters],
  )
  const semesterOrderById = React.useMemo(
    () => new Map(semesters.map((s) => [String(s.id), s.year * 10 + s.term])),
    [semesters],
  )
  const fromOrder = fromSemId ? semesterOrderById.get(fromSemId) ?? null : null
  const toOrder = toSemId ? semesterOrderById.get(toSemId) ?? null : null

  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      const matchType = libraryTypeFilter === "all" || r.report_type === libraryTypeFilter
      const q = librarySearch.toLowerCase()
      const matchSearch =
        !q || r.title.toLowerCase().includes(q) || localizeReportText(r.summary).toLowerCase().includes(q)
      // Khoảng học kỳ: dùng semester_order gắn trên báo cáo. Báo cáo không gắn kỳ vẫn hiển thị.
      const order = typeof r.metrics_json?.semester_order === "number"
        ? (r.metrics_json.semester_order as number)
        : null
      const matchFrom = fromOrder == null || order == null || order >= fromOrder
      const matchTo = toOrder == null || order == null || order <= toOrder
      const createdAt = new Date(r.created_at).getTime()
      const createdFrom = libraryDateFrom ? new Date(`${libraryDateFrom}T00:00:00`).getTime() : null
      const createdTo = libraryDateTo ? new Date(`${libraryDateTo}T23:59:59.999`).getTime() : null
      const matchCreatedFrom = createdFrom == null || createdAt >= createdFrom
      const matchCreatedTo = createdTo == null || createdAt <= createdTo
      return matchType && matchSearch && matchFrom && matchTo && matchCreatedFrom && matchCreatedTo
    })
  }, [reports, libraryTypeFilter, librarySearch, fromOrder, toOrder, libraryDateFrom, libraryDateTo])

  const actionableReports = React.useMemo(() => {
    return filteredReports.filter((report) => {
      const risk = String(report.metrics_json?.risk_level ?? "").toLowerCase()
      const atRisk = Number(report.metrics_json?.at_risk_students ?? report.metrics_json?.watchlist_count ?? 0)
      return atRisk > 0 || ["cao", "high", "critical", "nguy co", "rủi ro"].some((value) => risk.includes(value))
    })
  }, [filteredReports])

  const workspaceReports = workspace === "actions" ? actionableReports : filteredReports
  const workspaceTitle = workspace === "actions" ? "Cần xử lý" : "Thư viện báo cáo"
  const workspaceDescription = workspace === "actions"
    ? "Các snapshot có cảnh báo hoặc sinh viên cần theo dõi. Mở một báo cáo để xem bằng chứng và đi sâu vào dashboard."
    : "Tất cả snapshot báo cáo trong phạm vi bạn được phép xem."
  const roleReportPresets = React.useMemo(() => {
    const base = reportPresetsForRole(currentRole)
    const semesterRank = new Map(semesters.map((item) => [item.id, item.year * 10 + item.term]))
    const recentSections = [...sections].sort(
      (left, right) => (semesterRank.get(right.semester_id) ?? 0) - (semesterRank.get(left.semester_id) ?? 0),
    )
    if (currentRole === "lecturer") {
      const sectionPresets = recentSections.slice(0, 8).map((section) => ({
        id: `section-${section.id}`,
        templateId: "section_report" as TemplateId,
        label: `Lớp ${section.section_code}`,
        description: buildSectionLabel(section, courseMap, semesterMap),
        courseId: String(section.course_id),
        sectionId: String(section.id),
        semesterId: String(section.semester_id),
      }))
      const seenCourses = new Set<number>()
      const coursePresets = recentSections.flatMap((section) => {
        if (seenCourses.has(section.course_id)) return []
        seenCourses.add(section.course_id)
        const course = courseMap.get(section.course_id)
        return [{
          id: `course-${section.course_id}`,
          templateId: "course_report" as TemplateId,
          label: course ? `${course.code} · ${course.name}` : `Môn học #${section.course_id}`,
          description: `Môn được phân công · ${semesterMap.get(section.semester_id)?.name ?? "Kỳ gần nhất"}`,
          courseId: String(section.course_id),
          semesterId: String(section.semester_id),
        }]
      }).slice(0, 6)
      return [...sectionPresets, ...coursePresets]
    }
    if (currentRole === "manager") {
      const department = scopedDepartments[0]
      const departmentId = department ? String(department.id) : lockedDepartmentId
      const programPresets = programs
        .filter((item) => !departmentId || String(item.department_id) === departmentId)
        .slice(0, 6)
        .map((program) => ({
          id: `program-${program.id}`,
          templateId: "program_report" as TemplateId,
          label: program.name,
          description: `Báo cáo ngành ${program.code}`,
          departmentId,
          programId: String(program.id),
        }))
      const sectionPresets = recentSections.slice(0, 6).map((section) => ({
        id: `section-${section.id}`,
        templateId: "section_report" as TemplateId,
        label: `Lớp ${section.section_code}`,
        description: buildSectionLabel(section, courseMap, semesterMap),
        departmentId,
        courseId: String(section.course_id),
        sectionId: String(section.id),
        semesterId: String(section.semester_id),
      }))
      return [
        ...(base[0] ? [{ ...base[0], label: department?.name ?? "Khoa phụ trách", departmentId }] : []),
        ...programPresets,
        ...sectionPresets,
      ] as RoleReportPreset[]
    }
    if (currentRole === "superadmin" || currentRole === "admin") {
      const departmentPresets = departments.slice(0, 5).map((department) => ({
        id: `department-${department.id}`,
        templateId: "department_report" as TemplateId,
        label: department.name,
        description: `Báo cáo khoa ${department.code}`,
        departmentId: String(department.id),
      }))
      const programPresets = programs.slice(0, 5).map((program) => ({
        id: `program-${program.id}`,
        templateId: "program_report" as TemplateId,
        label: program.name,
        description: `Báo cáo ngành ${program.code}`,
        departmentId: String(program.department_id),
        programId: String(program.id),
      }))
      return [...(base[0] ? [base[0]] : []), ...departmentPresets, ...programPresets] as RoleReportPreset[]
    }
    return base
  }, [currentRole, semesters, sections, courseMap, semesterMap, scopedDepartments, lockedDepartmentId, programs, departments])

  function applyRoleReportPreset(preset: RoleReportPreset) {
    setSelectedTemplateId(preset.templateId)
    setPeriodStartDate("")
    setPeriodEndDate("")
    setCourseSearch("")
    setSectionSearch("")

    const lecturerSemester = currentRole === "lecturer"
      ? orderedSemesters.find((item) => sections.some((section) => section.semester_id === item.id))
      : null
    const semester = lecturerSemester ?? semesters.find((item) => item.is_current) ?? orderedSemesters[0]
    const semesterId = preset.semesterId ?? (semester ? String(semester.id) : "")
    if (semesterId) setSelectedSemesterId(semesterId)

    const departmentId = preset.departmentId || lockedDepartmentId
      || (currentUser?.department_id != null ? String(currentUser.department_id) : "")
      || (scopedDepartments[0] ? String(scopedDepartments[0].id) : "")
    if (departmentId) setSelectedDepartmentId(departmentId)

    const nextProgram = programs.find((item) => !departmentId || String(item.department_id) === departmentId)
    const programId = preset.programId ?? (nextProgram ? String(nextProgram.id) : "")
    setSelectedProgramId(programId)

    const nextCourse = courses.find((item) => {
      if (programId) return item.program_ids.includes(Number(programId))
      return !departmentId || String(item.department_id) === departmentId
    })
    const courseId = preset.courseId ?? (nextCourse ? String(nextCourse.id) : "")
    setSelectedCourseId(courseId)

    const nextSection = sections.find((item) => {
      if (preset.sectionId) return String(item.id) === preset.sectionId
      if (semesterId && String(item.semester_id) !== semesterId) return false
      const course = courseMap.get(item.course_id)
      return !departmentId || String(course?.department_id) === departmentId
    })
    if (preset.templateId === "section_report" && nextSection) {
      setSelectedCourseId(String(nextSection.course_id))
    }
    setSelectedSectionId(preset.sectionId ?? (nextSection ? String(nextSection.id) : ""))
  }

  function startReport(templateId: TemplateId) {
    if (!availableTemplates.some((template) => template.id === templateId)) {
      setSelectedTemplateId(availableTemplates[0]?.id ?? "section_report")
      setGenerateOpen(true)
      return
    }
    setSelectedTemplateId(templateId)
    setGenerateOpen(true)
  }

  function selectWorkspace(nextWorkspace: ReportWorkspace) {
    setWorkspace(nextWorkspace)
    const nextReports = nextWorkspace === "actions" ? actionableReports : filteredReports
    if (nextReports.length && !nextReports.some((report) => report.id === selectedReport?.id)) {
      setSelectedReport(nextReports[0])
    }
  }

  const savedScheduleByName = React.useMemo(
    () => new Map(reportSchedules.map((item) => [item.name, item])),
    [reportSchedules],
  )

  // Reset section when semester changes and current section no longer exists
  React.useEffect(() => {
    if (selectedSectionId && !filteredSections.find((s) => String(s.id) === selectedSectionId)) {
      setSelectedSectionId(filteredSections[0] ? String(filteredSections[0].id) : "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSections])

  React.useEffect(() => {
    if (selectedProgramId && !programOptions.some((p) => String(p.id) === selectedProgramId)) {
      setSelectedProgramId(programOptions[0] ? String(programOptions[0].id) : "")
    }
  }, [programOptions, selectedProgramId])

  React.useEffect(() => {
    if (selectedCourseId && !courseOptions.some((c) => String(c.id) === selectedCourseId)) {
      setSelectedCourseId(courseOptions[0] ? String(courseOptions[0].id) : "")
    }
  }, [courseOptions, selectedCourseId])

  const refreshReports = React.useCallback(async () => {
    const list = await api.getReports({ limit: 80 })
    setReports(list)
    setSelectedReport((cur) => list.find((r) => r.id === cur?.id) ?? list[0] ?? null)
  }, [])

  React.useEffect(() => {
    async function load() {
      setError("")
      try {
        const [me, reportList, scheduleList, departmentList, programList, sectionList, courseList, semesterList] = await Promise.all([
          api.me().catch(() => null),
          api.getReports({ limit: 80 }),
          api.getReportSchedules({ limit: 80 }),
          api.getDepartments({ limit: 500 }),
          api.getPrograms({ limit: 500 }),
          api.getSections({ limit: 5000 }),
          api.getCourses({ limit: 500 }),
          api.getSemesters(),
        ])
        setCurrentUser(me)
        setReports(reportList)
        setReportSchedules(scheduleList)
        setSelectedReport(reportList[0] ?? null)
        setDepartments(departmentList)
        setPrograms(programList)
        setSections(sectionList)
        setCourses(courseList)
        setSemesters(semesterList)
        setSelectedDepartmentId(departmentList[0] ? String(departmentList[0].id) : "")
        setSelectedProgramId(programList[0] ? String(programList[0].id) : "")
        setSelectedCourseId(courseList[0] ? String(courseList[0].id) : "")
        const savedCode = typeof window !== "undefined" ? sessionStorage.getItem("vinuni_selected_semester") : null
        const savedSem = savedCode ? semesterList.find((s) => s.code === savedCode) : null
        const latestAssignedSem = me?.role === "lecturer"
          ? [...semesterList]
              .sort((a, b) => b.year * 10 + b.term - (a.year * 10 + a.term))
              .find((semester) => sectionList.some((section) => section.semester_id === semester.id))
          : null
        const currentSem = latestAssignedSem ?? savedSem ?? semesterList.find((s) => s.is_current) ?? semesterList[0]
        if (currentSem) {
          setSelectedSemesterId(String(currentSem.id))
          if (typeof window !== "undefined" && !savedCode) {
            sessionStorage.setItem("vinuni_selected_semester", currentSem.code)
          }
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

  React.useEffect(() => {
    const reportId = searchParams.get("report")
    if (!reportId || reports.length === 0) return
    const linkedReport = reports.find((item) => item.id === reportId)
    if (linkedReport) {
      setSelectedReport(linkedReport)
    }
  }, [reports, searchParams])

  async function handleGenerate() {
    setError("")
    if (!canGenerateReports) {
      setError(managerMissingScope ? "Tài khoản manager chưa được gán khoa phụ trách." : "Tài khoản hiện tại không có quyền tạo báo cáo.")
      return
    }
    const scopeId =
      selectedTemplate.scopeType === "department"
        ? effectiveDepartmentId
        : selectedTemplate.scopeType === "program"
          ? selectedProgramId
          : selectedTemplate.scopeType === "course"
            ? selectedCourseId
            : selectedTemplate.scopeType === "section"
              ? selectedSectionId
              : undefined

    if (selectedTemplate.scopeType !== "school" && !scopeId) {
      setError("Cần chọn phạm vi trước khi tạo báo cáo.")
      return
    }
    if (periodStartDate && periodEndDate && new Date(periodStartDate) > new Date(periodEndDate)) {
      setError("Khoảng thời gian chưa hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.")
      return
    }
    setIsGenerating(true)
    try {
      const report = await api.generateReport({
        report_type: selectedTemplate.backendType,
        actor_role: currentRole === "unknown" ? "manager" : currentRole,
        scope_type: selectedTemplate.scopeType,
        scope_id: scopeId,
        semester_id: selectedSemesterId ? Number(selectedSemesterId) : undefined,
        period_start: startOfDayIso(periodStartDate),
        period_end: endOfDayIso(periodEndDate),
        include_ai_narrative: includeAiNarrative,
      })
      await refreshReports()
      setSelectedReport(report)
      setGenerateOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được báo cáo.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Báo cáo học vụ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mở báo cáo đã có, tạo báo cáo theo phạm vi được phân quyền, rồi xuất PDF khi cần.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" data-tour="page-reports-actions">
          <Button onClick={() => setGenerateOpen(true)} disabled={!canGenerateReports}>
            <Plus className="mr-2 size-4" />
            Tạo báo cáo
          </Button>
          <Button variant="outline" onClick={() => setScheduleOpen(true)}>
            <CalendarClock className="mr-2 size-4" />
            Lịch tự động
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Button
          variant={workspace === "actions" ? "default" : "ghost"}
          size="sm"
          onClick={() => selectWorkspace("actions")}
        >
          <ListTodo className="mr-2 size-4" />
          Cần xử lý
          {actionableReports.length ? <Badge variant="secondary" className="ml-2 text-[10px]">{actionableReports.length}</Badge> : null}
        </Button>
        <Button
          variant={workspace === "library" ? "default" : "ghost"}
          size="sm"
          onClick={() => selectWorkspace("library")}
        >
          <Library className="mr-2 size-4" />
          Thư viện
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setScheduleOpen(true)}>
          <CalendarClock className="mr-2 size-4" />
          Lịch tự động
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {availableTemplates.some((item) => item.id === "section_report") ? (
          <Button variant="outline" className="justify-start" onClick={() => startReport("section_report")}>
            <AlertTriangle className="mr-2 size-4 text-orange-600" /> Báo cáo can thiệp lớp
          </Button>
        ) : null}
        {availableTemplates.some((item) => item.id === "program_report") ? (
          <Button variant="outline" className="justify-start" onClick={() => startReport("program_report")}>
            <ClipboardCheck className="mr-2 size-4 text-primary" /> Báo cáo sức khỏe ngành
          </Button>
        ) : null}
        {availableTemplates.some((item) => item.id === "school_report") ? (
          <Button variant="outline" className="justify-start" onClick={() => startReport("school_report")}>
            <Library className="mr-2 size-4 text-emerald-600" /> Tóm tắt toàn trường
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {managerMissingScope ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tài khoản manager hiện chưa được gán khoa phụ trách. Hãy cập nhật <strong>department_id</strong> cho user để báo cáo và dashboard khóa đúng phạm vi.
        </div>
      ) : null}

      <div className="space-y-3" data-tour="page-reports-filters">
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
                  <SelectItem value="department_health">Sức khỏe khoa</SelectItem>
                  <SelectItem value="program_health">Sức khỏe ngành</SelectItem>
                  <SelectItem value="course_health">Sức khỏe môn học</SelectItem>
                  <SelectItem value="section_intervention">Can thiệp lớp học phần</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <details className="rounded-md border bg-background px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">Bộ lọc nâng cao</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Select value={fromSemId || "all"} onValueChange={(v) => setFromSemId(v && v !== "all" ? v : "")}>
                  <SelectTrigger><SelectValue placeholder="Từ kỳ đầu" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Từ kỳ đầu</SelectItem>
                    {orderedSemesters.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={toSemId || "all"} onValueChange={(v) => setToSemId(v && v !== "all" ? v : "")}>
                  <SelectTrigger><SelectValue placeholder="Đến kỳ mới nhất" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Đến kỳ mới nhất</SelectItem>
                    {orderedSemesters.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" value={libraryDateFrom} onChange={(event) => setLibraryDateFrom(event.target.value)} aria-label="Lọc báo cáo từ ngày" />
                <Input type="date" value={libraryDateTo} onChange={(event) => setLibraryDateTo(event.target.value)} aria-label="Lọc báo cáo đến ngày" />
                {hasLibraryFilters ? <Button variant="outline" onClick={resetLibraryFilters}>Đặt lại bộ lọc</Button> : null}
              </div>
            </details>
            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{workspaceTitle}</span>
                  <span className="text-muted-foreground">{workspaceReports.length} bản</span>
                </div>
                <p className="text-xs text-muted-foreground">{workspaceDescription}</p>
                {workspaceReports.length === 0 ? (
                  <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                    {workspace === "actions"
                      ? "Chưa có báo cáo nào cần xử lý trong phạm vi đang lọc."
                      : reports.length === 0
                      ? "Chưa có báo cáo tự động trong phạm vi của bạn."
                      : "Không tìm thấy báo cáo phù hợp."}
                  </div>
                ) : (
                  <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1" data-tour="page-reports-results">
                    {workspaceReports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => {
                          setSelectedReport(report)
                        }}
                        className={`w-full rounded-lg border p-3 text-left hover:bg-muted/50 ${
                          selectedReport?.id === report.id ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-sm font-semibold">{report.title}</div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {localizeReportText(report.summary)}
                            </p>
                          </div>
                          <Badge variant={riskVariant(report.metrics_json?.risk_level)} className="shrink-0 text-[10px]">
                            {String(report.metrics_json?.risk_level ?? "Ổn")}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{labelFromMap(report.report_type, reportTypeLabels)}</span>
                          <span>{reportScopeDisplay(report)}</span>
                          <span>{formatDate(report.created_at)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ReportPreview report={selectedReport as ApiReport} isLoading={isLoading} />
            </div>
          </div>

      {/* ── Dialog: Tạo báo cáo ── */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-5" /> Tạo báo cáo
            </DialogTitle>
            <DialogDescription>
              Chọn cấp báo cáo, mục đích và phạm vi. Hệ thống sẽ tính số liệu rồi sinh báo cáo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {roleReportPresets.length ? (
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div>
                  <Label className="text-sm font-semibold">Lựa chọn nhanh cho {reportActorLabel(currentRole)}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Danh sách được tạo từ đúng khoa, ngành, môn và lớp mà tài khoản này được phép xem.
                  </p>
                </div>
                <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {roleReportPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyRoleReportPreset(preset)}
                      className={`rounded-md border bg-background p-2.5 text-left transition hover:border-primary hover:bg-primary/5 ${
                        selectedTemplateId === preset.templateId ? "border-primary ring-1 ring-primary/20" : ""
                      }`}
                    >
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Bước A: cấp báo cáo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Báo cáo cho cấp nào?</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {availableTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={`rounded-lg border p-3 text-left transition hover:bg-muted/50 ${
                      selectedTemplateId === t.id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="text-2xl">{t.emoji}</div>
                    <div className="mt-1 font-semibold text-sm">{t.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn phạm vi dữ liệu */}
            {selectedTemplate.scopeType !== "school" && (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Đang tạo báo cáo với quyền <strong className="text-foreground">{reportActorLabel(currentRole)}</strong>.
                  Danh sách khoa/ngành/môn/lớp bên dưới đã được lọc theo phạm vi tài khoản.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Học kỳ</Label>
                  <Select value={selectedSemesterId} onValueChange={(v) => {
                    if (v) {
                      setSelectedSemesterId(v)
                      const matchedSem = semesters.find((s) => String(s.id) === v)
                      if (matchedSem && typeof window !== "undefined") {
                        sessionStorage.setItem("vinuni_selected_semester", matchedSem.code)
                      }
                    }
                  }}>
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
                          {s.name}{s.is_current ? " (hiện tại)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {["department", "program", "course", "section"].includes(selectedTemplate.scopeType) && (
                  <div className="space-y-2">
                    <Label>Khoa</Label>
                    <Select
                      value={effectiveDepartmentId}
                      disabled={Boolean(lockedDepartmentId)}
                      onValueChange={(v) => {
                        if (!v || lockedDepartmentId) return
                        setSelectedDepartmentId(v)
                        setSelectedProgramId("")
                        setSelectedCourseId("")
                        setSelectedSectionId("")
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn khoa">
                          {selectedDepartment ? `${selectedDepartment.code} - ${selectedDepartment.name}` : "Chọn khoa"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {scopedDepartments.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.code} - {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {["program", "course", "section"].includes(selectedTemplate.scopeType) && (
                  <div className="space-y-2">
                    <Label>Ngành</Label>
                    <Select value={selectedProgramId} onValueChange={(v) => { if (v) setSelectedProgramId(v) }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn ngành">
                          {selectedProgram ? `${selectedProgram.code} - ${selectedProgram.name}` : "Chọn ngành"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {programOptions.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.code} - {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedTemplate.scopeType === "course" && (
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Môn học</Label>
                      <span className="text-xs text-muted-foreground">
                        Đang lọc {filteredCourseOptions.length}/{courseOptions.length} môn
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={courseSearch}
                        onChange={(event) => setCourseSearch(event.target.value)}
                        placeholder="Tìm theo mã hoặc tên môn..."
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg border bg-background p-1">
                      {filteredCourseOptions.length ? (
                        filteredCourseOptions.map((course) => (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => setSelectedCourseId(String(course.id))}
                            className={`flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                              selectedCourseId === String(course.id) ? "bg-primary/10 text-primary" : ""
                            }`}
                          >
                            <span>
                              <span className="font-medium">{course.code}</span>
                              <span className="ml-2">{course.name}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{course.credits} TC</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Không tìm thấy môn phù hợp với phạm vi đã chọn.
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Môn học được lọc theo Khoa/Ngành ở trên để tránh xổ toàn bộ {courses.length} môn cùng lúc.
                    </p>
                  </div>
                )}

                {selectedTemplate.scopeType === "section" && (
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Môn học</Label>
                      <span className="text-xs text-muted-foreground">
                        Đang lọc {filteredCourseOptions.length}/{courseOptions.length} môn
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={courseSearch}
                        onChange={(event) => setCourseSearch(event.target.value)}
                        placeholder="Tìm môn trước khi chọn lớp..."
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-lg border bg-background p-1">
                      {filteredCourseOptions.slice(0, 40).map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => setSelectedCourseId(String(course.id))}
                          className={`flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                            selectedCourseId === String(course.id) ? "bg-primary/10 text-primary" : ""
                          }`}
                        >
                          <span>
                            <span className="font-medium">{course.code}</span>
                            <span className="ml-2">{course.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{course.credits} TC</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTemplate.scopeType === "section" && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Lớp học phần</Label>
                    <Input
                      value={sectionSearch}
                      onChange={(event) => setSectionSearch(event.target.value)}
                      placeholder="Tìm lớp theo mã, môn hoặc học kỳ..."
                    />
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
                    <p className="text-xs text-muted-foreground">
                      Hiển thị tối đa 120 lớp phù hợp với học kỳ, khoa/ngành và môn đã chọn.
                    </p>
                  </div>
                )}
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-background p-3 text-sm">
              <div className="text-xs font-medium uppercase text-muted-foreground">Phạm vi báo cáo sẽ sinh</div>
              <div className="mt-1 font-semibold">
                {selectedTemplate.scopeType === "school"
                  ? "Toàn trường"
                  : selectedTemplate.scopeType === "department"
                    ? selectedDepartment
                      ? `Khoa - ${selectedDepartment.name}`
                      : "Chưa chọn khoa"
                    : selectedTemplate.scopeType === "program"
                      ? selectedProgram
                        ? `Ngành - ${selectedProgram.name}`
                        : "Chưa chọn ngành"
                      : selectedTemplate.scopeType === "course"
                        ? courses.find((course) => String(course.id) === selectedCourseId)?.name ?? "Chưa chọn môn học"
                        : selectedSection
                          ? buildSectionLabel(selectedSection, courseMap, semesterMap)
                          : "Chưa chọn lớp học phần"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {lockedDepartmentId
                  ? "Phạm vi khoa đã được khóa theo tài khoản manager."
                  : "Phạm vi này sẽ được lưu vào report để lọc thư viện, xuất PDF và kiểm quyền xem lại."}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label className="text-sm font-medium">Phạm vi thời gian dữ liệu</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Từ ngày</Label>
                  <Input
                    type="date"
                    value={periodStartDate}
                    onChange={(event) => setPeriodStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Đến ngày</Label>
                  <Input
                    type="date"
                    value={periodEndDate}
                    onChange={(event) => setPeriodEndDate(event.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Để trống nếu muốn dùng toàn bộ dữ liệu. Khi chọn ngày, hệ thống chỉ tính các lượt học phần có ngày hoàn tất nằm trong khoảng này.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm">
              <input
                type="checkbox"
                checked={includeAiNarrative}
                onChange={(event) => setIncludeAiNarrative(event.target.checked)}
                className="mt-1 size-4"
              />
              <span>
                <span className="font-medium">Bật AI viết lại phần diễn giải</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Mặc định báo cáo dùng câu chữ theo luật để giữ số liệu kiểm chứng được. Nếu bật AI,
                  backend sẽ kiểm tra lại các con số trong phần viết trước khi lưu.
                </span>
              </span>
            </label>

            <Button onClick={() => handleGenerate()} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Tạo báo cáo
            </Button>
            <p className="text-center text-xs text-muted-foreground">Báo cáo sẽ mở ngay sau khi tạo. Bạn có thể xuất PDF từ bản xem.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Lịch tự động ── */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-5" /> Lịch sinh báo cáo tự động
            </DialogTitle>
            <DialogDescription>
              Báo cáo có thể sinh theo tuần, tháng, giữa kỳ, cuối kỳ hoặc sau khi cập nhật điểm. Mỗi actor chỉ thấy báo cáo thuộc phạm vi của mình.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-2">
              {availableScheduledPlans.map((plan) => {
                const savedSchedule = savedScheduleByName.get(plan.name)
                return (
                <Card key={plan.name}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold">{plan.name}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{plan.trigger}</p>
                      </div>
                      <Badge variant={savedSchedule ? "secondary" : "outline"}>
                        {savedSchedule ? "Đã lưu lịch" : plan.status}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md bg-muted/30 p-3 text-sm">
                        <div className="text-xs text-muted-foreground">Tần suất</div>
                        <div className="mt-1 font-medium">{plan.frequency}</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-3 text-sm">
                        <div className="text-xs text-muted-foreground">Người xem chính</div>
                        <div className="mt-1 font-medium">{plan.actor}</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-3 text-sm">
                        <div className="text-xs text-muted-foreground">Phạm vi</div>
                        <div className="mt-1 font-medium">{plan.scope}</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-3 text-sm">
                        <div className="text-xs text-muted-foreground">Định dạng</div>
                        <div className="mt-1 font-medium">{plan.output}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Lần chạy kế tiếp:{" "}
                        {savedSchedule?.next_run_at ? formatDate(savedSchedule.next_run_at) : plan.nextRun}
                      </span>
                      {savedSchedule?.last_report_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<a href={reportUrl(savedSchedule.last_report_id)} />}
                        >
                          Mở báo cáo gần nhất
                        </Button>
                      ) : null}
                      {!savedSchedule ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                          Sẵn sàng tự kích hoạt theo mốc điểm
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
                )
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ma trận actor và báo cáo được xem</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportSimpleTable
                  columns={["Actor", "Phạm vi dữ liệu", "Báo cáo chính", "Mức chi tiết"]}
                  rows={actorReportViews.map((item) => [item.actor, item.scope, item.reports, item.detail])}
                  empty="Chưa có ma trận actor."
                />
              </CardContent>
            </Card>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="font-semibold">Tự động hóa đã sẵn sàng</div>
              <p className="mt-1">
                Backend đã có worker nền để chạy lịch đến hạn. Khi cập nhật điểm giữa kỳ hoặc điểm cuối kỳ,
                hệ thống tự sinh báo cáo đúng phạm vi của actor; lịch tuần/tháng chạy theo next_run_at.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ReportTableRow {
  label: string
  value: React.ReactNode
  note?: React.ReactNode
}

function metricDisplay(metrics: Record<string, unknown>, key: string, fallback = "Chưa có") {
  const value = metrics[key]
  if (value == null || value === "") return fallback
  return typeof value === "number" ? value.toLocaleString("vi-VN") : localizeReportText(value)
}

function hasMetric(metrics: Record<string, unknown>, key: string) {
  const value = metrics[key]
  return value != null && value !== ""
}

function percentDisplay(value: unknown) {
  return typeof value === "number" ? `${value}%` : "Chưa có"
}

function reportSectionStatus(value: "good" | "watch" | "missing") {
  const label = value === "good" ? "Đủ dữ liệu" : value === "watch" ? "Cần theo dõi" : "Chưa đủ dữ liệu"
  const cls =
    value === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "watch"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-500"
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>
}

function ReportSectionBlock({
  index,
  title,
  purpose,
  status,
  children,
}: {
  index: number
  title: string
  purpose: string
  status: "good" | "watch" | "missing"
  children: React.ReactNode
}) {
  return (
    <section id={`report-section-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
            {index}
          </div>
          <div>
          <h3 className="text-[15px] font-bold uppercase tracking-wide text-slate-950">
            {title}
          </h3>
          <p className="mt-1 text-[13px] leading-6 text-slate-600">{purpose}</p>
          </div>
        </div>
        {reportSectionStatus(status)}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ReportKeyValueGrid({ rows }: { rows: ReportTableRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
      {rows.map((row) => (
        <tr key={row.label}>
          <td className="w-1/3 border-b border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold align-top text-slate-700">
            {row.label}
          </td>
          <td className="border-b border-slate-200 px-3 py-2.5 align-top">
            <div className="break-words">{row.value}</div>
            {row.note ? <div className="mt-1 text-xs text-slate-600">{row.note}</div> : null}
          </td>
        </tr>
      ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportSimpleTable({
  columns,
  rows,
  empty,
}: {
  columns: string[]
  rows: React.ReactNode[][]
  empty: string
}) {
  if (rows.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{empty}</div>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead className="bg-slate-950 text-white">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-slate-800 px-3 py-2.5 text-left font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 ? "bg-slate-50/60" : "bg-white"}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-slate-200 px-3 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DeepDiveLink({ href, label = "Mở phân tích" }: { href?: unknown; label?: string }) {
  const safeHref = normalizeDeepDiveHref(href)
  if (!safeHref) {
    return <span className="text-xs text-muted-foreground">Chưa có link</span>
  }
  return (
    <a href={safeHref} className="font-medium text-primary underline underline-offset-2">
      {label}
    </a>
  )
}

function buildOutcomeRows(attainment: Record<string, number> | null, target = 75) {
  if (!attainment) return []
  return Object.entries(attainment).map(([code, value]) => {
    const gap = Number((value - target).toFixed(1))
    const status = gap >= 5 ? "Tốt" : gap >= -5 ? "Theo dõi" : gap >= -15 ? "Cảnh báo" : "Nguy cấp"
    return [
      <span key="code" className="font-medium">{code}</span>,
      `${value}%`,
      `${target}%`,
      <span key="gap" className={gap < 0 ? "text-red-600" : "text-emerald-600"}>
        {gap > 0 ? "+" : ""}{gap}%
      </span>,
      status,
    ]
  })
}

function buildDeepInsightRows(metrics: Record<string, unknown>) {
  const raw = Array.isArray(metrics.deep_insights) ? metrics.deep_insights : []
  return (raw as Record<string, unknown>[]).map((item, index) => [
    index + 1,
    <div key="insight" className="space-y-1">
      <div className="font-semibold">{localizeReportText(item.title ?? "Insight")}</div>
      <div>{localizeReportText(item.finding ?? "")}</div>
    </div>,
    localizeReportText(item.evidence ?? ""),
    localizeReportText(item.action ?? ""),
    <DeepDiveLink key="deep-dive" href={item.href} />,
  ])
}

function buildRootCauseRows(metrics: Record<string, unknown>) {
  const raw = Array.isArray(metrics.root_causes) ? metrics.root_causes : []
  return (raw as Record<string, unknown>[]).map((item, index) => [
    index + 1,
    localizeReportText(item.evidence ?? ""),
    localizeReportText(item.hypothesis ?? ""),
    localizeReportText(item.next_check ?? ""),
    <DeepDiveLink key="deep-dive" href={item.href} />,
  ])
}

function buildActionPlanRows(metrics: Record<string, unknown>, fallbackActions: string[], actorRole: string) {
  const raw = Array.isArray(metrics.action_plan) ? metrics.action_plan : []
  if (raw.length) {
    return (raw as Record<string, unknown>[]).map((item, index) => [
      index + 1,
      localizeReportText(item.task ?? ""),
      localizeReportText(item.owner ?? (actorRole === "lecturer" ? "Giảng viên" : "Quản lý / trưởng đơn vị")),
      localizeReportText(item.reason ?? ""),
      localizeReportText(item.deadline ?? (index === 0 ? "7 ngày" : "30 ngày")),
      localizeReportText(item.priority ?? (index === 0 ? "Cao" : "Trung bình")),
      <DeepDiveLink key="deep-dive" href={item.href} />,
    ])
  }
  return fallbackActions.map((action, index) => [
    index + 1,
    localizeReportText(action),
    actorRole === "lecturer" ? "Giảng viên" : "Quản lý / trưởng đơn vị",
    "Theo khuyến nghị từ dữ liệu báo cáo.",
    index === 0 ? "7 ngày" : "30 ngày",
    index === 0 ? "Cao" : "Trung bình",
    <DeepDiveLink key="deep-dive" href={undefined} />,
  ])
}

function compactRows(rows: ReportTableRow[]) {
  return rows.filter((row) => row.value != null && row.value !== "")
}

function ReportStandardDocument({
  report,
  metrics,
  issues,
  risks,
  actions,
  goodSignals,
  confidence,
  cloAttainment,
  ploAttainment,
  watchlistStudents,
  coursesAtRisk,
}: {
  report: ApiReport
  metrics: Record<string, unknown>
  issues: string[]
  risks: string[]
  actions: string[]
  goodSignals: string[]
  confidence: number
  cloAttainment: Record<string, number> | null
  ploAttainment: Record<string, number> | null
  watchlistStudents: WatchlistEntry[]
  coursesAtRisk: string[]
}) {
  const completed = Number(metrics.completed_enrollments ?? metrics.graded_count ?? 0)
  const failed = Number(metrics.failed_enrollments ?? 0)
  const failRate = completed ? Math.round((failed / completed) * 1000) / 10 : null
  const weakClos = Array.isArray(metrics.weak_clos) ? metrics.weak_clos : []
  const linkedBottlenecks = [
    ...(Array.isArray(metrics.bottlenecks)
      ? (metrics.bottlenecks as Record<string, unknown>[]).map((item) => ({
          name: item.course ?? item.name,
          type: "Môn học",
          impact: item.failed != null ? `${item.failed} lượt chưa đạt` : "Cần theo dõi",
          note: "Mở trang phân tích môn để xem phân bố điểm, lớp yếu và xu hướng.",
          href: item.href,
        }))
      : []),
    ...(Array.isArray(metrics.weak_programs)
      ? (metrics.weak_programs as Record<string, unknown>[]).map((item) => ({
          name: item.program ?? item.name,
          type: "Ngành",
          impact: item.failed != null ? `${item.failed} lượt chưa đạt` : "Cần theo dõi",
          note: "Mở trang phân tích ngành để xem môn nghẽn và nhóm sinh viên rủi ro.",
          href: item.href,
        }))
      : []),
    ...(Array.isArray(metrics.weak_sections)
      ? (metrics.weak_sections as Record<string, unknown>[]).map((item) => ({
          name: item.section ?? item.name,
          type: "Lớp học phần",
          impact: item.pass_rate != null ? `Tỷ lệ đạt ${item.pass_rate}%` : "Cần theo dõi",
          note: "Mở trang phân tích lớp để xem sinh viên, điểm thành phần và giáo viên phụ trách.",
          href: item.href,
        }))
      : []),
  ]
  const bottleneckRows = [
    ...weakClos.slice(0, 4).map((item, index) => {
      const record = item as Record<string, unknown>
      return [
        index + 1,
        localizeReportText(`${record.code ?? "CLO"} ${record.name ?? ""}`),
        "CLO yếu",
        `${record.attainment ?? "?"}%`,
        "Cần rà soát rubric, đề và hoạt động luyện tập.",
        <DeepDiveLink key="deep-dive" href={record.href} />,
      ]
    }),
    ...linkedBottlenecks.slice(0, 6).map((item, index) => [
      weakClos.length + index + 1,
      localizeReportText(item.name ?? "Chưa rõ"),
      item.type,
      item.impact,
      item.note,
      <DeepDiveLink key="deep-dive" href={item.href} />,
    ]),
    ...coursesAtRisk.slice(0, 4).map((course, index) => [
      weakClos.length + linkedBottlenecks.length + index + 1,
      localizeReportText(course),
      "Học phần",
      "Cần theo dõi",
      "Học phần có dấu hiệu kéo kết quả xuống.",
      <DeepDiveLink key="deep-dive" href={undefined} />,
    ]),
    ...issues.slice(0, 3).map((issue, index) => [
      weakClos.length + linkedBottlenecks.length + coursesAtRisk.length + index + 1,
      localizeReportText(issue),
      "Vấn đề",
      "Cần kiểm chứng",
      "Cần truy vết thêm bằng dữ liệu thành phần.",
      <DeepDiveLink key="deep-dive" href={undefined} />,
    ]),
  ]

  const riskRows = risks.length
    ? risks.map((riskItem, index) => [
        index + 1,
        localizeReportText(riskItem),
        String(metrics.risk_level ?? "Chưa rõ"),
        index === 0 ? "Xử lý trong tuần" : "Theo dõi",
      ])
    : []

  const deepInsightRows = buildDeepInsightRows(metrics)
  const rootCauseRows = buildRootCauseRows(metrics)
  const actionRows = buildActionPlanRows(metrics, actions, report.actor_role)
  const cloRows = buildOutcomeRows(cloAttainment)
  const ploRows = buildOutcomeRows(ploAttainment)
  const showCloSection = cloRows.length > 0
  const showPloSection = ploRows.length > 0
  const scopeRows = compactRows([
    hasMetric(metrics, "active_students")
      ? { label: "Sinh viên đang học", value: metricDisplay(metrics, "active_students") }
      : null,
    hasMetric(metrics, "student_count")
      ? { label: "Sinh viên trong lớp", value: metricDisplay(metrics, "student_count") }
      : null,
    hasMetric(metrics, "program_count")
      ? { label: "Ngành / chương trình", value: metricDisplay(metrics, "program_count") }
      : null,
    hasMetric(metrics, "completed_enrollments")
      ? { label: "Lượt học phần hoàn tất", value: metricDisplay(metrics, "completed_enrollments") }
      : null,
    hasMetric(metrics, "graded_count")
      ? { label: "Sinh viên đã có điểm", value: metricDisplay(metrics, "graded_count") }
      : null,
    hasMetric(metrics, "evidence_count")
      ? { label: "Minh chứng", value: metricDisplay(metrics, "evidence_count") }
      : null,
    showCloSection || showPloSection
      ? { label: "Ngưỡng mục tiêu", value: "CLO/PLO mục tiêu 75%" }
      : null,
  ].filter(Boolean) as ReportTableRow[])
  const qualityRows = compactRows([
    { label: "Độ tin cậy", value: `${confidence}%`, note: dataConfidenceBasis(report) },
    { label: "Cỡ mẫu", value: confidenceSample(report).toLocaleString("vi-VN") },
    hasMetric(metrics, "missing_grade_rate")
      ? { label: "Tỷ lệ thiếu điểm", value: `${metrics.missing_grade_rate}%` }
      : null,
    hasMetric(metrics, "mapping_coverage")
      ? { label: "Mapping CLO/PLO", value: `${metrics.mapping_coverage}%` }
      : null,
    showCloSection || showPloSection
      ? { label: "Độ mạnh minh chứng", value: confidence >= 78 ? "Khá / tốt" : "Cần theo dõi" }
      : null,
  ].filter(Boolean) as ReportTableRow[])
  const outcomeRows = compactRows([
    hasMetric(metrics, "pass_rate") ? { label: "Tỷ lệ đạt", value: percentDisplay(metrics.pass_rate) } : null,
    failRate != null ? { label: "Tỷ lệ trượt", value: `${failRate}%` } : null,
    hasMetric(metrics, "avg_gpa") ? { label: "GPA trung bình", value: metricDisplay(metrics, "avg_gpa") } : null,
    hasMetric(metrics, "avg_grade") ? { label: "Điểm trung bình", value: metricDisplay(metrics, "avg_grade") } : null,
    hasMetric(metrics, "passed_enrollments")
      ? { label: "Lượt đạt", value: metricDisplay(metrics, "passed_enrollments") }
      : null,
    hasMetric(metrics, "failed_enrollments")
      ? { label: "Lượt chưa đạt", value: metricDisplay(metrics, "failed_enrollments") }
      : null,
  ].filter(Boolean) as ReportTableRow[])
  const riskLevel = String(metrics.risk_level ?? "Chưa rõ")
  const primaryOutcome =
    hasMetric(metrics, "pass_rate")
      ? percentDisplay(metrics.pass_rate)
      : hasMetric(metrics, "avg_grade")
        ? metricDisplay(metrics, "avg_grade")
        : hasMetric(metrics, "avg_gpa")
          ? metricDisplay(metrics, "avg_gpa")
          : "Chưa có"
  const evidenceCount = confidenceSample(report)
  const focusStatement = issues[0] ?? risks[0] ?? goodSignals[0] ?? "Chưa có nhận định trọng tâm."
  const nextAction = actions[0] ?? "Rà soát dữ liệu chi tiết và xác nhận với đơn vị phụ trách."
  const heroKpis = [
    { label: "Kết quả chính", value: primaryOutcome, note: hasMetric(metrics, "pass_rate") ? "tỷ lệ đạt quan sát" : "chỉ số trung tâm" },
    { label: "Mức rủi ro", value: riskLevel, note: "đánh giá từ snapshot dữ liệu" },
    { label: "Độ tin cậy", value: `${confidence}%`, note: `${evidenceCount.toLocaleString("vi-VN")} mẫu/minh chứng` },
  ]
  let sectionIndex = 1

  return (
    <article
      className="mx-auto max-w-[960px] overflow-hidden rounded-[1.25rem] bg-white text-slate-950 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200"
    >
      <header className="relative isolate overflow-hidden bg-slate-950 px-5 py-6 text-white sm:px-8 lg:px-10">
        <div className="absolute inset-y-0 right-0 -z-10 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.45),transparent_38%),linear-gradient(135deg,transparent,rgba(16,185,129,0.18))]" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-100">
              <span>EduInsight Report</span>
              <span className="h-1 w-1 rounded-full bg-cyan-200" />
              <span>{labelFromMap(report.report_type, reportTypeLabels)}</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{report.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
              {localizeReportText(report.summary)}
            </p>
          </div>
          <div className="min-w-[220px] rounded-2xl border border-white/15 bg-white/10 p-4 text-sm shadow-2xl backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-300">Phạm vi</div>
            <div className="mt-1 font-semibold">{reportScopeDisplay(report)}</div>
            <div className="mt-4 text-xs uppercase tracking-wide text-slate-300">Kỳ dữ liệu</div>
            <div className="mt-1">{reportPeriodLabel(report)}</div>
            <div className="mt-4 text-xs text-slate-300">Mã: {reportReference(report)}</div>
          </div>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {heroKpis.map((item) => (
            <ReportHeroKpi key={item.label} {...item} />
          ))}
        </div>
      </header>

      <div className="space-y-6 px-5 py-6 sm:px-8 lg:px-10">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <ReportExecutiveBrief
          focus={focusStatement}
          action={nextAction}
          recipient={reportRecipient(report)}
        />
        <ReportEvidenceCard
          confidence={confidence}
          sample={evidenceCount}
          basis={dataConfidenceBasis(report)}
          llmEnhanced={Boolean(metrics.llm_enhanced)}
        />
      </div>

      <ReportSectionBlock
        index={sectionIndex++}
        title="Thông tin báo cáo"
        purpose="Xác định báo cáo đang nói về phạm vi nào, ai xem và dữ liệu được chốt lúc nào."
        status="good"
      >
        <ReportKeyValueGrid
          rows={[
            { label: "Tên báo cáo", value: report.title },
            { label: "Loại báo cáo", value: labelFromMap(report.report_type, reportTypeLabels) },
            { label: "Phạm vi", value: reportScopeDisplay(report), note: report.scope_id ? `Mã phạm vi: ${report.scope_id}` : "Tất cả" },
            { label: "Kỳ dữ liệu phân tích", value: reportPeriodLabel(report) },
            { label: "Người tạo", value: report.generated_by ? "Người dùng hệ thống" : "Hệ thống" },
            { label: "Dữ liệu tính đến", value: formatDate(report.created_at) },
            { label: "Mã tra cứu", value: report.id },
            { label: "Phiên bản", value: "v1.0" },
            { label: "Trạng thái", value: labelFromMap(report.status, statusLabels) },
            { label: "Đối tượng tiếp nhận", value: reportRecipient(report) },
          ]}
        />
      </ReportSectionBlock>

      <ReportSectionBlock
        index={sectionIndex++}
        title="Tóm tắt điều hành"
        purpose="Nêu kết luận chính trước khi người đọc đi vào bảng số liệu."
        status="good"
      >
        <div className="space-y-3">
          <p className="rounded-md bg-muted/30 p-4 text-sm leading-6 text-justify">
            {localizeReportText(report.summary)}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <NarrativeCard title="Điểm đáng chú ý" items={goodSignals} />
            <NarrativeCard title="Vấn đề cần xử lý" items={issues} />
            <NarrativeCard title="Hành động ưu tiên" items={actions} />
          </div>
        </div>
      </ReportSectionBlock>

      <ReportSectionBlock
        index={sectionIndex++}
        title="Phạm vi dữ liệu"
        purpose="Cho biết báo cáo dùng bao nhiêu sinh viên, môn, lớp, lượt học phần và minh chứng."
        status={completed || metrics.active_students || metrics.student_count ? "good" : "missing"}
      >
        <ReportKeyValueGrid
          rows={scopeRows}
        />
      </ReportSectionBlock>

      <ReportSectionBlock
        index={sectionIndex++}
        title="Chất lượng dữ liệu"
        purpose="Chỉ ra độ tin cậy, cỡ mẫu, dữ liệu thiếu và mức mạnh yếu của bằng chứng."
        status={confidence >= 78 ? "good" : confidence >= 58 ? "watch" : "missing"}
      >
        <ReportKeyValueGrid
          rows={qualityRows}
        />
      </ReportSectionBlock>

      <ReportSectionBlock
        index={sectionIndex++}
        title="Tổng quan kết quả học tập"
        purpose="Tổng hợp điểm, tỷ lệ đạt/trượt và xu hướng học vụ trong phạm vi báo cáo."
        status={completed || metrics.pass_rate != null ? "good" : "missing"}
      >
        <ReportKeyValueGrid
          rows={outcomeRows}
        />
      </ReportSectionBlock>

      {deepInsightRows.length ? (
        <ReportSectionBlock
          index={sectionIndex++}
          title="Phân tích sâu từ dữ liệu"
          purpose="Tổng hợp các lát cắt quan trọng nhất: điểm nghẽn, bằng chứng, hành động và nơi cần mở để xem sâu."
          status="watch"
        >
          <ReportSimpleTable
            columns={["#", "Nhận định", "Bằng chứng", "Hành động", "Mở sâu"]}
            rows={deepInsightRows}
            empty="Chưa có insight phân tích sâu."
          />
        </ReportSectionBlock>
      ) : null}

      {showCloSection ? (
        <ReportSectionBlock
          index={sectionIndex++}
          title="Phân tích CLO"
          purpose="Cho biết CLO nào đạt/chưa đạt, gap so với mục tiêu và bằng chứng đo."
          status="good"
        >
          <ReportSimpleTable
            columns={["CLO", "Mức đạt", "Mục tiêu", "Gap", "Trạng thái"]}
            rows={cloRows}
            empty="Không có dữ liệu CLO trong snapshot."
          />
        </ReportSectionBlock>
      ) : null}

      {showPloSection ? (
        <ReportSectionBlock
          index={sectionIndex++}
          title="Phân tích PLO"
          purpose="Cho biết PLO nào dưới mục tiêu, có bằng chứng đủ mạnh không và cần drill-down ở đâu."
          status="good"
        >
          <ReportSimpleTable
            columns={["PLO", "Mức đạt", "Mục tiêu", "Gap", "Trạng thái"]}
            rows={ploRows}
            empty="Không có dữ liệu PLO trong snapshot."
          />
        </ReportSectionBlock>
      ) : null}

      <ReportSectionBlock
        index={sectionIndex++}
          title="Nguyên nhân và điểm nghẽn"
        purpose="Không chỉ nêu chuẩn yếu, mà chỉ ra môn, CLO, thành phần điểm hoặc lớp kéo kết quả xuống."
        status={bottleneckRows.length ? "watch" : "missing"}
      >
        <ReportSimpleTable
          columns={["Hạng", "Điểm nghẽn", "Loại", "Mức ảnh hưởng", "Ghi chú", "Phân tích sâu"]}
          rows={bottleneckRows}
          empty="Chưa đủ dữ liệu để xác định điểm nghẽn. Cần bổ sung CLO/PLO, điểm thành phần và ánh xạ học phần."
        />
      </ReportSectionBlock>

      {rootCauseRows.length ? (
        <ReportSectionBlock
          index={sectionIndex++}
          title="Nguyên nhân khả dĩ cần kiểm chứng"
          purpose="Tách rõ dấu hiệu đã thấy từ dữ liệu và giả thuyết cần mở dữ liệu để kiểm chứng."
          status="watch"
        >
          <ReportSimpleTable
            columns={["#", "Dấu hiệu từ dữ liệu", "Giả thuyết", "Cần kiểm chứng", "Mở sâu"]}
            rows={rootCauseRows}
            empty="Chưa có phân tích nguyên nhân khả dĩ."
          />
        </ReportSectionBlock>
      ) : null}

      <ReportSectionBlock
        index={sectionIndex++}
        title="Cảnh báo rủi ro"
        purpose="Chỉ ra nơi cần can thiệp ngay: sinh viên, lớp, môn, PLO hoặc dữ liệu thiếu."
        status={riskRows.length || watchlistStudents.length ? "watch" : "missing"}
      >
        <div className="space-y-3">
          <ReportSimpleTable
            columns={["#", "Rủi ro", "Mức độ", "Hành động"]}
            rows={riskRows}
            empty="Chưa có cảnh báo rủi ro rõ ràng trong snapshot."
          />
          {watchlistStudents.length ? (
            <div className="rounded-md border bg-amber-50 p-3 text-sm">
              Có {watchlistStudents.length} sinh viên trong danh sách cần chú ý. Danh sách chi tiết nằm ở phần tương tác bên dưới.
            </div>
          ) : null}
        </div>
      </ReportSectionBlock>

      <ReportSectionBlock
        index={sectionIndex++}
        title="Khuyến nghị & kế hoạch hành động"
        purpose="Kết thúc bằng việc rõ ai làm gì, khi nào, ưu tiên ra sao."
        status={actionRows.length ? "good" : "missing"}
      >
        <ReportSimpleTable
          columns={["#", "Hành động", "Phụ trách", "Lý do", "Hạn", "Ưu tiên", "Mở sâu"]}
          rows={actionRows}
          empty="Chưa có kế hoạch hành động. Cần rà soát dữ liệu và xác định đơn vị phụ trách."
        />
      </ReportSectionBlock>

      <div className="border-t border-slate-900 pt-5">
        <p className="text-[14px] leading-6 text-justify">
          Báo cáo này là căn cứ ban đầu để đơn vị phụ trách xem xét, xác minh dữ liệu chi tiết và triển khai biện pháp cải tiến. Các quyết định chính thức cần được đối chiếu với hồ sơ học vụ và quy định hiện hành của Nhà trường.
        </p>
        <div className="mt-8 grid gap-8 text-center text-[13px] font-bold sm:grid-cols-3">
          <div>NGƯỜI LẬP BÁO CÁO<div className="mt-1 font-normal italic">(Ký, ghi rõ họ tên)</div></div>
          <div>NGƯỜI KIỂM TRA<div className="mt-1 font-normal italic">(Ký, ghi rõ họ tên)</div></div>
          <div>THỦ TRƯỞNG ĐƠN VỊ<div className="mt-1 font-normal italic">(Ký, đóng dấu nếu có)</div></div>
        </div>
        <div className="mt-16 border-t border-slate-300 pt-2 text-[12px] text-slate-600">
          <strong>Nơi nhận:</strong> Như trên; lưu đơn vị lập báo cáo.<br />
          Mã tra cứu: {report.id} · Phiên bản 1.0 · Tài liệu sử dụng nội bộ.
        </div>
      </div>
      </div>
    </article>
  )
}

// ── Report Preview (Phase 2: per-type format) ─────────────────────────────────

function ReportPreview({ report, isLoading }: { report: ApiReport; isLoading: boolean }) {
  if (isLoading) {
    return <ReportPreviewSkeleton />
  }
  if (!report) {
    return (
      <Card>
        <CardContent className="grid min-h-[520px] place-items-center p-8 text-center">
          <div className="max-w-sm">
            <Eye className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Chưa có báo cáo tự động</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Khi lịch báo cáo của actor được kích hoạt, hệ thống sẽ tự sinh báo cáo và hiển thị tại đây.
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
    ["section_intervention", "course_health"].includes(report.report_type) &&
    metrics.clo_attainment != null &&
    typeof metrics.clo_attainment === "object" &&
    !Array.isArray(metrics.clo_attainment)
      ? (metrics.clo_attainment as Record<string, number>)
      : {}

  const ploAttainment =
    report.report_type === "program_health" &&
    metrics.plo_attainment != null &&
    typeof metrics.plo_attainment === "object" &&
    !Array.isArray(metrics.plo_attainment)
      ? (metrics.plo_attainment as Record<string, number>)
      : {}

  const watchlistStudents =
    report.report_type === "section_intervention"
      ? normalizeWatchlist(metrics.watchlist ?? metrics.watchlist_students)
      : []

  const coursesAtRisk =
    report.report_type === "program_health" ? stringList(metrics.courses_at_risk) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div>
          <div className="text-sm font-semibold">Bản trình bày theo thể thức báo cáo nội bộ</div>
          <div className="text-xs text-muted-foreground">
            Khổ A4, thể thức hành chính–học vụ, có mã tra cứu, nội dung phân tích và phần ký xác nhận.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadReportWord(report)}>
            <FileText className="mr-2 size-4" />
            Xuất Word
          </Button>
          <Button onClick={() => printReport(report)}>
            <Printer className="mr-2 size-4" />
            Xuất PDF
          </Button>
        </div>
      </div>

      <ReportStandardDocument
        report={report}
        metrics={metrics}
        issues={issues}
        risks={risks}
        actions={actions}
        goodSignals={goodSignals}
        confidence={confidence}
        cloAttainment={cloAttainment}
        ploAttainment={ploAttainment}
        watchlistStudents={watchlistStudents}
        coursesAtRisk={coursesAtRisk}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="border-b bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{labelFromMap(report.report_type, reportTypeLabels)}</Badge>
                <Badge variant={riskVariant(risk)}>Rủi ro {risk}</Badge>
                <Badge variant={metrics.llm_enhanced ? "default" : "outline"}>
                  {metrics.llm_enhanced ? "Có AI diễn giải" : "Diễn giải theo luật"}
                </Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">{report.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {localizeReportText(report.summary)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => printReport(report)}>
                <Printer className="mr-2 size-4" />
                Xuất PDF
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="space-y-6 p-6">
          {/* Logic tree: who reads this + data-driven Q&A */}
          <ReportContextPanel report={report} metrics={metrics} />

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
              caption={reportScopeDisplay(report)}
              tone="neutral"
            />
          </div>

          {/* ── Charts section per report type ── */}
          <ReportChartsSection report={report} metrics={metrics} />

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

          {/* Action plan table */}
          <ReportActionPanel actions={actions} risks={risks} actorRole={report.actor_role} />

          {/* Signals + issues compact */}
          {(goodSignals.length > 0 || issues.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <ReportListSection
                icon={CheckCircle2}
                title="Tín hiệu tốt"
                empty="Chưa có tín hiệu tốt trong ảnh chụp."
                items={goodSignals}
              />
              <ReportListSection
                icon={AlertTriangle}
                title="Điểm cần cải thiện"
                empty="Chưa có vấn đề trong ảnh chụp."
                items={issues}
              />
            </div>
          )}

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

function ReportHeroKpi({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl shadow-slate-950/20 backdrop-blur">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">{label}</div>
      <div className="mt-2 text-2xl font-semibold leading-tight text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-300">{note}</div>
    </div>
  )
}

function ReportExecutiveBrief({
  focus,
  action,
  recipient,
}: {
  focus: string
  action: string
  recipient: string
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <Sparkles className="size-4 text-primary" />
        Executive brief
      </div>
      <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">Điểm cần đọc trước</h3>
      <p className="mt-3 text-sm leading-7 text-slate-700">{localizeReportText(focus)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-medium uppercase text-slate-500">Người nhận chính</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{recipient}</div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
          <div className="text-xs font-medium uppercase text-blue-700">Bước tiếp theo</div>
          <div className="mt-1 text-sm leading-6 text-blue-950">{localizeReportText(action)}</div>
        </div>
      </div>
    </section>
  )
}

function ReportEvidenceCard({
  confidence,
  sample,
  basis,
  llmEnhanced,
}: {
  confidence: number
  sample: number
  basis: string
  llmEnhanced: boolean
}) {
  const tone = confidence >= 78 ? "text-emerald-700" : confidence >= 58 ? "text-amber-700" : "text-slate-500"
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Grounding</div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">Độ chắc của nhận định</h3>
        </div>
        <div className={`text-3xl font-semibold ${tone}`}>{confidence}%</div>
      </div>
      <Progress value={confidence} className="mt-4 h-2" />
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Cỡ mẫu</div>
          <div className="mt-1 font-semibold">{sample.toLocaleString("vi-VN")}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Diễn giải</div>
          <div className="mt-1 font-semibold">{llmEnhanced ? "AI có kiểm chứng" : "Theo luật"}</div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{basis}</p>
    </section>
  )
}

function NarrativeCard({ title, items }: { title: string; items: string[] }) {
  const visibleItems = items.slice(0, 3)
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-950">{title}</div>
      {visibleItems.length ? (
        <div className="mt-2 space-y-2 text-[13px] leading-6 text-slate-700">
          {visibleItems.map((item, index) => (
            <p key={`${title}-${index}`} className="border-l-2 border-slate-300 pl-3 text-justify">
              {localizeReportText(item)}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] leading-6 text-slate-500">Chưa có nhận định nổi bật.</p>
      )}
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

// ── ReportChartsSection — charts theo từng loại báo cáo ─────────────────────

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function NoDataBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <Info className="size-3.5 shrink-0" />
      {message}
    </div>
  )
}

function ReportChartsSection({
  report,
  metrics,
}: {
  report: ApiReport
  metrics: Record<string, unknown>
}) {
  const passRate = typeof metrics.pass_rate === "number" ? metrics.pass_rate : null
  const passedCount = typeof metrics.passed_enrollments === "number" ? metrics.passed_enrollments : null
  const failedCount = typeof metrics.failed_enrollments === "number" ? metrics.failed_enrollments : null

  // Trend data (Tier 2 — sẽ có sau khi backend thêm pass_rate_trend)
  const trendRaw = Array.isArray(metrics.pass_rate_trend) ? metrics.pass_rate_trend : null
  const trendData = trendRaw
    ? (trendRaw as Record<string, unknown>[]).map((item) => ({
        semester: String(item.semester ?? ""),
        value: typeof item.pass_rate === "number" ? item.pass_rate : 0,
        report_id: item.report_id ? String(item.report_id) : undefined,
      }))
    : null
  const openReport = (reportId: string) => {
    window.location.assign(reportUrl(reportId))
  }

  // ── school_overview ────────────────────────────────────────────────────────
  if (report.report_type === "school_overview") {
    const donutData =
      passedCount != null && failedCount != null
        ? [
            { name: "Đạt", value: passedCount, color: "#22c55e" },
            { name: "Chưa đạt", value: failedCount, color: "#ef4444" },
          ]
        : null

    return (
      <div className="space-y-4">
        {donutData ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ChartBlock title="Phân phối kết quả học phần">
              <ReportDonutChart
                data={donutData}
                centerText={passRate != null ? `${passRate}%` : undefined}
              />
            </ChartBlock>
            {trendData && trendData.length >= 2 ? (
              <ChartBlock title="Xu hướng tỷ lệ đạt theo kỳ">
                <ReportTrendLine data={trendData} onDotClick={openReport} />
              </ChartBlock>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  // ── department_health ──────────────────────────────────────────────────────
  if (report.report_type === "department_health") {
    const bottlenecks = Array.isArray(metrics.bottlenecks)
      ? (metrics.bottlenecks as Record<string, unknown>[]).map((item) => ({
          name: String(item.course ?? "").slice(0, 28),
          value: typeof item.failed === "number" ? item.failed : 0,
          fullName: String(item.course ?? ""),
          href: typeof item.href === "string" ? item.href : undefined,
        }))
      : []
    const weakPrograms = Array.isArray(metrics.weak_programs)
      ? (metrics.weak_programs as Record<string, unknown>[]).map((item) => ({
          name: String(item.program ?? "").slice(0, 28),
          value: typeof item.failed === "number" ? item.failed : 0,
          fullName: String(item.program ?? ""),
          href: typeof item.href === "string" ? item.href : undefined,
        }))
      : []

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <ChartBlock title="Môn nghẽn (số lượt trượt)">
            {bottlenecks.length ? (
              <ReportBarChart data={bottlenecks} target={0} unit=" lượt" label="Lượt trượt" />
            ) : (
              <NoDataBanner message="Chưa có dữ liệu lượt trượt theo môn." />
            )}
          </ChartBlock>
          <ChartBlock title="Ngành yếu (số lượt trượt)">
            {weakPrograms.length ? (
              <ReportBarChart data={weakPrograms} target={0} unit=" lượt" label="Lượt trượt" />
            ) : (
              <NoDataBanner message="Chưa có dữ liệu lượt trượt theo ngành." />
            )}
          </ChartBlock>
        </div>
        {trendData && trendData.length >= 2 ? (
          <ChartBlock title="Xu hướng tỷ lệ đạt theo kỳ">
            <ReportTrendLine data={trendData} onDotClick={openReport} />
          </ChartBlock>
        ) : null}
      </div>
    )
  }

  // ── program_health ─────────────────────────────────────────────────────────
  if (report.report_type === "program_health") {
    const plo =
      metrics.plo_attainment != null &&
      typeof metrics.plo_attainment === "object" &&
      !Array.isArray(metrics.plo_attainment)
        ? (metrics.plo_attainment as Record<string, number>)
        : null
    const ploEntries = plo ? Object.entries(plo) : []
    const radarData = ploEntries.map(([code, val]) => ({ subject: code, value: val }))
    const barData = ploEntries.map(([code, val]) => ({
      name: code,
      value: val,
      fullName: code,
    }))
    const bottlenecks = Array.isArray(metrics.bottlenecks)
      ? (metrics.bottlenecks as Record<string, unknown>[]).map((item) => ({
          name: String(item.course ?? "").slice(0, 28),
          value: typeof item.failed === "number" ? item.failed : 0,
          fullName: String(item.course ?? ""),
          href: typeof item.href === "string" ? item.href : undefined,
        }))
      : []

    return (
      <div className="space-y-4">
        {ploEntries.length > 0 ? (
          <ChartBlock title="Mức đạt PLO (chuẩn đầu ra chương trình)">
            {radarData.length >= 3 ? (
              <ReportRadarChart data={radarData} target={75} />
            ) : (
              <ReportBarChart data={barData} target={75} />
            )}
          </ChartBlock>
        ) : (
          <NoDataBanner message="Chưa có dữ liệu PLO — cần hoàn thiện ma trận CLO→PLO trong hệ thống." />
        )}
        {bottlenecks.length > 0 ? (
          <ChartBlock title="Môn nghẽn trong ngành">
            <ReportBarChart data={bottlenecks} target={0} unit=" lượt" label="Lượt trượt" />
          </ChartBlock>
        ) : null}
        {trendData && trendData.length >= 2 ? (
          <ChartBlock title="Xu hướng tỷ lệ đạt theo kỳ">
            <ReportTrendLine data={trendData} onDotClick={openReport} />
          </ChartBlock>
        ) : null}
      </div>
    )
  }

  // ── course_health ──────────────────────────────────────────────────────────
  if (report.report_type === "course_health") {
    const clo =
      metrics.clo_attainment != null &&
      typeof metrics.clo_attainment === "object" &&
      !Array.isArray(metrics.clo_attainment)
        ? (metrics.clo_attainment as Record<string, number>)
        : null
    const cloData = clo
      ? Object.entries(clo).map(([code, val]) => ({ name: code, value: val, fullName: code }))
      : []
    const weakSections = Array.isArray(metrics.weak_sections)
      ? (metrics.weak_sections as Record<string, unknown>[]).map((item) => ({
          name: String(item.section ?? "").slice(0, 20),
          pass_rate: typeof item.pass_rate === "number" ? item.pass_rate : 0,
          teacher: item.teacher ? String(item.teacher) : undefined,
          sample: typeof item.sample === "number" ? item.sample : undefined,
          href: typeof item.href === "string" ? item.href : undefined,
        }))
      : []

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {cloData.length > 0 ? (
            <ChartBlock title="Mức đạt CLO (chuẩn đầu ra môn học)">
              <ReportBarChart data={cloData} target={75} />
            </ChartBlock>
          ) : (
            <div className="sm:col-span-2">
              <NoDataBanner message="Chưa có dữ liệu CLO — cần gán thành phần điểm vào CLO trong cấu hình môn học." />
            </div>
          )}
          {weakSections.length > 0 ? (
            <ChartBlock title="So sánh tỷ lệ đạt giữa các lớp">
              <ReportSectionBarChart data={weakSections} target={70} />
            </ChartBlock>
          ) : null}
        </div>
        {trendData && trendData.length >= 2 ? (
          <ChartBlock title="Xu hướng tỷ lệ đạt theo kỳ">
            <ReportTrendLine data={trendData} onDotClick={openReport} />
          </ChartBlock>
        ) : null}
      </div>
    )
  }

  // ── section_intervention ───────────────────────────────────────────────────
  if (report.report_type === "section_intervention") {
    const clo =
      metrics.clo_attainment != null &&
      typeof metrics.clo_attainment === "object" &&
      !Array.isArray(metrics.clo_attainment)
        ? (metrics.clo_attainment as Record<string, number>)
        : null
    const cloData = clo
      ? Object.entries(clo).map(([code, val]) => ({ name: code, value: val, fullName: code }))
      : []

    const studentCount = typeof metrics.student_count === "number" ? metrics.student_count : 0
    const gradedCount = typeof metrics.graded_count === "number" ? metrics.graded_count : 0
    const watchlistCount = typeof metrics.watchlist_count === "number" ? metrics.watchlist_count : 0
    const notGraded = Math.max(0, studentCount - gradedCount)
    const safeCount = Math.max(0, gradedCount - watchlistCount)
    const donutData = [
      { name: "Đạt / An toàn", value: safeCount, color: "#22c55e" },
      { name: "Cần chú ý", value: watchlistCount, color: "#f59e0b" },
      { name: "Chưa có điểm", value: notGraded, color: "#94a3b8" },
    ].filter((d) => d.value > 0)

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {donutData.length > 0 ? (
            <ChartBlock title="Phân phối sinh viên">
              <ReportDonutChart
                data={donutData}
                centerText={passRate != null ? `${passRate}%` : undefined}
              />
            </ChartBlock>
          ) : null}
          {cloData.length > 0 ? (
            <ChartBlock title="Mức đạt CLO">
              <ReportBarChart data={cloData} target={75} />
            </ChartBlock>
          ) : (
            <NoDataBanner message="Chưa có dữ liệu CLO — cần gán thành phần điểm vào CLO." />
          )}
        </div>
      </div>
    )
  }

  return null
}

// ── Quick agent prompts theo loại báo cáo ────────────────────────────────────

export const AGENT_QUICK_PROMPTS: Record<string, { label: string; question: string; mode: ApiReportAgentMode }[]> = {
  school_overview: [
    { label: "Khoa/Ngành nào rủi ro nhất?", question: "Phân tích khoa và ngành đang có rủi ro cao nhất trong báo cáo toàn trường này. Dấu hiệu nào là thật và cần hành động ngay?", mode: "root_cause" },
    { label: "Xu hướng nhiều kỳ", question: "Tỷ lệ đạt toàn trường thay đổi thế nào qua các kỳ? Xu hướng đang tích cực hay đáng lo?", mode: "explain" },
    { label: "Đề xuất hành động ưu tiên", question: "Từ báo cáo toàn trường này, đề xuất 3 hành động cần làm ngay trong tuần theo thứ tự ưu tiên", mode: "action_planning" },
  ],
  department_health: [
    { label: "Môn nào cần cải thiện đề?", question: "Trong các môn nghẽn của khoa, môn nào có vấn đề cần xem lại đề thi và rubric? Phân tích từ dữ liệu lượt trượt.", mode: "root_cause" },
    { label: "Ngành yếu: nguyên nhân gốc rễ", question: "Ngành có tỷ lệ đạt thấp nhất trong báo cáo này — nguyên nhân nào là gốc rễ: đề khó, giảng viên, hay sinh viên đầu vào yếu?", mode: "root_cause" },
    { label: "Kế hoạch can thiệp ngay", question: "Tạo kế hoạch hành động 30 ngày cho khoa để giải quyết các vấn đề trong báo cáo này", mode: "action_planning" },
  ],
  program_health: [
    { label: "PLO nào dưới mục tiêu?", question: "Giải thích chi tiết PLO đang thấp nhất: CLO nào kéo xuống, môn học nào liên quan và cần làm gì?", mode: "root_cause" },
    { label: "Sẵn sàng kiểm định chưa?", question: "Báo cáo ngành này có đủ minh chứng CLO/PLO để nộp kiểm định chất lượng không? Còn thiếu phần nào?", mode: "explain" },
    { label: "Cải tiến chương trình", question: "Từ dữ liệu PLO và bottleneck môn, đề xuất điều chỉnh cụ thể nào cho chương trình đào tạo?", mode: "action_planning" },
  ],
  course_health: [
    { label: "CLO yếu: nguyên nhân?", question: "CLO nào thấp nhất trong môn học này? Giải thích: có thể do đề, rubric, phương pháp giảng hay sinh viên không đủ nền tảng?", mode: "root_cause" },
    { label: "Lớp bất thường: vì sao?", question: "Lớp nào đang có kết quả thấp bất thường so với lớp khác trong cùng môn? Giải thích nguyên nhân có thể.", mode: "root_cause" },
    { label: "Điều chỉnh đề / rubric", question: "Từ dữ liệu CLO và lớp yếu, đề xuất cụ thể: cần điều chỉnh đề, rubric hay hoạt động luyện tập nào?", mode: "action_planning" },
  ],
  section_intervention: [
    { label: "Sinh viên nào cần gặp ngay?", question: "Từ danh sách cần chú ý, sinh viên nào cần liên hệ ngay và nên gặp theo nhóm nguyên nhân nào?", mode: "root_cause" },
    { label: "CLO yếu: cần bổ sung gì?", question: "CLO nào cả lớp đang yếu nhất? Đề xuất bài tập bổ sung hoặc hoạt động luyện tập cụ thể để cải thiện.", mode: "action_planning" },
    { label: "Tỷ lệ đạt lớp vs chuẩn", question: "So sánh tỷ lệ đạt của lớp này với mức trung bình môn và ngưỡng mục tiêu. Khoảng cách có đáng lo không?", mode: "compare" },
  ],
  "": [
    { label: "Giải thích tỷ lệ đạt", question: "Chỉ số tỷ lệ đạt lấy từ đâu, công thức nào, cỡ mẫu có đủ không?", mode: "explain" },
    { label: "Phân tích rủi ro", question: "Vì sao báo cáo này có rủi ro, dấu hiệu nào là thật và giả thuyết nào cần kiểm chứng?", mode: "root_cause" },
    { label: "Đề xuất task", question: "Tạo task xử lý action quan trọng nhất từ báo cáo này", mode: "action_planning" },
  ],
}

// ── ReportContextPanel — logic tree: ai đọc + dữ liệu trả lời gì ─────────────

type QAResult = { q: string; answer: string | null }

const REPORT_LOGIC_TREE: Record<
  string,
  { role: string; icon: string; questions: (m: Record<string, unknown>) => QAResult[] }
> = {
  school_overview: {
    role: "Ban giám hiệu · Quản lý cấp trường",
    icon: "🏛️",
    questions: (m) => [
      {
        q: "Trường đang ở đâu về chất lượng đào tạo kỳ này?",
        answer:
          m.pass_rate != null
            ? `Tỷ lệ đạt toàn trường ${m.pass_rate}%${m.avg_gpa != null ? ` · GPA trung bình ${m.avg_gpa}` : ""}${typeof m.active_students === "number" ? ` · ${m.active_students} sinh viên đang học` : ""}`
            : null,
      },
      {
        q: "Khoa / ngành nào đang rủi ro cao và cần can thiệp?",
        answer: (() => {
          const b = Array.isArray(m.bottlenecks) ? (m.bottlenecks as Record<string, unknown>[]) : []
          if (b.length) {
            const top = b
              .slice(0, 3)
              .map((x) => String(x.course ?? x.program ?? x.name ?? "?"))
              .join(", ")
            return `${b.length} điểm nghẽn: ${top}${b.length > 3 ? ` và ${b.length - 3} khác` : ""}`
          }
          return typeof m.at_risk_students === "number" ? `${m.at_risk_students} sinh viên GPA nguy cơ toàn trường` : null
        })(),
      },
      {
        q: "So kỳ trước, xu hướng chất lượng đang tăng hay giảm?",
        answer: (() => {
          const trend = Array.isArray(m.pass_rate_trend) ? (m.pass_rate_trend as Record<string, unknown>[]) : []
          if (trend.length < 2) return null
          const last = trend[trend.length - 1]
          const prev = trend[trend.length - 2]
          const delta = (Number(last.pass_rate) - Number(prev.pass_rate)).toFixed(1)
          return `${last.semester}: ${last.pass_rate}% (${Number(delta) > 0 ? "+" : ""}${delta}% so kỳ trước)`
        })(),
      },
    ],
  },
  department_health: {
    role: "Trưởng khoa · Quản lý đào tạo",
    icon: "🏢",
    questions: (m) => [
      {
        q: "Ngành nào trong khoa đang có tỷ lệ đạt thấp nhất?",
        answer: (() => {
          const weak = Array.isArray(m.weak_programs) ? (m.weak_programs as Record<string, unknown>[]) : []
          if (weak.length) {
            const top = weak
              .slice(0, 2)
              .map((w) => `${w.program ?? w.name} (${w.failed ?? "?"} lượt trượt)`)
              .join(", ")
            return `${weak.length} ngành cần chú ý: ${top}`
          }
          return m.pass_rate != null
            ? `Tỷ lệ đạt khoa: ${m.pass_rate}%${typeof m.at_risk_students === "number" ? ` · ${m.at_risk_students} SV nguy cơ` : ""}`
            : null
        })(),
      },
      {
        q: "Môn nào đang gây nhiều lượt trượt nhất kỳ này?",
        answer: (() => {
          const b = Array.isArray(m.bottlenecks) ? (m.bottlenecks as Record<string, unknown>[]) : []
          if (!b.length) return null
          const top3 = b
            .slice(0, 3)
            .map((x) => `${x.course ?? x.name} (${x.failed ?? "?"} lượt)`)
            .join(", ")
          return `Top ${Math.min(3, b.length)}: ${top3}`
        })(),
      },
      {
        q: "Sinh viên nguy cơ tập trung ở đâu và mức nào?",
        answer:
          typeof m.at_risk_students === "number"
            ? `${m.at_risk_students} SV GPA dưới ngưỡng rủi ro · Mức rủi ro khoa: ${m.risk_level ?? "Chưa rõ"}`
            : null,
      },
    ],
  },
  program_health: {
    role: "Trưởng ngành · Đảm bảo chất lượng",
    icon: "📚",
    questions: (m) => [
      {
        q: "PLO nào đang dưới mục tiêu 75% và cần cải thiện?",
        answer: (() => {
          const plo =
            m.plo_attainment && typeof m.plo_attainment === "object" && !Array.isArray(m.plo_attainment)
              ? Object.entries(m.plo_attainment as Record<string, number>)
              : []
          if (!plo.length) return null
          const below = plo.filter(([, v]) => v < 75)
          if (!below.length) return `Tất cả ${plo.length} PLO đều đạt ≥75% — chương trình đang ổn định`
          return `${below.length}/${plo.length} PLO dưới mục tiêu: ${below.map(([k, v]) => `${k} (${v}%)`).join(", ")}`
        })(),
      },
      {
        q: "Học phần nào đang kéo tỷ lệ đạt / PLO xuống?",
        answer: (() => {
          const b = Array.isArray(m.bottlenecks) ? (m.bottlenecks as Record<string, unknown>[]) : []
          const c = Array.isArray(m.courses_at_risk) ? (m.courses_at_risk as unknown[]) : []
          if (b.length) return `${b.length} môn nghẽn: ${b.slice(0, 3).map((x) => x.course ?? x.name).join(", ")}`
          if (c.length) return `${c.length} học phần cần chú ý: ${c.slice(0, 3).join(", ")}`
          return null
        })(),
      },
      {
        q: "Minh chứng đo lường có đủ để đánh giá chương trình?",
        answer: (() => {
          const ploCount =
            m.plo_attainment && typeof m.plo_attainment === "object" && !Array.isArray(m.plo_attainment)
              ? Object.keys(m.plo_attainment as Record<string, number>).length
              : 0
          const cloCount =
            m.clo_attainment && typeof m.clo_attainment === "object" && !Array.isArray(m.clo_attainment)
              ? Object.keys(m.clo_attainment as Record<string, number>).length
              : 0
          const evCount = typeof m.evidence_count === "number" ? m.evidence_count : null
          if (!ploCount && !cloCount && evCount == null) return null
          const parts: string[] = []
          if (ploCount) parts.push(`${ploCount} PLO đo được`)
          if (cloCount) parts.push(`${cloCount} CLO có dữ liệu`)
          if (evCount != null) parts.push(`${evCount} minh chứng`)
          return parts.join(" · ")
        })(),
      },
    ],
  },
  course_health: {
    role: "Trưởng bộ môn · Giảng viên phụ trách môn",
    icon: "📘",
    questions: (m) => [
      {
        q: "CLO nào đang yếu nhất trong môn học này?",
        answer: (() => {
          const clo =
            m.clo_attainment && typeof m.clo_attainment === "object" && !Array.isArray(m.clo_attainment)
              ? Object.entries(m.clo_attainment as Record<string, number>)
              : []
          if (!clo.length) return null
          const below = clo.filter(([, v]) => v < 70).sort((a, b) => a[1] - b[1])
          if (!below.length) return `Tất cả ${clo.length} CLO đạt ≥70% — môn học ổn định`
          const weakest = below[0]
          return `${below.length} CLO dưới 70% · Yếu nhất: ${weakest[0]} (${weakest[1]}%)`
        })(),
      },
      {
        q: "Lớp nào có kết quả bất thường so với trung bình môn?",
        answer: (() => {
          const sects = Array.isArray(m.weak_sections) ? (m.weak_sections as Record<string, unknown>[]) : []
          if (sects.length) {
            const worst = sects[0]
            return `${sects.length} lớp dưới chuẩn · Thấp nhất: ${worst.section ?? "Lớp?"} (${worst.pass_rate ?? "?"}%)`
          }
          return m.pass_rate != null
            ? `Pass rate môn: ${m.pass_rate}%${typeof m.student_count === "number" ? ` · ${m.student_count} sinh viên` : ""}`
            : null
        })(),
      },
      {
        q: "Mức rủi ro tổng thể và sinh viên cần theo dõi?",
        answer:
          m.risk_level != null
            ? `Mức rủi ro: ${m.risk_level}${typeof m.at_risk_students === "number" && m.at_risk_students > 0 ? ` · ${m.at_risk_students} sinh viên cần theo dõi` : ""}`
            : null,
      },
    ],
  },
  section_intervention: {
    role: "Giảng viên · Cố vấn học tập",
    icon: "🏫",
    questions: (m) => [
      {
        q: "Có bao nhiêu sinh viên cần can thiệp ngay trong lớp?",
        answer: (() => {
          const wc = typeof m.watchlist_count === "number" ? m.watchlist_count : null
          const total = typeof m.student_count === "number" ? m.student_count : null
          if (wc == null && total == null) return null
          return `${wc ?? 0} sinh viên cần chú ý${total != null ? ` / ${total} tổng lớp` : ""}${typeof m.pass_rate === "number" ? ` · Tỷ lệ đạt lớp: ${m.pass_rate}%` : ""}`
        })(),
      },
      {
        q: "CLO nào cả lớp đang yếu nhất, cần ưu tiên bổ sung?",
        answer: (() => {
          const clo =
            m.clo_attainment && typeof m.clo_attainment === "object" && !Array.isArray(m.clo_attainment)
              ? Object.entries(m.clo_attainment as Record<string, number>)
              : []
          if (!clo.length) return null
          const below = [...clo].filter(([, v]) => v < 70).sort((a, b) => a[1] - b[1])
          if (!below.length) return `Tất cả CLO đạt ≥70% — lớp đang tốt`
          return `${below.length} CLO dưới 70%: ${below.slice(0, 2).map(([k, v]) => `${k} (${v}%)`).join(", ")}`
        })(),
      },
      {
        q: "Phân phối điểm lớp đang ở trạng thái nào?",
        answer: (() => {
          const graded = typeof m.graded_count === "number" ? m.graded_count : null
          const total = typeof m.student_count === "number" ? m.student_count : null
          const passed = typeof m.passed_enrollments === "number" ? m.passed_enrollments : null
          if (graded == null && passed == null) return null
          const parts: string[] = []
          if (graded != null && total != null) parts.push(`${graded}/${total} đã có điểm`)
          if (passed != null && graded != null && graded > 0) parts.push(`${passed} đạt (${Math.round((passed / graded) * 100)}%)`)
          if (typeof m.avg_grade === "number") parts.push(`Điểm TB: ${m.avg_grade}`)
          return parts.join(" · ")
        })(),
      },
    ],
  },
}

function ReportContextPanel({
  report,
  metrics,
}: {
  report: ApiReport
  metrics: Record<string, unknown>
}) {
  const config = REPORT_LOGIC_TREE[report.report_type]
  if (!config) return null
  const qas = config.questions(metrics)

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="text-2xl">{config.icon}</div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Báo cáo phục vụ
          </div>
          <div className="mt-0.5 font-semibold text-foreground">{config.role}</div>
        </div>
        <Badge variant="outline" className="ml-auto shrink-0 text-[11px]">
          {labelFromMap(report.report_type, reportTypeLabels)}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Câu hỏi cốt lõi &amp; câu trả lời từ dữ liệu
        </div>
        {qas.map((qa, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3.5 ${
              qa.answer
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            }`}
          >
            <div className="text-[12px] font-medium text-muted-foreground">{qa.q}</div>
            <div
              className={`mt-1.5 text-sm font-semibold leading-snug ${
                qa.answer ? "text-emerald-900 dark:text-emerald-100" : "text-amber-800 dark:text-amber-200"
              }`}
            >
              {qa.answer ?? "Chưa đủ dữ liệu — hỏi trợ lý để phân tích sâu hơn"}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ReportActionPanel — bảng kế hoạch hành động ưu tiên ──────────────────────

function ReportActionPanel({
  actions,
  risks,
  actorRole,
}: {
  actions: string[]
  risks: string[]
  actorRole: string
}) {
  if (!actions.length && !risks.length) return null
  const owner = actorRole === "lecturer" ? "Giảng viên" : "Quản lý / Trưởng đơn vị"
  const rows = actions.map((action, i) => ({
    action: localizeReportText(action),
    priority: i === 0 ? "Cao" : i === 1 ? "Trung bình" : "Bình thường",
    owner,
    deadline: i === 0 ? "7 ngày" : "30 ngày",
  }))

  return (
    <section className="rounded-xl border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-4 text-primary" />
        <h3 className="font-semibold">Kế hoạch hành động</h3>
        <Badge variant="secondary" className="ml-auto text-[11px]">{rows.length} hành động</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-8">#</th>
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hành động</th>
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-24">Phụ trách</th>
              <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-20">Hạn</th>
              <th className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-24">Ưu tiên</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="py-2.5 pr-4 leading-relaxed">{row.action}</td>
                <td className="py-2.5 pr-4 text-muted-foreground text-xs">{row.owner}</td>
                <td className="py-2.5 pr-4 text-muted-foreground text-xs tabular-nums">{row.deadline}</td>
                <td className="py-2.5">
                  <Badge
                    variant={row.priority === "Cao" ? "destructive" : row.priority === "Trung bình" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {row.priority}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {risks.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rủi ro cần theo dõi</div>
          {risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {localizeReportText(r)}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function FloatingAgent({
  open,
  setOpen,
  ...agentProps
}: {
  open: boolean
  setOpen: (open: boolean) => void
} & React.ComponentProps<typeof AgentPanel>) {
  return (
    <div className="fixed bottom-6 right-6 z-50 print:hidden">
      {open ? (
        <div className="w-[min(420px,calc(100vw-2rem))] max-h-[82vh] overflow-y-auto rounded-2xl border bg-background p-4 shadow-2xl">
          <AgentPanel {...agentProps} onClose={() => setOpen(false)} />
        </div>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="size-14 rounded-full shadow-xl"
          aria-label="Mở trợ lý báo cáo"
        >
          <Bot className="size-6" />
        </Button>
      )}
    </div>
  )
}

export function AgentPanel({
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
  onClose,
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
  onClose?: () => void
}) {
  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-5 text-primary" />
              Trợ lý báo cáo
            </CardTitle>
            {onClose ? (
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng trợ lý">
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={reportUrl(selectedReport.id)} />}
                >
                  Mở báo cáo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}${reportUrl(selectedReport.id)}`
                    void navigator.clipboard?.writeText(url)
                  }}
                >
                  Sao chép link
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              Chọn một báo cáo ở danh sách bên trái để bắt đầu hỏi trợ lý.
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
            {AGENT_QUICK_PROMPTS[selectedReport?.report_type ?? ""].map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => onQuickAsk(p.question, p.mode)}>
                {p.label}
              </Button>
            ))}
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
            <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm leading-6">
              {renderAgentResponse(answer.response)}
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
