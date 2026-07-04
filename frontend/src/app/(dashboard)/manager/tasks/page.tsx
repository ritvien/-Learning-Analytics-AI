"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Bot, CalendarDays, CheckCircle2, Clock, ExternalLink, ListTodo, RefreshCw, Send, UserPlus, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { queueDashboardAgentPrompt, requestDashboardAgent, setDashboardAgentContext } from "@/lib/dashboard-agent-context"
import { api, getCachedCurrentUser, type ApiAdvisorCase, type ApiInterventionCampaign, type ApiInterventionMessage, type ApiImprovementOutcome, type ApiOpsAlert, type ApiOpsTask, type ApiUser } from "@/lib/api"
import { getPageDataCache, setPageDataCache } from "@/lib/page-data-cache"
import { canAssignTasks, canGenerateAlerts, canHandleTask, hasAlertData, taskTabsForRole, type TaskTabKey } from "@/lib/task-policy"

const TAB_LABELS: Record<TaskTabKey, string> = {
  mine: "Của tôi",
  alerts: "Cảnh báo mới",
  active: "Đang xử lý",
  overdue: "Quá hạn",
  closed: "Đã đóng",
  all: "Tất cả",
}

function statusLabel(status: string) {
  return {
    open: "Mới",
    assigned: "Đã giao",
    in_progress: "Đang xử lý",
    waiting_followup: "Chờ follow-up",
    resolved: "Đã xử lý",
    closed: "Đã đóng",
    cancelled: "Đã hủy",
  }[status] ?? status
}

function priorityLabel(priority: string) {
  return {
    urgent: "Khẩn cấp",
    critical: "Khẩn cấp",
    high: "Cao",
    medium: "Trung bình",
    low: "Thấp",
  }[priority] ?? priority
}

function scopeLabel(scope: string) {
  return {
    student: "Sinh viên",
    section: "Lớp",
    homeroom: "Lớp cố vấn",
    course: "Môn",
    program: "Ngành",
    department: "Khoa",
    data_quality: "Dữ liệu",
    system: "Hệ thống",
  }[scope] ?? scope
}

function taskHref(task: ApiOpsTask) {
  const id = task.scope_id
  if (!id) return null
  if (task.task_type === "student_support" && typeof task.metadata_json.student_id === "number") {
    return `/manager/analytics/students/${task.metadata_json.student_id}`
  }
  if (task.scope_type === "student") return `/manager/analytics/students/${id}`
  if (task.scope_type === "section") return `/manager/analytics/sections/${id}`
  if (task.scope_type === "course") {
    const alert = task.metadata_json?.alert as Record<string, unknown> | undefined
    const semesterCode =
      alert?.bottleneck_window === "current" && typeof alert.semester_code === "string"
        ? alert.semester_code
        : "all"
    return `/manager/analytics/courses?course_id=${id}&semester_code=${encodeURIComponent(semesterCode)}&source=tasks`
  }
  if (task.scope_type === "program") return `/manager/analytics/programs?program_id=${id}&source=tasks`
  return null
}

function bottleneckBadge(task: ApiOpsTask) {
  const alert = task.metadata_json?.alert as Record<string, unknown> | undefined
  if (alert?.bottleneck_window === "current") return "Hiện tại"
  if (alert?.bottleneck_window === "historical") return "Lịch sử"
  return null
}

function contextButtonLabel(task: ApiOpsTask) {
  if (task.task_type === "student_support") return "Phân tích chi tiết sinh viên"
  if (task.task_type === "review_course" || task.scope_type === "course") return "Mở điểm nghẽn"
  if (task.task_type === "review_section" || task.scope_type === "section") return "Mở lớp học phần"
  if (task.task_type === "contact_student" || task.scope_type === "student") return "Mở hồ sơ SV"
  if (task.scope_type === "program") return "Mở CTĐT"
  return "Mở ngữ cảnh"
}

function taskAgentPrompt(task: ApiOpsTask) {
  const evidence = task.metadata_json?.alert ?? task.metadata_json
  const evidenceText = JSON.stringify(evidence, null, 2)
  return [
    `Giải thích việc cần xử lý này cho tôi theo vai trò hiện tại: ${task.title}.`,
    `Loại việc: ${task.task_type}. Phạm vi: ${task.scope_type} #${task.scope_id ?? "N/A"}.`,
    "Hãy chỉ ra vì sao đây là điểm nghẽn/rủi ro, các chỉ số chính, mức độ ưu tiên, nguyên nhân có thể kiểm chứng và 3 hành động tiếp theo.",
    `Evidence:\n${evidenceText}`,
  ].join("\n\n")
}

function setTaskAgentContext(task: ApiOpsTask, route: string) {
  setDashboardAgentContext({
    source: "ops_task_detail",
    route,
    dashboard_type: "ops_work_queue",
    scope: {
      task_id: task.id,
      task_type: task.task_type,
      scope_type: task.scope_type,
      scope_id: task.scope_id,
      priority: task.priority,
      status: task.status,
    },
    selected_entities: {
      task_title: task.title,
      source_alert_id: task.source_alert_id,
    },
    visible_metrics: task.metadata_json,
    alerts: [task.description].filter(Boolean) as string[],
  })
}

