"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, GraduationCap, Mail, Search, Sparkles, Trash2, UserRound, Users } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  api,
  type ApiCampaignDeliveryStatus,
  type ApiHomeroomAssignment,
  type ApiHomeroomClassDetail,
  type ApiHomeroomClassSummary,
  type ApiInterventionCampaign,
  type ApiInterventionScopeSummary,
  type ApiStudent,
  type ApiTeacher,
  type ApiUser,
} from "@/lib/api"

function riskBadge(level: "high" | "watch" | "normal") {
  if (level === "high") return <Badge variant="destructive">Cần ưu tiên</Badge>
  if (level === "watch") return <Badge className="border-orange-500/40 bg-orange-500/10 text-orange-600" variant="outline">Theo dõi</Badge>
  return <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600" variant="outline">Ổn định</Badge>
}

function messageStatusBadge(status: string) {
  if (status === "sent") return <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700" variant="outline">Đã gửi</Badge>
  if (status === "queued") return <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700" variant="outline">Chờ SMTP</Badge>
  if (status === "approved") return <Badge variant="secondary">Đã duyệt</Badge>
  if (status === "failed") return <Badge variant="destructive">Lỗi</Badge>
  if (status === "cancelled") return <Badge variant="outline">Đã hủy</Badge>
  return <Badge variant="outline">Nháp</Badge>
}

