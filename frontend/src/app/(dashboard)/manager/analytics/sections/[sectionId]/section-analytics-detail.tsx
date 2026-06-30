"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mail,
  MessageSquare,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react"
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
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  api,
  type ApiInterventionCampaign,
  type ApiInterventionScopeSummary,
  type ApiSection,
  type ApiSemester,
} from "@/lib/api"
import { requestDashboardAgent, setDashboardAgentContext } from "@/lib/dashboard-agent-context"

type Raw = {
  courses: Awaited<ReturnType<typeof api.getCourses>>
  enrollments: Awaited<ReturnType<typeof api.getEnrollments>>
  sections: ApiSection[]
  semesters: ApiSemester[]
  students: Awaited<ReturnType<typeof api.getStudents>>
}

type RiskLevel = "fail" | "nearFail" | "risk"
type SectionRiskLevel = "high" | "medium" | "watch" | "normal" | "pending"

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

function riskPointColor(level: RiskLevel) {
  if (level === "fail") return "#dc2626"
  if (level === "nearFail") return "#f97316"
  return "#f59e0b"
}

export function SectionAnalyticsDetail({ sectionId }: { sectionId: number }) {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [agentLoading, setAgentLoading] = React.useState(false)
  const [agentSummary, setAgentSummary] = React.useState<ApiInterventionScopeSummary | null>(null)
  const [agentError, setAgentError] = React.useState("")
  const [mailDraftLoading, setMailDraftLoading] = React.useState(false)
  const [campaign, setCampaign] = React.useState<ApiInterventionCampaign | null>(null)
  const [bulkLoading, setBulkLoading] = React.useState(false)
  const [campaignResult, setCampaignResult] = React.useState<ApiInterventionCampaign | null>(null)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    Promise.all([
      api.getCourses({ limit: 500 }),
      api.getEnrollments({ limit: 50000 }),
      api.getSections({ limit: 5000 }),
      api.getSemesters(),
      api.getStudents({ limit: 5000 }),
    ])
      .then(([courses, enrollments, sections, semesters, students]) => {
        if (active) setRaw({ courses, enrollments, sections, semesters, students })
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được phân tích lớp học phần.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [sectionId])

  const maps = React.useMemo(() => {
    if (!raw) return null
    return {
      secMap: new Map(raw.sections.map((section) => [section.id, section])),
      semMap: new Map(raw.semesters.map((semester) => [semester.id, semester])),
      studentMap: new Map(raw.students.map((student) => [student.id, student])),
      courseMap: new Map(raw.courses.map((course) => [course.id, course])),
    }
  }, [raw])

  const selectedSection = maps?.secMap.get(sectionId)
  const selectedCourse = selectedSection ? maps?.courseMap.get(selectedSection.course_id) : undefined
  const selectedSemester = selectedSection ? maps?.semMap.get(selectedSection.semester_id) : undefined

  const sectionStats = React.useMemo(() => {
    if (!raw || !maps || !selectedSection || !selectedSemester) return null
    const secEnrolls = raw.enrollments.filter((enrollment) => enrollment.section_id === selectedSection.id)
    const graded = secEnrolls.filter((enrollment) => enrollment.final_grade !== null)
    const valid = secEnrolls.filter((enrollment) => enrollment.is_passed !== null)
    const failed = valid.filter((enrollment) => enrollment.is_passed === false).length
    const nearFail = graded.filter((enrollment) => enrollment.final_grade! >= 4 && enrollment.final_grade! < 5).length
    const watch = graded.filter((enrollment) => enrollment.final_grade! >= 5 && enrollment.final_grade! < 5.5).length
    const atRisk = failed + nearFail + watch
    const passRate = valid.length ? +((valid.length - failed) / valid.length * 100).toFixed(1) : null
    const avgGrade = graded.length ? +(graded.reduce((sum, enrollment) => sum + enrollment.final_grade!, 0) / graded.length).toFixed(2) : null

    const peerSections = raw.sections.filter((section) => section.course_id === selectedSection.course_id && section.semester_id === selectedSection.semester_id)
    const peerEnrollments = new Map<number, typeof raw.enrollments>()
    for (const section of peerSections) {
      peerEnrollments.set(section.id, [])
    }
    for (const enrollment of raw.enrollments) {
      if (!peerEnrollments.has(enrollment.section_id)) continue
      peerEnrollments.get(enrollment.section_id)?.push(enrollment)
    }
    const peerRows = peerSections.map((section) => {
      const enrollments = peerEnrollments.get(section.id) ?? []
      const peerValid = enrollments.filter((enrollment) => enrollment.is_passed !== null)
      const peerGraded = enrollments.filter((enrollment) => enrollment.final_grade !== null)
      const peerFailed = peerValid.filter((enrollment) => enrollment.is_passed === false).length
      return {
        id: section.id,
        label: section.section_code,
        passRate: peerValid.length ? +((peerValid.length - peerFailed) / peerValid.length * 100).toFixed(1) : 0,
        avgGrade: peerGraded.length ? +(peerGraded.reduce((sum, enrollment) => sum + enrollment.final_grade!, 0) / peerGraded.length).toFixed(2) : 0,
        atRisk: peerFailed + peerGraded.filter((enrollment) => enrollment.final_grade! >= 4 && enrollment.final_grade! < 5.5).length,
        isSelected: section.id === selectedSection.id,
      }
    }).filter((row) => row.passRate > 0 || row.avgGrade > 0)

    const benchmarkValid = peerRows.length ? peerRows.reduce((sum, row) => sum + row.passRate, 0) / peerRows.length : null
    const diff = benchmarkValid === null || passRate === null ? null : +(passRate - benchmarkValid).toFixed(1)
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

    const riskStudents: { id: number; code: string; name: string; grade: number | null; gpa: number | null; failed: number; level: RiskLevel }[] = []
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
          gpa: student.gpa_cumulative,
          failed: 0,
          level,
        })
      }
    }
    const order: Record<RiskLevel, number> = { fail: 0, nearFail: 1, risk: 2 }
    riskStudents.sort((a, b) => order[a.level] - order[b.level] || (a.grade ?? 99) - (b.grade ?? 99))

    const distribution = DIST_RANGES.map((range) => ({
      ...range,
      count: graded.filter((enrollment) => enrollment.final_grade! >= range.min && enrollment.final_grade! < range.max).length,
    }))
    const gpaDistribution = GPA_BANDS.map((band) => ({
      ...band,
      count: secEnrolls.filter((enrollment) => {
        const gpa = maps.studentMap.get(enrollment.student_id)?.gpa_cumulative
        return gpa !== null && gpa !== undefined && gpa >= band.min && gpa < band.max
      }).length,
    }))
    const studentRiskMap = riskStudents.map((student) => ({
      ...student,
      x: student.grade ?? 0,
      y: student.gpa ?? 0,
      size: student.level === "fail" ? 260 : student.level === "nearFail" ? 180 : 120,
    }))

    return {
      total: secEnrolls.length,
      graded: graded.length,
      pending: Math.max(0, secEnrolls.length - graded.length),
      failed,
      nearFail,
      watch,
      atRisk,
      passRate,
      avgGrade,
      diff,
      risk,
      riskReasons,
      distribution,
      gpaDistribution,
      peerRows,
      riskStudents,
      studentRiskMap,
    }
  }, [raw, maps, selectedSection, selectedSemester])

  const campaignStudentIds = React.useMemo(() => {
    const priorityIds = agentSummary?.priority_students.map((student) => student.student_id) ?? []
    if (priorityIds.length) return priorityIds
    return sectionStats?.riskStudents.map((student) => student.id).slice(0, 20) ?? []
  }, [agentSummary, sectionStats])

  React.useEffect(() => {
    if (!selectedSection || !selectedCourse || !selectedSemester || !sectionStats) return
    setDashboardAgentContext({
      source: "section_analytics_detail",
      route: `/manager/analytics/sections/${sectionId}`,
      dashboard_type: "section_detail",
      scope: {
        scope_type: "section",
        scope_id: sectionId,
        section_code: selectedSection.section_code,
        course_id: selectedCourse.id,
        course_code: selectedCourse.code,
        semester_id: selectedSemester.id,
        semester_code: selectedSemester.code,
      },
      filters: {
        semester_code: selectedSemester.code,
        course_id: selectedCourse.id,
      },
      selected_entities: {
        section_code: selectedSection.section_code,
        course_name: selectedCourse.name,
        semester_name: selectedSemester.name,
      },
      visible_metrics: {
        total_students: sectionStats.total,
        graded_students: sectionStats.graded,
        pending_grades: sectionStats.pending,
        average_grade: sectionStats.avgGrade,
        pass_rate: sectionStats.passRate,
        at_risk_students: sectionStats.atRisk,
        failed_students: sectionStats.failed,
        near_fail_students: sectionStats.nearFail,
        benchmark_diff_points: sectionStats.diff,
        risk_level: sectionStats.risk,
      },
      alerts: sectionStats.riskReasons,
      chart_summaries: {
        grade_distribution: sectionStats.distribution.map((item) => ({ band: item.label, count: item.count })),
        gpa_distribution: sectionStats.gpaDistribution.map((item) => ({ band: item.label, count: item.count })),
        peer_comparison: [...sectionStats.peerRows]
          .sort((a, b) => a.passRate - b.passRate)
          .map((item) => ({
            section_id: item.id,
            section_code: item.label,
            pass_rate: item.passRate,
            average_grade: item.avgGrade,
            at_risk_students: item.atRisk,
            is_current_section: item.isSelected,
          })),
      },
      rows_preview: sectionStats.riskStudents.slice(0, 12).map((student) => ({
        student_id: student.id,
        student_code: student.code,
        full_name: student.name,
        final_grade: student.grade,
        gpa_cumulative: student.gpa,
        risk_level: student.level,
      })),
    })
  }, [sectionId, selectedCourse, selectedSection, selectedSemester, sectionStats])

  async function runSectionAgent() {
    setAgentLoading(true)
    setAgentError("")
    setAgentSummary(null)
    setCampaign(null)
    setCampaignResult(null)
    try {
      setAgentSummary(await api.summarizeInterventionScope({ scope_type: "section", scope_id: sectionId }))
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không chạy được Agent hỗ trợ lớp học phần.")
    } finally {
      setAgentLoading(false)
    }
  }

  async function buildBulkEmails() {
    if (!selectedSection) return
    setMailDraftLoading(true)
    setAgentError("")
    try {
      const summary = agentSummary ?? await api.summarizeInterventionScope({ scope_type: "section", scope_id: sectionId })
      setAgentSummary(summary)
      const studentIds = campaignStudentIds.length ? campaignStudentIds : summary.priority_students.map((student) => student.student_id)
      const created = await api.createInterventionCampaign({
        scope_type: "section",
        scope_id: sectionId,
        student_ids: studentIds,
        title: `Campaign hỗ trợ học tập - ${selectedSection.section_code}`,
        objective: "course_recovery",
        max_students: 20,
      })
      setCampaign(await api.generateInterventionCampaignDrafts(created.id, {
        student_ids: studentIds,
        channel: "email",
        subject: `Hỗ trợ học tập lớp ${selectedSection.section_code}`,
        max_students: 20,
      }))
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không tạo được email nháp cho campaign.")
    } finally {
      setMailDraftLoading(false)
    }
  }

  async function sendCampaign() {
    if (!campaign) return
    setBulkLoading(true)
    setAgentError("")
    try {
      await api.approveInterventionCampaign(campaign.id)
      const result = await api.finalizeInterventionCampaign(campaign.id)
      setCampaign(result)
      setCampaignResult(result)
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không gửi được campaign hỗ trợ học tập.")
    } finally {
      setBulkLoading(false)
    }
  }

  if (loading) return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Đang tải phân tích lớp học phần...</div>

  if (error || !raw || !selectedSection || !sectionStats) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          {error || "Không tìm thấy lớp học phần cần phân tích."}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/manager/analytics/sections" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-3 mb-2" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />Lớp học phần
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{selectedSection.section_code}</h1>
            <Badge variant="outline" className={riskClass(sectionStats.risk)}>{SECTION_RISK_LABEL[sectionStats.risk]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{selectedCourse?.name ?? "Môn học"} · {selectedSemester?.name ?? selectedSemester?.code ?? "-"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(sectionStats.riskReasons.length ? sectionStats.riskReasons : ["Không có cảnh báo mạnh"]).map((reason) => (
              <Badge key={reason} variant="outline" className="text-[10px]">{reason}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => requestDashboardAgent("Phân tích dashboard lớp học phần hiện tại: chỉ ra cảnh báo chính, nguyên nhân từ biểu đồ, so sánh benchmark và đề xuất hành động ưu tiên.")}
          >
            <MessageSquare className="mr-2 h-4 w-4" />Phân tích màn hình
          </Button>
          <Button variant="outline" onClick={runSectionAgent} disabled={agentLoading}>
            <Sparkles className="mr-2 h-4 w-4" />{agentLoading ? "Đang phân tích..." : "Chạy Agent"}
          </Button>
          <Button onClick={buildBulkEmails} disabled={mailDraftLoading || campaignStudentIds.length === 0}>
            <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : "Tạo nháp email"}
          </Button>
        </div>
      </div>

      {agentError ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{agentError}</div> : null}
      {campaignResult ? <div className="rounded-lg border bg-muted/20 p-3 text-sm">{campaignResult.message ?? "Đã xử lý campaign hỗ trợ học tập."}</div> : null}

      {agentSummary ? (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />Kết quả Agent can thiệp
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agent đã gom tín hiệu học tập thành danh sách ưu tiên để giảng viên/admin duyệt trước khi tạo campaign.
                </p>
              </div>
              <Button onClick={buildBulkEmails} disabled={mailDraftLoading || campaignStudentIds.length === 0}>
                <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : "Tạo nháp email"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "Tổng SV", value: agentSummary.summary.total },
                { label: "Rủi ro cao", value: agentSummary.summary.high },
                { label: "Theo dõi", value: agentSummary.summary.watch },
                { label: "Đã liên hệ", value: agentSummary.summary.contacted },
              ].map((item) => (
                <div key={item.label} className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Khuyến nghị hành động</p>
                <div className="mt-2 space-y-2">
                  {agentSummary.recommendations.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-md border bg-background p-3 text-sm leading-relaxed">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Nhóm nguyên nhân</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(agentSummary.reason_groups).length ? Object.entries(agentSummary.reason_groups).map(([reason, count]) => (
                    <Badge key={reason} variant="outline" className="gap-1">
                      {reason}<span className="font-mono text-[10px] text-muted-foreground">{count}</span>
                    </Badge>
                  )) : <span className="text-sm text-muted-foreground">Chưa có nhóm nguyên nhân nổi bật.</span>}
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Sinh viên ưu tiên</div>
              <div className="max-h-[260px] overflow-auto divide-y">
                {agentSummary.priority_students.map((student) => (
                  <div key={student.student_id} className="p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{student.full_name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{student.student_code}</p>
                      </div>
                      <Badge variant={student.risk_level === "high" ? "destructive" : "outline"}>{student.risk_score}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {(student.reasons.length ? student.reasons : ["Cần theo dõi học tập"]).join("; ")}
                    </p>
                  </div>
                ))}
                {!agentSummary.priority_students.length ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Không có sinh viên ưu tiên trong lần phân tích này.</div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Sinh viên", value: sectionStats.total, icon: Users },
          { label: "Có điểm", value: `${sectionStats.graded}/${sectionStats.total}`, icon: CheckCircle2 },
          { label: "Điểm TB", value: sectionStats.avgGrade?.toFixed(2) ?? "-", icon: CheckCircle2 },
          { label: "Tỷ lệ đạt", value: sectionStats.passRate === null ? "-" : `${sectionStats.passRate}%`, icon: CheckCircle2 },
          { label: "Cần hỗ trợ", value: sectionStats.atRisk, icon: AlertTriangle },
          { label: "So benchmark", value: sectionStats.diff === null ? "-" : `${sectionStats.diff > 0 ? "+" : ""}${sectionStats.diff}%`, icon: TrendingDown },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between pb-5 pt-5">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Phân phối điểm</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sectionStats.distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [value, "Sinh viên"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {sectionStats.distribution.map((range) => <Cell key={range.label} fill={range.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Nền GPA của lớp</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sectionStats.gpaDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [value, "Sinh viên"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {sectionStats.gpaDistribution.map((band) => <Cell key={band.label} fill={band.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sinh viên rủi ro</CardTitle>
            <p className="text-xs text-muted-foreground">Trục X là điểm môn, trục Y là GPA tích lũy.</p>
          </CardHeader>
          <CardContent>
            {sectionStats.studentRiskMap.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <YAxis type="number" dataKey="y" domain={[0, 4]} tick={{ fontSize: 10 }} width={32} />
                  <ZAxis type="number" dataKey="size" range={[90, 320]} />
                  <ReferenceLine x={5} stroke="#dc2626" strokeDasharray="5 4" />
                  <Tooltip
                    formatter={(value, name, item) => {
                      const row = item.payload as (typeof sectionStats.studentRiskMap)[number]
                      if (name === "x") return [Number(value).toFixed(1), `${row.name} · ${LEVEL_LABEL[row.level]}`]
                      if (name === "y") return [Number(value).toFixed(2), "GPA tích lũy"]
                      return [value, name]
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Scatter data={sectionStats.studentRiskMap}>
                    {sectionStats.studentRiskMap.map((student) => <Cell key={student.id} fill={riskPointColor(student.level)} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Không có sinh viên rủi ro trong lớp này.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">So với lớp cùng môn/kỳ</CardTitle>
          </CardHeader>
          <CardContent>
            {sectionStats.peerRows.length > 1 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[...sectionStats.peerRows].sort((a, b) => a.passRate - b.passRate)} layout="vertical" margin={{ left: 4, right: 20, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10 }} />
                  <ReferenceLine x={70} stroke="#f59e0b" strokeDasharray="5 4" />
                  <Tooltip formatter={(value, _name, item) => [`${Number(value).toFixed(1)}%`, `Điểm TB ${item.payload.avgGrade.toFixed(2)} · ${item.payload.atRisk} SV hỗ trợ`]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="passRate" radius={[0, 5, 5, 0]}>
                    {[...sectionStats.peerRows].sort((a, b) => a.passRate - b.passRate).map((row) => <Cell key={row.id} fill={row.isSelected ? "#2563eb" : "#94a3b8"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Chưa có lớp cùng môn/kỳ đủ dữ liệu để so sánh.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Danh sách cần hỗ trợ</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[320px] overflow-auto">
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
                  {!sectionStats.riskStudents.length ? <tr><td colSpan={3} className="py-10 text-center text-muted-foreground">Không có sinh viên cần hỗ trợ.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {campaign ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Email nháp campaign</CardTitle>
            <p className="text-xs text-muted-foreground">{campaign.messages.length} email cá nhân hóa đang chờ duyệt gửi.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[420px] overflow-auto rounded-md border">
              {campaign.messages.map((message) => (
                <div key={message.id} className="border-b p-3 text-sm last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{message.full_name ?? "Sinh viên"} <span className="font-mono text-xs text-muted-foreground">{message.student_code}</span></p>
                      <p className="text-xs text-muted-foreground">{message.recipient_email ?? "Thiếu email"}</p>
                    </div>
                    <Badge variant={message.status === "failed" ? "destructive" : "outline"}>{message.status}</Badge>
                  </div>
                  <p className="mt-2 font-medium">{message.subject}</p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{message.body}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={sendCampaign} disabled={bulkLoading || campaign.messages.every((message) => message.status === "failed")}>
                {bulkLoading ? "Đang gửi..." : "Gửi email"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