function TaskRow({ task, selected, onSelect }: { task: ApiOpsTask; selected: boolean; onSelect: () => void }) {
  const riskLevel = String(task.metadata_json.risk_level ?? "")
  const dangerous = task.priority === "urgent" || task.priority === "critical" || task.priority === "high" || riskLevel === "high"
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition ${dangerous ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10" : "hover:bg-muted/40"} ${selected ? "ring-2 ring-primary/30" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 font-medium ${dangerous ? "text-red-700" : ""}`}>{dangerous ? <AlertTriangle className="size-4 shrink-0" /> : null}{task.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {scopeLabel(task.scope_type)} {task.scope_id ? `#${task.scope_id}` : ""} · {task.task_type}
          </div>
        </div>
        <div className="flex gap-1">
          <Badge variant={dangerous ? "destructive" : "outline"}>
            {priorityLabel(task.priority)}
          </Badge>
          <Badge variant="outline">{statusLabel(task.status)}</Badge>
          {bottleneckBadge(task) ? <Badge variant="secondary">{bottleneckBadge(task)}</Badge> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Hạn: {task.due_at ? new Date(task.due_at).toLocaleDateString("vi-VN") : "Chưa đặt"}</span>
        <span>Follow-up: {task.follow_up_at ? new Date(task.follow_up_at).toLocaleDateString("vi-VN") : "Chưa đặt"}</span>
        <span>Assignee: {task.assignee_role ?? task.assignee_user_id ?? "Chưa giao"}</span>
      </div>
    </button>
  )
}

function AlertRow({ alert, onConvert }: { alert: ApiOpsAlert; onConvert: (alert: ApiOpsAlert) => void }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{alert.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
          <div className="mt-2 text-xs text-muted-foreground">{scopeLabel(alert.scope_type)} {alert.scope_id ? `#${alert.scope_id}` : ""} · {alert.source}</div>
        </div>
        <Badge variant={alert.severity === "critical" || alert.severity === "high" ? "destructive" : "outline"}>{priorityLabel(alert.severity)}</Badge>
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={() => onConvert(alert)}>
          <ListTodo className="size-3.5" />
          Tạo việc
        </Button>
      </div>
    </div>
  )
}

function TaskDetail({
  task,
  user,
  onClose,
  onReload,
}: {
  task: ApiOpsTask | null
  user: ApiUser | null
  onClose: () => void
  onReload: () => void
}) {
  const router = useRouter()
  const [comment, setComment] = React.useState("")
  const [resolution, setResolution] = React.useState("")
  const [followUp, setFollowUp] = React.useState("")
  const [assignee, setAssignee] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const canHandle = canHandleTask(user?.role, task, user?.id)
  const href = task ? taskHref(task) : null

  function explainTask() {
    if (!task) return
    if (!href) {
      setTaskAgentContext(task, "/manager/tasks")
      requestDashboardAgent(taskAgentPrompt(task))
      return
    }

    const destinationRoute = new URL(href, window.location.origin).pathname
    setTaskAgentContext(task, destinationRoute)
    queueDashboardAgentPrompt(taskAgentPrompt(task), destinationRoute)
    router.push(href)
  }

  React.useEffect(() => {
    setComment("")
    setResolution("")
    setFollowUp("")
    setAssignee("")
  }, [task?.id])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      onReload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!task} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {task ? (
          <>
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription>{scopeLabel(task.scope_type)} {task.scope_id ? `#${task.scope_id}` : ""}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant={task.priority === "high" || task.priority === "critical" || task.priority === "urgent" ? "destructive" : "outline"}>{priorityLabel(task.priority)}</Badge>
                <Badge variant="outline">{statusLabel(task.status)}</Badge>
                <Badge variant="secondary">{task.task_type}</Badge>
                {bottleneckBadge(task) ? <Badge variant="secondary">{bottleneckBadge(task)}</Badge> : null}
              </div>
              {task.description ? <p className="text-sm text-muted-foreground">{task.description}</p> : null}
              <div className="grid gap-2 rounded-lg border p-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Người phụ trách</span><span>{task.assignee_role ?? task.assignee_user_id ?? "Chưa giao"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Hạn</span><span>{task.due_at ? new Date(task.due_at).toLocaleString("vi-VN") : "Chưa đặt"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Follow-up</span><span>{task.follow_up_at ? new Date(task.follow_up_at).toLocaleString("vi-VN") : "Chưa đặt"}</span></div>
              </div>
              {href ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={explainTask}>
                    <ExternalLink className="size-4" />
                    {contextButtonLabel(task)}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={explainTask}>
                  <Bot className="size-4" />
                  Hỏi agent giải thích
                </Button>
              )}
              <div>
                <div className="mb-2 text-sm font-medium">Bằng chứng</div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(task.metadata_json, null, 2)}</pre>
              </div>
              {canAssignTasks(user?.role) ? (
                <div className="rounded-lg border p-3">
                  <Label htmlFor="assignee">Giao cho user id</Label>
                  <div className="mt-2 flex gap-2">
                    <Input id="assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="teacher-user-id" />
                    <Button disabled={!assignee || busy} onClick={() => run(() => api.assignTask(task.id, { assignee_user_id: assignee }))}>
                      <UserPlus className="size-4" />
                      Giao
                    </Button>
                  </div>
                </div>
              ) : null}
              {canHandle ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <div>
                    <Label htmlFor="followup">Follow-up</Label>
                    <div className="mt-2 flex gap-2">
                      <Input id="followup" type="datetime-local" value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
                      <Button variant="outline" disabled={!followUp || busy} onClick={() => run(() => api.setTaskFollowUp(task.id, { follow_up_at: new Date(followUp).toISOString() }))}>
                        <Clock className="size-4" />
                        Đặt
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="comment">Ghi chú</Label>
                    <Textarea id="comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ghi nhận trao đổi hoặc bước xử lý..." />
                    <Button className="mt-2" variant="outline" disabled={!comment.trim() || busy} onClick={() => run(() => api.addTaskComment(task.id, comment.trim()))}>
                      <Send className="size-4" />
                      Lưu ghi chú
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="resolution">Kết quả xử lý</Label>
                    <Textarea id="resolution" value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Bắt buộc khi đóng việc..." />
                    <Button className="mt-2" disabled={!resolution.trim() || busy} onClick={() => run(() => api.closeTask(task.id, { resolution_note: resolution.trim(), status: "resolved" }))}>
                      <CheckCircle2 className="size-4" />
                      Đóng việc
                    </Button>
                  </div>
                </div>
              ) : null}
              <div>
                <div className="mb-2 text-sm font-medium">Timeline</div>
                <div className="space-y-2">
                  {task.events.length ? task.events.map((event) => (
                    <div key={event.id} className="rounded-md border p-2 text-xs">
                      <div className="font-medium">{event.event_type}</div>
                      <div className="text-muted-foreground">{new Date(event.created_at).toLocaleString("vi-VN")}</div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Chưa có timeline.</p>}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function AdvisorCaseDetail({ item, onClose, onReload }: { item: ApiAdvisorCase | null; onClose: () => void; onReload: () => void }) {
  const router = useRouter()
  const [assessment, setAssessment] = React.useState("")
  const [actionPlan, setActionPlan] = React.useState("")
  const [conclusion, setConclusion] = React.useState<"support_needed" | "monitor" | "no_action">("monitor")
  const [appointmentAt, setAppointmentAt] = React.useState("")
  const [purpose, setPurpose] = React.useState("")
  const [outcome, setOutcome] = React.useState<ApiImprovementOutcome>("needs_follow_up")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setAssessment(item?.advisor_assessment ?? "")
    setActionPlan(item?.advisor_action_plan ?? "")
    setConclusion(item?.advisor_conclusion ?? "monitor")
    setAppointmentAt("")
    setPurpose("")
    setOutcome(item?.improvement_outcome ?? "needs_follow_up")
  }, [item])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try { await action(); onReload() } finally { setBusy(false) }
  }

  const baselineAcademic = (item?.signal_snapshot.academic ?? {}) as Record<string, unknown>
  const followUpAcademic = (item?.follow_up_snapshot.academic ?? {}) as Record<string, unknown>
  const canEdit = item?.permissions.can_update_workflow === true

  return (
    <Sheet open={!!item} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {item ? <>
          <SheetHeader>
            <SheetTitle>{item.student_name ?? `Sinh viên #${item.student_id}`}</SheetTitle>
            <SheetDescription>{scopeLabel(item.scope_type)} · {item.student_code ?? item.student_id}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant={item.priority === "high" || item.priority === "critical" ? "destructive" : "outline"}>{priorityLabel(item.priority)}</Badge>
              <Badge variant="outline">{statusLabel(item.status)}</Badge>
              {item.assessment_confirmed_at ? <Badge variant="secondary">Nhận định đã chốt</Badge> : <Badge variant="outline">Hệ thống đã review · chờ xác nhận</Badge>}
            </div>
            <Button variant="outline" onClick={() => router.push(`/manager/analytics/students/${item.student_id}`)}>
              <ExternalLink className="size-4" />
              Phân tích kỹ hơn
            </Button>
            <div className="rounded-lg border p-3">
              <div className="mb-1 font-medium">Nhận định hệ thống/AI đề xuất</div>
              <p className="mb-3 text-xs text-muted-foreground">Đã tổng hợp từ dữ liệu học tập và ML hiện có. Giảng viên chỉ cần kiểm tra, chỉnh nếu cần và xác nhận.</p>
              <Textarea value={assessment} onChange={(event) => setAssessment(event.target.value)} placeholder="Nhận định dựa trên tín hiệu học tập và trao đổi thực tế..." />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Select value={conclusion} onValueChange={(value) => setConclusion(value as typeof conclusion)}>
                  <SelectTrigger>Kết luận</SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support_needed">Cần hỗ trợ</SelectItem>
                    <SelectItem value="monitor">Tiếp tục theo dõi</SelectItem>
                    <SelectItem value="no_action">Chưa cần hành động</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={actionPlan} onChange={(event) => setActionPlan(event.target.value)} placeholder="Hướng xử lý" />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" disabled={!canEdit || !assessment.trim() || busy} onClick={() => run(() => api.saveAdvisorAssessment(item.id, { assessment: assessment.trim(), conclusion, action_plan: actionPlan || null }))}>Lưu nháp</Button>
                <Button disabled={!canEdit || !assessment.trim() || busy} onClick={() => run(() => api.saveAdvisorAssessment(item.id, { assessment: assessment.trim(), conclusion, action_plan: actionPlan || null, confirm: true }))}>Chốt nhận định</Button>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-3 font-medium">Đặt lịch trao đổi khi cần</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} />
                <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Mục tiêu cuộc trao đổi" />
              </div>
              <Button className="mt-3" variant="outline" disabled={!canEdit || !appointmentAt || !purpose.trim() || busy} onClick={() => run(() => api.createInterventionAppointment(item.id, { scheduled_at: new Date(appointmentAt).toISOString(), purpose: purpose.trim() }))}>
                <CalendarDays className="size-4" /> Đặt lịch
              </Button>
              <div className="mt-3 space-y-2">
                {(item.appointments ?? []).map((appointment) => <div key={appointment.id} className="rounded-md border p-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span>{new Date(appointment.scheduled_at).toLocaleString("vi-VN")} · {appointment.purpose}</span><Badge variant="outline">{appointment.status}</Badge></div>
                  {appointment.result ? <p className="mt-1 text-muted-foreground">{appointment.result}</p> : null}
                  {canEdit && appointment.status === "scheduled" ? <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => run(() => api.updateInterventionAppointment(appointment.id, { status: "no_show" }))}>Vắng mặt</Button>
                    <Button size="sm" variant="outline" onClick={() => run(() => api.updateInterventionAppointment(appointment.id, { status: "cancelled" }))}>Hủy</Button>
                    <Button size="sm" onClick={() => run(() => api.updateInterventionAppointment(appointment.id, { status: "completed", result: "Đã trao đổi; chờ cố vấn cập nhật kết quả follow-up." }))}>Hoàn thành</Button>
                  </div> : null}
                </div>)}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-3 font-medium">Đánh giá sau can thiệp</div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-md bg-muted p-2"><div className="text-xs text-muted-foreground">GPA trước → sau</div><div>{String(baselineAcademic.gpa_cumulative ?? "—")} → {String(followUpAcademic.gpa_cumulative ?? "—")}</div></div>
                <div className="rounded-md bg-muted p-2"><div className="text-xs text-muted-foreground">Môn trượt</div><div>{String(baselineAcademic.fail_count ?? "—")} → {String(followUpAcademic.fail_count ?? "—")}</div></div>
                <div className="rounded-md bg-muted p-2"><div className="text-xs text-muted-foreground">Mức rủi ro</div><div>{String(item.signal_snapshot.risk_level ?? "—")} → {String(item.follow_up_snapshot.risk_level ?? "—")}</div></div>
              </div>
              <Select value={outcome} onValueChange={(value) => setOutcome(value as ApiImprovementOutcome)}>
                <SelectTrigger>Kết quả</SelectTrigger>
                <SelectContent>
                  <SelectItem value="improved">Đã cải thiện</SelectItem>
                  <SelectItem value="unchanged">Chưa thay đổi</SelectItem>
                  <SelectItem value="worsened">Diễn biến xấu hơn</SelectItem>
                  <SelectItem value="needs_follow_up">Cần tiếp tục theo dõi</SelectItem>
                </SelectContent>
              </Select>
              <Button className="mt-3" disabled={!canEdit || !item.assessment_confirmed_at || busy} onClick={() => run(() => api.recordAdvisorFollowUp(item.id, { outcome }))}>Chụp tín hiệu hiện tại và lưu kết quả</Button>
            </div>
          </div>
        </> : null}
      </SheetContent>
    </Sheet>
  )
}