export default function HomeroomAnalyticsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = React.useState<ApiUser | null>(null)
  const [classes, setClasses] = React.useState<ApiHomeroomClassSummary[]>([])
  const [selectedClass, setSelectedClass] = React.useState("")
  const [detail, setDetail] = React.useState<ApiHomeroomClassDetail | null>(null)
  const [teachers, setTeachers] = React.useState<ApiTeacher[]>([])
  const [students, setStudents] = React.useState<ApiStudent[]>([])
  const [assignments, setAssignments] = React.useState<ApiHomeroomAssignment[]>([])
  const [teacherId, setTeacherId] = React.useState("")
  const [classCode, setClassCode] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [studentQuery, setStudentQuery] = React.useState("")
  const [riskFilter, setRiskFilter] = React.useState<"all" | "high" | "watch" | "normal">("all")
  const [selectedWeakCourse, setSelectedWeakCourse] = React.useState<number | null>(null)
  const [agentOpen, setAgentOpen] = React.useState(false)
  const [agentLoading, setAgentLoading] = React.useState(false)
  const [agentSummary, setAgentSummary] = React.useState<ApiInterventionScopeSummary | null>(null)
  const [agentError, setAgentError] = React.useState("")
  const [bulkLoading, setBulkLoading] = React.useState(false)
  const [campaignResult, setCampaignResult] = React.useState<ApiInterventionCampaign | null>(null)
  const [mailDraftLoading, setMailDraftLoading] = React.useState(false)
  const [campaign, setCampaign] = React.useState<ApiInterventionCampaign | null>(null)
  const [savingMessageId, setSavingMessageId] = React.useState<number | null>(null)
  const [deliveryStatus, setDeliveryStatus] = React.useState<ApiCampaignDeliveryStatus | null>(null)

  const canManage = currentUser?.role === "superadmin" || currentUser?.role === "admin" || currentUser?.role === "manager"

  const refresh = React.useCallback(async () => {
    setError("")
    const me = await api.me()
    const classList = await api.getHomeroomClasses()
    setCurrentUser(me)
    setClasses(classList)
    setSelectedClass((current) => current && classList.some(item => item.class_code === current)
      ? current
      : classList[0]?.class_code ?? "")
    if (["superadmin", "admin", "manager"].includes(me.role)) {
      const [teacherList, studentList, assignmentList] = await Promise.all([
        api.getTeachers({ limit: 1000 }),
        api.getStudents({ limit: 5000 }),
        api.getHomeroomAssignments(),
      ])
      setTeachers(teacherList)
      setStudents(studentList)
      setAssignments(assignmentList)
    }
  }, [])

  React.useEffect(() => {
    refresh()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được dữ liệu lớp chủ nhiệm."))
      .finally(() => setLoading(false))
    api.getInterventionCampaignDeliveryStatus()
      .then(setDeliveryStatus)
      .catch(() => setDeliveryStatus(null))
  }, [refresh])

  React.useEffect(() => {
    if (!selectedClass) {
      setDetail(null)
      return
    }
    api.getHomeroomClass(selectedClass).then(setDetail).catch((err: unknown) => {
      setDetail(null)
      setError(err instanceof Error ? err.message : "Không tải được lớp chủ nhiệm.")
    })
  }, [selectedClass])

  React.useEffect(() => {
    setAgentOpen(false)
    setAgentSummary(null)
    setAgentError("")
    setCampaign(null)
    setCampaignResult(null)
  }, [selectedClass])

  const availableClassCodes = React.useMemo(
    () => [...new Set(students.map(student => student.class_code).filter((value): value is string => Boolean(value)))].sort(),
    [students],
  )

  const gpaDistribution = React.useMemo(() => {
    const rows = detail?.students ?? []
    return [
      { label: "< 2.0", count: rows.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative < 2).length, color: "#ef4444" },
      { label: "2.0–2.49", count: rows.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 2 && item.gpa_cumulative < 2.5).length, color: "#f97316" },
      { label: "2.5–3.19", count: rows.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 2.5 && item.gpa_cumulative < 3.2).length, color: "#f59e0b" },
      { label: "3.2–3.59", count: rows.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 3.2 && item.gpa_cumulative < 3.6).length, color: "#22c55e" },
      { label: "≥ 3.6", count: rows.filter(item => item.gpa_cumulative !== null && item.gpa_cumulative >= 3.6).length, color: "#10b981" },
      { label: "Thiếu", count: rows.filter(item => item.gpa_cumulative === null).length, color: "#94a3b8" },
    ]
  }, [detail])

  const filteredStudents = React.useMemo(() => {
    const query = studentQuery.trim().toLocaleLowerCase("vi")
    return (detail?.students ?? []).filter((student) => {
      const matchesRisk = riskFilter === "all" || student.risk_level === riskFilter
      const matchesCourse = selectedWeakCourse === null || student.failed_course_ids.includes(selectedWeakCourse)
      const matchesQuery = !query
        || student.full_name.toLocaleLowerCase("vi").includes(query)
        || student.student_code.toLocaleLowerCase("vi").includes(query)
      return matchesRisk && matchesCourse && matchesQuery
    })
  }, [detail, riskFilter, selectedWeakCourse, studentQuery])

  const riskMatrix = React.useMemo(() => (detail?.students ?? [])
    .filter((student) => student.gpa_cumulative !== null)
    .map((student) => ({
      ...student,
      gpa: student.gpa_cumulative,
      failed: student.failed_courses,
      size: Math.max(80, student.failed_courses * 24),
      fill: student.risk_level === "high" ? "#ef4444" : student.risk_level === "watch" ? "#f59e0b" : "#10b981",
    })), [detail])

  function getClassCampaignStudentIds(summary: ApiInterventionScopeSummary | null) {
    const priorityIds = summary?.priority_students.map((student) => student.student_id) ?? []
    if (priorityIds.length) return priorityIds
    return (detail?.students ?? [])
      .filter((student) => student.risk_level !== "normal")
      .map((student) => student.id)
      .slice(0, 20)
  }

  const openStudent = (studentId: number) => {
    router.push(`/manager/analytics/students/${studentId}`)
  }

  async function runClassAgent() {
    if (!selectedClass) return
    setAgentOpen(true)
    setAgentLoading(true)
    setAgentError("")
    setCampaignResult(null)
    setCampaign(null)
    try {
      const summary = await api.summarizeInterventionScope({ scope_type: "homeroom", class_code: selectedClass })
      setAgentSummary(summary)
    } catch (err) {
      setAgentSummary(null)
      setAgentError(err instanceof Error ? err.message : "Không chạy được Agent hỗ trợ lớp cố vấn.")
    } finally {
      setAgentLoading(false)
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
      setAgentError(err instanceof Error ? err.message : "Không gửi được email campaign hỗ trợ học tập.")
    } finally {
      setBulkLoading(false)
    }
  }

  async function buildBulkEmails(summaryOverride: ApiInterventionScopeSummary | null = agentSummary) {
    if (!selectedClass) return
    let summary = summaryOverride
    setMailDraftLoading(true)
    setAgentError("")
    setCampaignResult(null)
    try {
      setAgentOpen(true)
      if (!summary) {
        summary = await api.summarizeInterventionScope({ scope_type: "homeroom", class_code: selectedClass })
        setAgentSummary(summary)
      }
      const studentIds = getClassCampaignStudentIds(summary)
      const created = await api.createInterventionCampaign({
        scope_type: "homeroom",
        class_code: selectedClass,
        student_ids: studentIds.length ? studentIds : null,
        title: `Campaign hỗ trợ học tập - ${selectedClass}`,
        objective: "advisor_checkin",
        max_students: 20,
      })
      const result = await api.generateInterventionCampaignDrafts(created.id, {
        student_ids: studentIds.length ? studentIds : null,
        channel: "email",
        subject: `Hỗ trợ học tập lớp ${selectedClass}`,
        max_students: 20,
      })
      setCampaign(result)
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Không tạo được email nháp cho campaign.")
    } finally {
      setMailDraftLoading(false)
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

  async function assignClass() {
    if (!teacherId || !classCode) return
    setError("")
    try {
      await api.createHomeroomAssignment({ teacher_id: Number(teacherId), class_code: classCode })
      setTeacherId("")
      setClassCode("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không phân công được lớp chủ nhiệm.")
    }
  }

  async function removeAssignment(id: number) {
    await api.deleteHomeroomAssignment(id)
    await refresh()
  }

  if (loading) return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Đang tải lớp chủ nhiệm...</div>

  if (currentUser?.role !== "lecturer") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="font-semibold">Trang dành cho giảng viên được giao chủ nhiệm</p>
            <p className="mt-1 text-sm text-muted-foreground">Quản trị viên thực hiện phân công tại trang Giảng viên.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quan sát lớp chủ nhiệm</h1>
        <p className="text-sm text-muted-foreground">
          Theo dõi lớp hành chính được phân công, phát hiện sinh viên cần cố vấn và ưu tiên hành động.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

      {canManage ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Phân công lớp chủ nhiệm</CardTitle>
            <p className="text-xs text-muted-foreground">Quan hệ này độc lập với giảng viên dạy lớp học phần.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1">
                <Label>Giảng viên/cố vấn</Label>
                <Select value={teacherId} onValueChange={(value) => setTeacherId(value ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Chọn giảng viên" /></SelectTrigger>
                  <SelectContent>{teachers.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Lớp hành chính</Label>
                <Select value={classCode} onValueChange={(value) => setClassCode(value ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Chọn lớp" /></SelectTrigger>
                  <SelectContent>{availableClassCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={assignClass} disabled={!teacherId || !classCode}>Giao chủ nhiệm</Button>
            </div>
            {assignments.length ? (
              <div className="flex flex-wrap gap-2">
                {assignments.map(item => {
                  const teacher = teachers.find(entry => entry.id === item.teacher_id)
                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
                      <span className="font-medium">{item.class_code}</span>
                      <span className="text-muted-foreground">{teacher?.full_name ?? `GV #${item.teacher_id}`}</span>
                      <Button variant="ghost" size="icon-xs" onClick={() => removeAssignment(item.id)} aria-label="Gỡ phân công"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-semibold">Chưa được phân công lớp chủ nhiệm</p>
              <p className="mt-1 text-sm text-muted-foreground">Quản lý cần giao lớp hành chính cho hồ sơ giảng viên trước khi dashboard có dữ liệu.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[280px_1fr] md:items-center">
            <Select value={selectedClass} onValueChange={(value) => { setSelectedClass(value ?? ""); setSelectedWeakCourse(null) }}>
              <SelectTrigger><SelectValue placeholder="Chọn lớp chủ nhiệm" /></SelectTrigger>
              <SelectContent>{classes.map(item => <SelectItem key={item.assignment_id} value={item.class_code}>{item.class_code}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              {classes.map(item => (
                <Button key={item.assignment_id} size="sm" variant={selectedClass === item.class_code ? "default" : "outline"} onClick={() => { setSelectedClass(item.class_code); setSelectedWeakCourse(null) }}>
                  {item.class_code} · {item.student_count} SV
                </Button>
              ))}
            </div>
          </div>

          {detail ? (
            <>
              <Card className="border-primary/20">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Campaign can thiệp học tập cho lớp {detail.class_code}</p>
                    <p className="text-sm text-muted-foreground">Xác định nhóm cần hỗ trợ, tạo email cá nhân hóa, rồi giảng viên duyệt gửi cho sinh viên.</p>
                    {deliveryStatus ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge className={deliveryStatus.configured ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-amber-500/40 bg-amber-500/10 text-amber-700"} variant="outline">
                          {deliveryStatus.configured ? "SMTP Brevo sẵn sàng" : "Chưa cấu hình SMTP"}
                        </Badge>
                        <span className="text-muted-foreground">
                          {deliveryStatus.configured
                            ? `Gửi từ ${deliveryStatus.from_email} qua ${deliveryStatus.smtp_host}:${deliveryStatus.smtp_port}`
                            : `Thiếu: ${deliveryStatus.missing.join(", ") || "cấu hình mail"}`}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={runClassAgent} disabled={agentLoading}>
                      <Sparkles className="mr-2 h-4 w-4" />{agentLoading ? "Đang phân tích..." : "Phân tích can thiệp"}
                    </Button>
                    <Button onClick={() => void buildBulkEmails()} disabled={mailDraftLoading}>
                      <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : "Tạo nháp email"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {(agentOpen || agentSummary || campaign || agentLoading || mailDraftLoading || agentError || campaignResult) ? (
                <section className="grid gap-4 rounded-lg border bg-muted/10 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">Không gian can thiệp lớp {detail.class_code}</h2>
                        {campaign ? <Badge variant="secondary">Campaign #{campaign.id}</Badge> : null}
                        {campaign ? <Badge variant={campaign.messages.some((message) => message.status === "failed") ? "destructive" : "outline"}>{campaign.messages.filter((message) => !["failed", "queued"].includes(message.status)).length}/{campaign.messages.length} email sẵn sàng gửi</Badge> : null}
                        {deliveryStatus?.configured ? <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700" variant="outline">SMTP sẵn sàng</Badge> : <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700" variant="outline">Chưa có SMTP</Badge>}
                        {campaign?.messages.some((message) => message.status === "sent") ? <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700" variant="outline">{campaign.messages.filter((message) => message.status === "sent").length} đã gửi</Badge> : null}
                        {campaign?.messages.some((message) => message.status === "queued") ? <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700" variant="outline">{campaign.messages.filter((message) => message.status === "queued").length} chờ SMTP</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Quy trình: Agent gợi ý nhóm ưu tiên, hệ thống tạo email nháp, giảng viên chỉnh sửa rồi gửi email. Mỗi lần gửi đều lưu vào lịch sử hỗ trợ.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(agentSummary || campaign || agentError || campaignResult) ? (
                        <Button variant="outline" size="sm" onClick={() => setAgentOpen((current) => !current)}>
                          {agentOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                          {agentOpen ? "Thu gọn" : "Mở chi tiết"}
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={runClassAgent} disabled={agentLoading}>
                        <Sparkles className="mr-2 h-4 w-4" />{agentLoading ? "Đang phân tích..." : "Chạy lại phân tích"}
                      </Button>
                      <Button size="sm" onClick={() => void buildBulkEmails()} disabled={mailDraftLoading}>
                        <Mail className="mr-2 h-4 w-4" />{mailDraftLoading ? "Đang tạo..." : campaign ? "Tạo lại email nháp" : "Tạo email nháp"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={createBulkNotifications}
                        disabled={bulkLoading || !campaign || campaign.messages.length === 0 || campaign.messages.every((message) => message.status === "failed")}
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" />{bulkLoading ? "Đang gửi..." : "Gửi email"}
                      </Button>
                    </div>
                  </div>

                  {!agentOpen && (agentSummary || campaign || campaignResult || agentError) ? (
                    <button
                      type="button"
                      className="grid gap-3 rounded-md border bg-background p-4 text-left transition-colors hover:bg-primary/5 md:grid-cols-[1fr_auto]"
                      onClick={() => setAgentOpen(true)}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {agentSummary ? <Badge variant="outline">{agentSummary.summary.high} ưu tiên</Badge> : null}
                        {agentSummary ? <Badge variant="outline">{agentSummary.summary.watch} theo dõi</Badge> : null}
                        {campaign ? <Badge variant="secondary">{campaign.messages.length} email nháp</Badge> : null}
                        {campaignResult?.delivery_mode === "smtp" ? <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700" variant="outline">Đã gửi email</Badge> : null}
                        {campaignResult?.delivery_mode === "smtp_not_configured" ? <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700" variant="outline">Chưa cấu hình SMTP</Badge> : null}
                        {agentError ? <Badge variant="destructive">Có lỗi cần xem</Badge> : null}
                      </div>
                      <span className="flex items-center justify-end text-sm font-medium text-primary">
                        Mở workspace <ChevronDown className="ml-2 h-4 w-4" />
                      </span>
                    </button>
                  ) : null}

                  {agentOpen ? (
                    <>
                  {agentLoading ? (
                    <div className="rounded-md border bg-background p-6 text-center text-sm text-muted-foreground">Agent đang tổng hợp cảnh báo, lịch sử liên hệ và nguyên nhân học tập...</div>
                  ) : null}

                  {agentError ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{agentError}</div>
                  ) : null}

                  {campaignResult ? (
                    <div className={`rounded-md border p-3 text-sm ${campaignResult.delivery_mode === "smtp" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}`}>
                      <p className="font-medium">{campaignResult.message ?? "Đã xử lý campaign hỗ trợ học tập."}</p>
                      <p className="mt-1">
                        Đã lưu {campaignResult.created_contact_count ?? 0} liên hệ vào hồ sơ sinh viên
                        {campaignResult.sent_count !== undefined ? ` · ${campaignResult.sent_count} email đã gửi` : ""}
                        {campaignResult.queued_count ? ` · ${campaignResult.queued_count} email chờ cấu hình SMTP` : ""}
                        {campaignResult.failed_count ? ` · ${campaignResult.failed_count} lỗi` : ""}.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                    <div className="space-y-4">
                      <div className="rounded-md border bg-background p-4">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Mức ưu tiên</p>
                        {agentSummary ? (
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            {[
                              ["Tổng SV", agentSummary.summary.total],
                              ["Ưu tiên", agentSummary.summary.high],
                              ["Theo dõi", agentSummary.summary.watch],
                              ["Đã liên hệ", agentSummary.summary.contacted],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-md bg-muted/40 p-3">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">Bấm “Phân tích can thiệp” để Agent gom nhóm sinh viên cần hỗ trợ.</p>
                        )}
                      </div>

                      <div className="rounded-md border bg-background p-4">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Sinh viên ưu tiên</p>
                        {agentSummary?.priority_students.length ? (
                          <div className="mt-3 space-y-2">
                            {agentSummary.priority_students.slice(0, 6).map((student) => (
                              <button
                                key={student.student_id}
                                type="button"
                                className="w-full rounded-md border p-3 text-left transition-colors hover:bg-primary/5"
                                onClick={() => openStudent(student.student_id)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium">{student.full_name}</p>
                                    <p className="font-mono text-[11px] text-muted-foreground">{student.student_code}</p>
                                  </div>
                                  <Badge variant={student.risk_level === "high" ? "destructive" : "outline"}>{student.risk_score}</Badge>
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{student.reasons.join("; ") || "Theo dõi định kỳ"}</p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">Chưa có danh sách ưu tiên. Nếu tạo email ngay, backend sẽ tự chọn nhóm high/watch theo rule hiện có.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {agentSummary ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-md border bg-background p-4">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Nhóm nguyên nhân</p>
                            <div className="mt-3 space-y-2">
                              {Object.entries(agentSummary.reason_groups).length ? Object.entries(agentSummary.reason_groups).map(([reason, count]) => (
                                <div key={reason} className="flex items-center justify-between gap-3 text-sm">
                                  <span>{reason}</span>
                                  <Badge variant="secondary">{count}</Badge>
                                </div>
                              )) : <p className="text-sm text-muted-foreground">Không có nhóm cảnh báo nổi bật.</p>}
                            </div>
                          </div>
                          <div className="rounded-md border bg-background p-4">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Kế hoạch đề xuất</p>
                            <ol className="mt-3 space-y-2 text-sm">
                              {agentSummary.recommendations.map((item, index) => (
                                <li key={item} className="flex gap-2">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{index + 1}</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      ) : null}

                      {campaign ? (
                        <div className="rounded-md border bg-background">
                          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium">{campaign.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {campaign.messages.length} email nháp · {campaign.messages.filter((message) => message.status === "failed").length} cần bổ sung dữ liệu
                              </p>
                            </div>
                          </div>
                          {campaign.messages.length ? (
                            <div className="max-h-[620px] divide-y overflow-auto">
                              {campaign.messages.map((draft) => {
                                const reasons = Array.isArray(draft.metadata_json.reasons) ? draft.metadata_json.reasons.map(String) : []
                                const actions = Array.isArray(draft.metadata_json.recommended_actions) ? draft.metadata_json.recommended_actions.map(String) : []
                                return (
                                  <div key={draft.id} className="grid gap-3 p-4 text-sm 2xl:grid-cols-[280px_minmax(0,1fr)]">
                                    <div className="space-y-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="font-medium">{draft.full_name ?? "Sinh viên"}</p>
                                          <p className="font-mono text-[11px] text-muted-foreground">{draft.student_code}</p>
                                          <p className="mt-1 text-xs text-muted-foreground">To: {draft.recipient_email ?? "Thiếu email"}</p>
                                        </div>
                                        {messageStatusBadge(draft.status)}
                                      </div>
                                      <div className="space-y-2 rounded-md bg-muted/30 p-3 text-xs">
                                        <p className="font-semibold text-foreground">Vấn đề cần hỗ trợ</p>
                                        {reasons.length ? reasons.slice(0, 4).map((reason) => <p key={reason}>- {reason}</p>) : <p className="text-muted-foreground">Check-in định kỳ, chưa có cảnh báo cụ thể.</p>}
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
                                      {draft.status === "queued" ? <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">Email này đã được duyệt và lưu lịch sử, nhưng chưa gửi thật vì hệ thống chưa cấu hình SMTP.</p> : null}
                                      {draft.status === "sent" ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700">Email đã gửi tới sinh viên{draft.sent_at ? ` lúc ${new Date(draft.sent_at).toLocaleString("vi-VN")}` : ""}.</p> : null}
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
                                        className="min-h-36 w-full resize-y rounded-md border bg-background px-3 py-2 text-xs leading-relaxed"
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
                          ) : (
                            <div className="p-6 text-sm text-muted-foreground">
                              Chưa tạo được email nháp cho lớp này. Hệ thống không tìm thấy sinh viên thuộc nhóm high/watch hoặc dữ liệu cảnh báo chưa đủ.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                    </>
                  ) : null}
                </section>
              ) : null}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {[
                  { label: "Sinh viên", value: detail.student_count, icon: Users },
                  { label: "Đang học", value: detail.active_students, icon: CheckCircle2 },
                  { label: "GPA trung bình", value: detail.avg_gpa?.toFixed(2) ?? "—", icon: GraduationCap },
                  { label: "Tỷ lệ đạt kỳ gần nhất", value: detail.trend.length ? `${detail.trend.at(-1)?.pass_rate.toFixed(1)}%` : "—", icon: UserRound },
                  { label: "Cần ưu tiên", value: detail.risk_counts.high, icon: AlertTriangle },
                ].map(item => (
                  <Card key={item.label}><CardContent className="flex items-start justify-between pt-5"><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold">{item.value}</p></div><item.icon className="h-5 w-5 text-primary" /></CardContent></Card>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Xu hướng GPA lớp theo học kỳ</CardTitle>
                    <p className="text-xs text-muted-foreground">GPA hệ 4, tính theo tín chỉ; đường đỏ là ngưỡng cảnh báo 2.0.</p>
                  </CardHeader>
                  <CardContent>
                    {detail.trend.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={detail.trend} margin={{ left: 0, right: 12, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 10 }} width={28} />
                          <Tooltip formatter={(value) => [Number(value).toFixed(2), "GPA TB lớp"]} />
                          <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="5 4" />
                          <Line type="monotone" dataKey="avg_gpa" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <p className="py-24 text-center text-sm text-muted-foreground">Chưa có dữ liệu xu hướng.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Tỷ lệ đạt của lớp theo học kỳ</CardTitle>
                    <p className="text-xs text-muted-foreground">Cột dưới 75% được đánh dấu để ưu tiên rà soát.</p>
                  </CardHeader>
                  <CardContent>
                    {detail.trend.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={detail.trend} margin={{ left: 0, right: 8, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} width={38} />
                          <Tooltip formatter={(value, _name, item) => [`${Number(value).toFixed(1)}%`, `${item.payload.failed_enrollments} lượt chưa đạt`]} />
                          <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="5 4" />
                          <Bar dataKey="pass_rate" radius={[5, 5, 0, 0]} maxBarSize={60}>
                            {detail.trend.map((row) => <Cell key={row.id} fill={row.pass_rate >= 75 ? "#10b981" : "#ef4444"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="py-24 text-center text-sm text-muted-foreground">Chưa có dữ liệu tỷ lệ đạt.</p>}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Ma trận ưu tiên cố vấn</CardTitle>
                    <p className="text-xs text-muted-foreground">Trục ngang là GPA tích lũy; trục dọc là số học phần chưa đạt. Bấm một điểm để mở hồ sơ.</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <ScatterChart margin={{ left: 0, right: 16, top: 10, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="gpa" name="GPA" domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 10 }} />
                        <YAxis type="number" dataKey="failed" name="Môn chưa đạt" allowDecimals={false} tick={{ fontSize: 10 }} width={34} />
                        <ZAxis type="number" dataKey="size" range={[80, 260]} />
                        <ReferenceLine x={2} stroke="#ef4444" strokeDasharray="5 4" />
                        <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="5 4" />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const row = payload[0].payload
                            return <div className="rounded-md border bg-background p-3 text-xs shadow-md"><p className="font-semibold">{row.full_name}</p><p>GPA: {row.gpa?.toFixed(2)}</p><p>Chưa đạt: {row.failed} học phần</p><p>Kỳ gần nhất: {row.latest_gpa?.toFixed(2) ?? "—"}</p></div>
                          }}
                        />
                        <Scatter data={riskMatrix}>
                          {riskMatrix.map((student) => <Cell key={student.id} fill={student.fill} onClick={() => openStudent(student.id)} className="cursor-pointer" />)}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Học phần yếu của lớp</CardTitle>
                    <p className="text-xs text-muted-foreground">Bấm cột để lọc danh sách sinh viên chưa đạt học phần đó.</p>
                  </CardHeader>
                  <CardContent>
                    {detail.weak_courses.length ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={detail.weak_courses.slice(0, 7)} layout="vertical" margin={{ left: 0, right: 24, top: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value, _name, item) => [`${Number(value).toFixed(1)}%`, `${item.payload.failed}/${item.payload.attempts} lượt chưa đạt`]} />
                          <Bar dataKey="fail_rate" radius={[0, 5, 5, 0]}>
                            {detail.weak_courses.slice(0, 7).map((course) => (
                              <Cell key={course.id} fill={selectedWeakCourse === course.id ? "#7c3aed" : course.fail_rate >= 30 ? "#ef4444" : "#f59e0b"} onClick={() => setSelectedWeakCourse((current) => current === course.id ? null : course.id)} className="cursor-pointer" />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="py-24 text-center text-sm text-muted-foreground">Chưa có môn đủ quy mô mẫu.</p>}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Phân bố GPA tích lũy</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={gpaDistribution} margin={{ left: 0, right: 8, top: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value) => [value, "Sinh viên"]} />
                        <Bar dataKey="count" radius={[5, 5, 0, 0]}>{gpaDistribution.map(item => <Cell key={item.label} fill={item.color} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="space-y-3">
                    <div>
                      <CardTitle className="text-sm">Danh sách sinh viên lớp {detail.class_code}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">Bấm vào sinh viên để mở hồ sơ phân tích học tập chi tiết.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative max-w-sm flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Tìm theo tên hoặc mã sinh viên" className="h-9 pl-9" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {([[
                          "all", "Tất cả",
                        ], [
                          "high", "Ưu tiên",
                        ], [
                          "watch", "Theo dõi",
                        ], [
                          "normal", "Ổn định",
                        ]] as const).map(([value, label]) => (
                          <Button key={value} type="button" size="sm" variant={riskFilter === value ? "default" : "outline"} onClick={() => setRiskFilter(value)}>{label}</Button>
                        ))}
                      </div>
                    </div>
                    {selectedWeakCourse !== null ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary">Đang lọc: chưa đạt {detail.weak_courses.find((course) => course.id === selectedWeakCourse)?.name}</Badge>
                        <Button size="xs" variant="ghost" onClick={() => setSelectedWeakCourse(null)}>Bỏ lọc</Button>
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[430px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-background"><tr className="border-b bg-muted/40"><th className="px-4 py-2.5 text-left">Mức độ</th><th className="px-3 py-2.5 text-left">Sinh viên</th><th className="px-3 py-2.5 text-left">Ngành</th><th className="px-3 py-2.5 text-right">GPA</th><th className="px-3 py-2.5 text-right">Môn trượt</th><th className="px-4 py-2.5 text-left">Khuyến nghị</th><th className="w-10 px-3 py-2.5"><span className="sr-only">Mở</span></th></tr></thead>
                        <tbody className="divide-y">
                          {filteredStudents.map(student => (
                            <tr
                              key={student.id}
                              role="link"
                              tabIndex={0}
                              onClick={() => openStudent(student.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") openStudent(student.id)
                              }}
                              className="group cursor-pointer outline-none transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            >
                              <td className="px-4 py-2">{riskBadge(student.risk_level)}</td>
                              <td className="px-3 py-2"><p className="font-medium group-hover:text-primary">{student.full_name}</p><p className="font-mono text-[10px] text-muted-foreground">{student.student_code}</p></td>
                              <td className="px-3 py-2 text-muted-foreground">{student.program_name}</td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">{student.gpa_cumulative?.toFixed(2) ?? "—"}</td>
                              <td className={`px-3 py-2 text-right tabular-nums ${student.failed_courses ? "font-semibold text-destructive" : ""}`}>{student.failed_courses}</td>
                              <td className="px-4 py-2 text-muted-foreground">{student.risk_level === "high" ? "Hẹn trao đổi và lập kế hoạch học tập" : student.risk_level === "watch" ? "Kiểm tra nguyên nhân, theo dõi kỳ tới" : "Theo dõi định kỳ"}</td>
                              <td className="px-3 py-2"><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredStudents.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Không có sinh viên phù hợp bộ lọc.</p> : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </>
      )}

    </div>
  )
}