type AdvisorCaseGroup = {
  key: string
  scopeType: "section" | "homeroom"
  scopeId: number | null
  classCode: string | null
  title: string
  cases: ApiAdvisorCase[]
  highCount: number
  unconfirmedCount: number
  scheduledCount: number
  overdueCount: number
}

function advisorGroupKey(item: ApiAdvisorCase) {
  return `${item.scope_type}:${item.section_id ?? item.class_code ?? "unknown"}`
}

function buildAdvisorGroups(cases: ApiAdvisorCase[]): AdvisorCaseGroup[] {
  const map = new Map<string, AdvisorCaseGroup>()
  for (const item of cases) {
    const key = advisorGroupKey(item)
    const title =
      item.scope_type === "homeroom"
        ? `Lớp cố vấn ${item.class_code ?? item.section_id ?? "chưa rõ"}`
        : `Lớp học phần ${item.class_code ?? item.section_id ?? "chưa rõ"}`
    const existing = map.get(key)
    const group = existing ?? {
      key,
      scopeType: item.scope_type,
      scopeId: item.section_id,
      classCode: item.class_code,
      title,
      cases: [],
      highCount: 0,
      unconfirmedCount: 0,
      scheduledCount: 0,
      overdueCount: 0,
    }
    group.cases.push(item)
    if (item.priority === "high" || item.priority === "critical") group.highCount += 1
    if (!item.assessment_confirmed_at) group.unconfirmedCount += 1
    if ((item.appointments ?? []).some((appointment) => appointment.status === "scheduled")) group.scheduledCount += 1
    if (item.is_overdue) group.overdueCount += 1
    map.set(key, group)
  }

  return [...map.values()].sort((left, right) => {
    if (right.highCount !== left.highCount) return right.highCount - left.highCount
    if (right.cases.length !== left.cases.length) return right.cases.length - left.cases.length
    return left.title.localeCompare(right.title, "vi")
  })
}

type TasksPageCache = {
  user: ApiUser | null
  tasks: ApiOpsTask[]
  alerts: ApiOpsAlert[]
  advisorCases: ApiAdvisorCase[]
  selected: ApiOpsTask | null
  selectedCase: ApiAdvisorCase | null
}

const TASKS_PAGE_CACHE_KEY = "manager:tasks"

export default function TasksPage() {
  const searchParams = useSearchParams()
  const cachedPage = React.useMemo(() => getPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY), [])
  const [user, setUser] = React.useState<ApiUser | null>(cachedPage?.user ?? null)
  const [tab, setTab] = React.useState<TaskTabKey>("mine")
  const [tasks, setTasks] = React.useState<ApiOpsTask[]>(cachedPage?.tasks ?? [])
  const [alerts, setAlerts] = React.useState<ApiOpsAlert[]>(cachedPage?.alerts ?? [])
  const [selected, setSelected] = React.useState<ApiOpsTask | null>(cachedPage?.selected ?? null)
  const [loading, setLoading] = React.useState(!cachedPage?.user)
  const [error, setError] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [scopeFilter, setScopeFilter] = React.useState<"all" | "section" | "homeroom">("all")
  const [advisorCases, setAdvisorCases] = React.useState<ApiAdvisorCase[]>(cachedPage?.advisorCases ?? [])
  const [selectedCase, setSelectedCase] = React.useState<ApiAdvisorCase | null>(cachedPage?.selectedCase ?? null)
  const [syncingCases, setSyncingCases] = React.useState(false)
  const [noticeGroupKey, setNoticeGroupKey] = React.useState<string | null>(null)
  const [noticeTitle, setNoticeTitle] = React.useState("Nhận xét về tình trạng học tập")
  const [noticeMessage, setNoticeMessage] = React.useState("")
  const [noticeCampaign, setNoticeCampaign] = React.useState<ApiInterventionCampaign | null>(null)
  const [noticeError, setNoticeError] = React.useState<string | null>(null)
  const [sendingBulk, setSendingBulk] = React.useState(false)
  const initialTabSelectedRef = React.useRef(false)

  const tabs = taskTabsForRole(user?.role)
  const advisorGroups = React.useMemo(
    () => buildAdvisorGroups(advisorCases.filter((item) => !["resolved", "closed"].includes(item.status))),
    [advisorCases],
  )
  const noticeGroup = React.useMemo(
    () => advisorGroups.find((group) => group.key === noticeGroupKey) ?? null,
    [advisorGroups, noticeGroupKey],
  )
  const homeroomProblemCount = advisorCases.filter((item) => item.scope_type === "homeroom").length
  const sectionProblemCount = advisorCases.filter((item) => item.scope_type === "section").length
  const highProblemCount = advisorCases.filter((item) => item.priority === "high" || item.priority === "critical").length

  const load = React.useCallback(async () => {
    if (!getPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY)?.user) setLoading(true)
    setError(null)
    try {
      const taskParams =
        tab === "mine" ? { assignee: "me" } :
        tab === "active" ? { status: statusFilter === "all" ? undefined : statusFilter } :
        tab === "overdue" ? { overdue: true } :
        tab === "closed" ? { status: "resolved" } :
        {}
      const [taskRows, alertRows, caseRows] = await Promise.all([
        tab === "alerts" ? Promise.resolve([]) : api.getTasks({ ...taskParams, limit: 300 }),
        tab === "alerts" || tab === "all" ? api.getAlerts({ status: "new", limit: 100 }) : Promise.resolve([]),
        api.getAdvisorCases({ scope_type: scopeFilter === "all" ? undefined : scopeFilter }).catch(() => []),
      ])
      const visibleTasks = taskRows.filter((task) => {
        const evidence = task.metadata_json?.alert
        return !task.source_alert_id || hasAlertData(evidence && typeof evidence === "object" ? evidence as Record<string, unknown> : undefined)
      })
      const visibleAlerts = alertRows.filter((alert) => hasAlertData(alert.evidence_json))
      setTasks(visibleTasks)
      setAlerts(visibleAlerts)
      setAdvisorCases(caseRows)
      setSelected((current) => current
        ? visibleTasks.find((row) => row.id === current.id) ?? current
        : null)
      const cachedTasksPage = getPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY)
      setPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY, {
        user: cachedTasksPage?.user ?? null,
        tasks: visibleTasks,
        alerts: visibleAlerts,
        advisorCases: caseRows,
        selected: cachedTasksPage?.selected ? visibleTasks.find((row) => row.id === cachedTasksPage.selected?.id) ?? cachedTasksPage.selected : null,
        selectedCase: cachedTasksPage?.selectedCase ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tải được danh sách việc cần xử lý."
      setError(message)
      setTasks([])
      setAlerts([])
      setAdvisorCases([])
    } finally {
      setLoading(false)
    }
  }, [scopeFilter, statusFilter, tab])

  React.useEffect(() => {
    const cached = getCachedCurrentUser()
    if (cached) setUser(cached)
    api.me().then((nextUser) => {
      setUser(nextUser)
      const cachedTasks = getPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY)
      setPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY, {
        user: nextUser,
        tasks: cachedTasks?.tasks ?? [],
        alerts: cachedTasks?.alerts ?? [],
        advisorCases: cachedTasks?.advisorCases ?? [],
        selected: cachedTasks?.selected ?? null,
        selectedCase: cachedTasks?.selectedCase ?? null,
      })
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Không xác định được người dùng hiện tại.")
      setLoading(false)
    })
  }, [])

  React.useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0] ?? "mine")
  }, [tab, tabs])

  React.useEffect(() => {
    if (!user || initialTabSelectedRef.current) return
    initialTabSelectedRef.current = true
    if (user.role === "superadmin" || user.role === "admin") setTab("all")
  }, [user])

  React.useEffect(() => {
    if (user) void load()
  }, [load, user])

  React.useEffect(() => {
    const cachedTasksPage = getPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY)
    if (!cachedTasksPage) return
    setPageDataCache<TasksPageCache>(TASKS_PAGE_CACHE_KEY, {
      ...cachedTasksPage,
      user,
      selected,
      selectedCase,
    })
  }, [selected, selectedCase, user])

  React.useEffect(() => {
    const taskId = Number(searchParams.get("task_id"))
    if (!Number.isFinite(taskId) || taskId <= 0) return
    void api.getTask(taskId).then(setSelected).catch(() => undefined)
  }, [searchParams])

  React.useEffect(() => {
    const requestedScope = searchParams.get("scope_type")
    if (requestedScope === "section" || requestedScope === "homeroom") setScopeFilter(requestedScope)
    const caseId = Number(searchParams.get("case_id"))
    if (Number.isFinite(caseId) && caseId > 0) {
      void api.getAdvisorCase(caseId).then(setSelectedCase).catch(() => undefined)
      return
    }
    const studentId = Number(searchParams.get("student_id"))
    if (Number.isFinite(studentId) && studentId > 0) {
      void api.getAdvisorCases({ student_id: studentId }).then((rows) => setSelectedCase(rows[0] ?? null)).catch(() => undefined)
    }
  }, [searchParams])

  async function convert(alert: ApiOpsAlert) {
    setError(null)
    try {
      const task = await api.convertAlertToTask(alert.id)
      setSelected(task)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không convert được cảnh báo thành task.")
    }
  }

  async function generate(kind?: "student-risk" | "section-risk" | "course-risk" | "outcome-risk" | "data-quality" | "system") {
    setError(null)
    try {
      await api.generateAlerts(kind)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không sinh được cảnh báo.")
    }
  }

  async function syncCases() {
    setSyncingCases(true)
    setError(null)
    try {
      await api.syncAdvisorCases()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đồng bộ được danh sách sinh viên cần quan tâm.")
    } finally {
      setSyncingCases(false)
    }
  }

  async function openGroupNotice(group: AdvisorCaseGroup) {
    setNoticeGroupKey(group.key)
    setNoticeCampaign(null)
    setNoticeError(null)
    setNoticeTitle(`Trao đổi hỗ trợ học tập - ${group.title}`)
    setNoticeMessage(
      [
        "Chào {full_name} ({student_code}),",
        "",
        "Thầy/cô gửi em thông tin rà soát tình hình học tập hiện tại.",
        "",
        "Lớp học phần đang được theo dõi:",
        "{scope_course}",
        "",
        "Các học phần yếu, cận ngưỡng hoặc chưa đạt ghi nhận trong hệ thống:",
        "{risk_details}",
        "",
        "Tổng hợp tín hiệu: GPA tích lũy {gpa}; {reasons}.",
        "Nguồn cảnh báo: {risk_sources}. Đây là tín hiệu hỗ trợ để trao đổi, không thay thế kết luận học vụ chính thức.",
        "",
        "Đề nghị em thực hiện: {actions}.",
        "Nếu cần hỗ trợ, em hãy phản hồi để thầy/cô cùng trao đổi phương án phù hợp.",
      ].join("\n"),
    )
    try {
      const campaigns = await api.getInterventionCampaigns({
        scope_type: group.scopeType,
        section_id: group.scopeId ?? undefined,
        class_code: group.classCode ?? undefined,
      })
      const active = campaigns.find((campaign) => ["draft", "reviewing", "approved"].includes(campaign.status))
      if (active?.messages.length) setNoticeCampaign(active)
    } catch (err) {
      setNoticeError(err instanceof Error ? err.message : "Không tải được đợt thông báo đang duyệt.")
    }
  }

  async function createNoticeDrafts() {
    const group = noticeGroup
    const studentIds = group?.cases.map((item) => item.student_id) ?? []
    if (!group || !studentIds.length || !noticeTitle.trim() || !noticeMessage.trim()) return
    setSendingBulk(true)
    setError(null)
    setNoticeError(null)
    try {
      const campaign = await api.createInterventionCampaign({
        scope_type: group.scopeType,
        scope_id: group.scopeId,
        class_code: group.classCode,
        title: noticeTitle.trim(),
        student_ids: studentIds,
        max_students: studentIds.length,
      })
      const drafted = await api.generateInterventionCampaignDrafts(campaign.id, {
        student_ids: studentIds,
        channel: "internal",
        subject: noticeTitle.trim(),
        message_template: noticeMessage.trim(),
        max_students: studentIds.length,
      })
      setNoticeCampaign(drafted)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tạo được danh sách thông báo nháp."
      setError(message)
      setNoticeError(message)
    } finally {
      setSendingBulk(false)
    }
  }

  function updateLocalDraft(messageId: number, field: "subject" | "body", value: string) {
    setNoticeCampaign((current) => current ? {
      ...current,
      messages: current.messages.map((message) => message.id === messageId ? { ...message, [field]: value } : message),
    } : current)
  }

  async function saveNoticeDraft(message: ApiInterventionMessage) {
    setSendingBulk(true)
    setError(null)
    setNoticeError(null)
    try {
      const saved = await api.updateInterventionCampaignMessage(message.id, {
        subject: message.subject ?? "",
        body: message.body ?? "",
      })
      setNoticeCampaign((current) => current ? {
        ...current,
        messages: current.messages.map((item) => item.id === saved.id ? saved : item),
      } : current)
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Không lưu được thông báo nháp."
      setError(messageText)
      setNoticeError(messageText)
    } finally {
      setSendingBulk(false)
    }
  }

  const canReviewNoticeCampaign = !!user && ["superadmin", "admin", "manager", "lecturer"].includes(user.role)

  async function finalizeNoticeCampaign() {
    if (!noticeCampaign) return
    setSendingBulk(true)
    setError(null)
    setNoticeError(null)
    try {
      for (const message of noticeCampaign.messages) {
        await api.updateInterventionCampaignMessage(message.id, { subject: message.subject ?? "", body: message.body ?? "" })
      }
      await api.approveInterventionCampaign(noticeCampaign.id)
      await api.sendInterventionCampaign(noticeCampaign.id)
      setNoticeGroupKey(null)
      setNoticeCampaign(null)
      setNoticeMessage("")
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không chốt được đợt thông báo."
      setError(message)
      setNoticeError(message)
    } finally {
      setSendingBulk(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Việc cần xử lý</h1>
          <p className="text-sm text-muted-foreground">Work queue theo actor: cảnh báo, giao việc, follow-up và đóng vòng xử lý.</p>
        </div>
        <div className="flex gap-2">
          {canGenerateAlerts(user?.role) ? (
            <>
              <Button variant="outline" onClick={() => generate()}>
                <RefreshCw className="size-4" />
                Sinh cảnh báo
              </Button>
              <Select value="student-risk" onValueChange={(value) => generate(value as "student-risk")}>
                <SelectTrigger className="w-36">Theo loại</SelectTrigger>
                <SelectContent>
                  <SelectItem value="student-risk">Sinh viên</SelectItem>
                  <SelectItem value="section-risk">Lớp</SelectItem>
                  <SelectItem value="course-risk">Môn</SelectItem>
                  <SelectItem value="outcome-risk">CLO/PLO</SelectItem>
                  <SelectItem value="data-quality">Dữ liệu</SelectItem>
                  <SelectItem value="system">Hệ thống</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tổng việc</div><div className="text-2xl font-semibold">{tasks.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Cảnh báo mới</div><div className="text-2xl font-semibold">{alerts.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Quá hạn</div><div className="text-2xl font-semibold">{tasks.filter((task) => task.due_at && new Date(task.due_at) < new Date() && !["resolved", "closed"].includes(task.status)).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">High priority</div><div className="text-2xl font-semibold">{tasks.filter((task) => ["urgent", "critical", "high"].includes(task.priority)).length}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4" />Cố vấn và lịch hẹn</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={scopeFilter} onValueChange={(value) => setScopeFilter(value as typeof scopeFilter)}>
                <SelectTrigger className="w-44">Phạm vi lớp</SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="section">Lớp học phần</SelectItem>
                  <SelectItem value="homeroom">Lớp cố vấn</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={syncCases} disabled={syncingCases}><RefreshCw className={`size-4 ${syncingCases ? "animate-spin" : ""}`} />{syncingCases ? "Đang đồng bộ" : "Cập nhật danh sách"}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Sinh viên lớp cố vấn có vấn đề</div>
              <div className="mt-1 text-2xl font-semibold">{homeroomProblemCount}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Sinh viên lớp học phần có vấn đề</div>
              <div className="mt-1 text-2xl font-semibold">{sectionProblemCount}</div>
            </div>
            <div className={`rounded-lg border p-3 ${highProblemCount ? "border-red-500/40 bg-red-500/5" : "bg-muted/30"}`}>
              <div className="text-xs text-muted-foreground">Cần cảnh báo nguy hiểm</div>
              <div className={`mt-1 text-2xl font-semibold ${highProblemCount ? "text-red-700" : ""}`}>{highProblemCount}</div>
            </div>
          </div>

          {noticeGroup ? <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">Chuẩn bị đợt thông báo cho {noticeGroup.title}</div>
                <div className="text-xs text-muted-foreground">Tạo {noticeGroup.cases.length} bản nháp riêng để giảng viên xem và chỉnh từng sinh viên trước khi chốt gửi. Chỉ khi chốt, thông báo mới được lưu vào hồ sơ năng lực.</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setNoticeGroupKey(null); setNoticeCampaign(null) }}>Đóng</Button>
            </div>
            {noticeError ? <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Không thể hoàn tất thao tác: {noticeError}</div> : null}
            {!noticeCampaign ? <div className="grid gap-3">
              <Input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Tiêu đề nhận xét" />
              <Textarea value={noticeMessage} onChange={(event) => setNoticeMessage(event.target.value)} placeholder="Nội dung về tình trạng học tập và hành động sinh viên cần thực hiện..." />
              <p className="text-xs text-muted-foreground">Dữ liệu cá nhân hóa: <code>{"{scope_course}"}</code> lớp đang theo dõi, <code>{"{risk_details}"}</code> các học phần yếu/trượt, <code>{"{gpa}"}</code>, <code>{"{reasons}"}</code>, <code>{"{risk_sources}"}</code> và <code>{"{actions}"}</code>.</p>
              <div className="flex justify-end">
                <Button onClick={createNoticeDrafts} disabled={sendingBulk || !noticeTitle.trim() || !noticeMessage.trim()}>
                  <Send className="size-4" />
                  {sendingBulk ? "Đang tạo bản nháp..." : `Tạo ${noticeGroup.cases.length} bản nháp để duyệt`}
                </Button>
              </div>
            </div> : <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Duyệt từng thông báo ({noticeCampaign.messages.length})</p>
                <Badge variant="outline">{noticeCampaign.messages.filter((message) => !message.contact_id).length} bản nháp chưa gửi</Badge>
              </div>
              {!canReviewNoticeCampaign ? <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Tài khoản hiện tại chỉ có quyền xem bản nháp.</div> : null}
              <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                {noticeCampaign.messages.map((message, index) => (
                  <div key={message.id} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{index + 1}. {message.full_name ?? `Sinh viên #${message.student_id}`}</div>
                      <span className="text-xs text-muted-foreground">{message.student_code ?? "Chưa có MSSV"}</span>
                    </div>
                    <div className="grid gap-2">
                      <Input disabled={!canReviewNoticeCampaign} value={message.subject ?? ""} onChange={(event) => updateLocalDraft(message.id, "subject", event.target.value)} aria-label={`Tiêu đề cho ${message.full_name ?? message.student_id}`} />
                      <Textarea disabled={!canReviewNoticeCampaign} className="min-h-32" value={message.body ?? ""} onChange={(event) => updateLocalDraft(message.id, "body", event.target.value)} aria-label={`Nội dung cho ${message.full_name ?? message.student_id}`} />
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" disabled={!canReviewNoticeCampaign || sendingBulk || !message.subject?.trim() || !message.body?.trim()} onClick={() => saveNoticeDraft(message)}>Lưu bản nháp này</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <p className="text-xs text-muted-foreground">Chốt một lần sẽ lưu từng bản ghi vào đúng hồ sơ năng lực; không gửi email ngoài hệ thống.</p>
                <Button onClick={finalizeNoticeCampaign} disabled={!canReviewNoticeCampaign || sendingBulk || noticeCampaign.messages.some((message) => !message.subject?.trim() || !message.body?.trim())}>
                  <CheckCircle2 className="size-4" />
                  {sendingBulk ? "Đang chốt..." : `Chốt và gửi ${noticeCampaign.messages.length} thông báo`}
                </Button>
              </div>
            </div>}
          </div> : null}

          {advisorGroups.length ? advisorGroups.map((group) => {
            const dangerous = group.highCount > 0
            return (
              <div key={group.key} className={`rounded-lg border p-4 ${dangerous ? "border-red-500/40 bg-red-500/5" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className={`flex items-center gap-2 font-medium ${dangerous ? "text-red-700" : ""}`}>
                      {dangerous ? <AlertTriangle className="size-4" /> : <UsersRound className="size-4" />}
                      {group.title}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {group.cases.length} sinh viên có vấn đề · {group.unconfirmedCount} nhận định chờ xác nhận · {group.scheduledCount} lịch hẹn sắp tới
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={dangerous ? "destructive" : "outline"}>{group.highCount} nguy hiểm</Badge>
                    {group.overdueCount ? <Badge variant="destructive">{group.overdueCount} quá hạn</Badge> : null}
                    <Button size="sm" variant="outline" onClick={() => openGroupNotice(group)}>
                      <Send className="size-3.5" />
                      Soạn mẫu thông báo
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {group.cases.slice(0, 6).map((item) => (
                    <button key={item.id} type="button" onClick={() => setSelectedCase(item)} className="flex items-center justify-between gap-3 rounded-md border bg-background/70 p-2 text-left text-sm hover:bg-muted/40">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.student_name ?? `Sinh viên #${item.student_id}`}</span>
                        <span className="block text-xs text-muted-foreground">{item.student_code ?? item.student_id}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Badge variant={item.priority === "high" || item.priority === "critical" ? "destructive" : "outline"}>{priorityLabel(item.priority)}</Badge>
                        <Badge variant="outline">{item.assessment_confirmed_at ? "Đã chốt" : "Chờ duyệt"}</Badge>
                      </span>
                    </button>
                  ))}
                </div>
                {group.cases.length > 6 ? <div className="mt-2 text-xs text-muted-foreground">Còn {group.cases.length - 6} sinh viên khác trong nhóm này.</div> : null}
              </div>
            )
          }) : <div className="py-6 text-center text-sm text-muted-foreground"><p>Chưa có hồ sơ cố vấn trong phạm vi này.</p><p className="mt-1 text-xs">Bấm “Cập nhật danh sách” để chuyển tín hiệu học tập thành việc cần theo dõi.</p></div>}
        </CardContent>
      </Card>
      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-destructive">Chưa tải được dữ liệu việc cần xử lý</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" onClick={() => load()}>
                <RefreshCw className="size-4" />
                Tải lại
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Tabs value={tab} onValueChange={(value) => setTab(value as TaskTabKey)}>
        <TabsList className="flex flex-wrap">
          {tabs.map((key) => <TabsTrigger key={key} value={key}>{TAB_LABELS[key]}</TabsTrigger>)}
        </TabsList>
        {tabs.map((key) => (
          <TabsContent key={key} value={key} className="space-y-3">
            {key === "active" ? (
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
                <SelectTrigger className="w-44">Trạng thái</SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi trạng thái</SelectItem>
                  <SelectItem value="open">Mới</SelectItem>
                  <SelectItem value="assigned">Đã giao</SelectItem>
                  <SelectItem value="in_progress">Đang xử lý</SelectItem>
                  <SelectItem value="waiting_followup">Chờ follow-up</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {key === "alerts" ? <AlertTriangle className="size-4" /> : <ListTodo className="size-4" />}
                  {TAB_LABELS[key]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> : null}
                {!loading && (key === "alerts" ? alerts.length === 0 : tasks.length === 0) ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Không có dữ liệu phù hợp.</div>
                ) : null}
                {key === "alerts"
                  ? alerts.map((alert) => <AlertRow key={alert.id} alert={alert} onConvert={convert} />)
                  : tasks.map((task) => <TaskRow key={task.id} task={task} selected={selected?.id === task.id} onSelect={() => setSelected(task)} />)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <TaskDetail task={selected} user={user} onClose={() => setSelected(null)} onReload={load} />
      <AdvisorCaseDetail
        item={selectedCase}
        onClose={() => setSelectedCase(null)}
        onReload={() => {
          if (selectedCase) void api.getAdvisorCase(selectedCase.id).then(setSelectedCase)
          void load()
        }}
      />
    </div>
  )
}
