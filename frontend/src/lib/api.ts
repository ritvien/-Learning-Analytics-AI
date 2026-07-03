// API types matching backend response shapes
export interface ApiStudent {
  id: number
  student_code: string
  full_name: string
  gender: string | null
  class_code: string | null
  status: string
  program_id: number
  specialization_id: number | null
  cohort_id: number
  gpa_cumulative: number | null
}
 
export interface ApiDropoutRisk {
  student_id: number
  student_code?: string | null
  dropout_probability: number
  risk_level: "low" | "medium" | "high"
  top_factors: { feature: string; impact: number }[]
  model_name?: string
  model_version?: string
  scored_at?: string
  source?: "live" | "batch"
}


export interface ApiCohort {
  id: number
  code: string
  year_start: number
  year_end: number | null
  note: string | null
}

export interface ApiStudentTokenData {
  total_students: number
  active_students: number
  demographics: {
    male: number
    female: number
    other: number
  }
  enrollment_status: Record<string, number>
}

export interface ApiDepartment {
  id: number
  code: string
  name: string
  description: string | null
  is_active: boolean
}

export interface ApiProgram {
  id: number
  code: string
  name: string
  description: string | null
  department_id: number
}

export interface ApiCourse {
  id: number
  code: string
  name: string
  credits: number
  description: string | null
  is_elective: boolean
  is_active: boolean
  department_id: number
  program_ids: number[]
}

export interface ApiEnrollment {
  id: number
  student_id: number
  section_id: number
  final_grade: number | null
  grade_letter: string | null
  grade_4: number | null
  registered_credits: number | null
  is_passed: boolean | null
  completed_at: string | null
  attempt_number: number
  status: string
}

export interface ApiGradeImportRow {
  row_number?: number
  enrollment_id?: number | null
  student_code?: string | null
  section_code?: string | null
  course_code?: string | null
  final_grade?: number | null
  component_name?: string | null
  component_score?: number | null
  notes?: string | null
}

export interface ApiGradeImportResult {
  total_rows: number
  updated_rows: number
  skipped_rows: number
  errors: string[]
}

export interface ApiGradeComponent {
  id: number
  enrollment_id: number
  component_type_id: number
  component_name: string
  score: number | null
  max_score: number
  is_absent: boolean
  assessed_at: string | null
  recorded_at: string | null
  updated_at: string
}

export interface ApiSection {
  id: number
  section_code: string
  course_id: number
  semester_id: number
  teacher_id: number | null
  room: string | null
  schedule: string | null
  max_students: number | null
  is_active: boolean
}

export interface ApiTeacher {
  id: number
  user_id: string | null
  code: string | null
  full_name: string
  email: string | null
  phone: string | null
  academic_title: string | null
  specialization: string | null
  department_id: number
  is_active: boolean
}

export interface ApiSemester {
  id: number
  code: string
  name: string
  year: number
  term: number
  is_current: boolean
}

export type ApiUserRole = "superadmin" | "admin" | "manager" | "lecturer" | "viewer"

export interface ApiUser {
  id: string
  email: string
  full_name: string
  role: ApiUserRole
  position: string | null
  department_id: number | null
  is_active: boolean
  created_at: string
}

export interface ApiReportBuildPlan {
  session_id: string
  action_id?: string | null
  definition: Record<string, unknown>
  data_quality: Record<string, unknown>
  missing_fields: string[]
  requires_confirmation: boolean
  message: string
}

export interface LoginResponse {
  access_token: string
  token_type: "bearer"
}

export type ApiReportType =
  | "school_overview"
  | "department_health"
  | "program_health"
  | "course_health"
  | "section_intervention"

export interface ApiHealthScore {
  node_id: number
  node_type: string
  health_score: number
  status: "Healthy" | "Warning" | "Critical"
  metrics: {
    gpa_avg: number
    fail_rate: number
    clo_attainment_rate: number
  }
}

export interface ApiReportFeedback {
  id: number
  report_id: string
  user_id: string | null
  rating: number | null
  is_helpful: boolean | null
  comment: string | null
  created_at: string
}

export interface ApiReport {
  id: string
  report_type: string
  actor_role: string
  scope_type: string | null
  scope_id: string | null
  title: string
  summary: string
  status: string
  metrics_json: Record<string, unknown>
  content_markdown: string
  generated_by: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
  feedback_items: ApiReportFeedback[]
}

export type ApiReportScheduleFrequency = "weekly" | "monthly" | "midterm" | "end_semester" | "after_grade_update"

export interface ApiReportSchedule {
  id: number
  name: string
  report_type: ApiReportType
  actor_role: string
  scope_type: string | null
  scope_id: string | null
  frequency: ApiReportScheduleFrequency
  trigger_event: string | null
  recipients_json: string[]
  formats_json: string[]
  detail_level: string
  include_ai_narrative: boolean
  include_appendix: boolean
  is_active: boolean
  next_run_at: string | null
  last_run_at: string | null
  created_by: string | null
  last_report_id: string | null
  created_at: string
  updated_at: string
}

export interface ApiObservabilityEvent {
  id: number
  occurred_at: string
  event_name: string
  event_version: number
  user_id?: string | null
  user_role?: string | null
  department_id?: number | null
  session_id?: string | null
  request_id?: string | null
  trace_id?: string | null
  conversation_id?: string | null
  agent_run_id?: string | null
  tool_call_id?: string | null
  retrieval_id?: string | null
  route?: string | null
  module?: string | null
  entity_type?: string | null
  entity_id?: string | null
  status?: string | null
  duration_ms?: number | null
  error_code?: string | null
  payload: Record<string, unknown>
}

export interface ApiObservabilityEventList {
  total: number
  skip: number
  limit: number
  items: ApiObservabilityEvent[]
}

export interface ApiObservabilitySession {
  session_id: string
  user_id?: string | null
  user_role?: string | null
  department_id?: number | null
  first_seen_at: string
  last_seen_at: string
  event_count: number
  request_count: number
  error_count: number
  avg_duration_ms?: number | null
}

export interface ApiObservabilitySessionList {
  total: number
  skip: number
  limit: number
  items: ApiObservabilitySession[]
}

export interface ApiObservabilityUserAggregate {
  user_id: string
  email?: string | null
  full_name?: string | null
  user_role?: string | null
  session_count: number
  event_count: number
  request_count: number
  error_count: number
  avg_duration_ms?: number | null
  last_seen_at: string
}

export interface ApiObservabilityUserAggregateList {
  total: number
  skip: number
  limit: number
  items: ApiObservabilityUserAggregate[]
}

export interface ApiReportScheduleRun {
  id: number
  schedule_id: number
  report_id: string | null
  trigger: string
  status: string
  message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ApiReportScheduleCreate {
  name: string
  report_type: ApiReportType
  actor_role?: string
  scope_type?: string | null
  scope_id?: string | null
  frequency: ApiReportScheduleFrequency
  trigger_event?: string | null
  recipients_json?: string[]
  formats_json?: string[]
  detail_level?: string
  include_ai_narrative?: boolean
  include_appendix?: boolean
  is_active?: boolean
  next_run_at?: string | null
}

export interface ApiTreeMetrics {
  student_count: number
  course_count: number
  completed_enrollments: number
  passed_enrollments: number
  failed_enrollments: number
  pass_rate: number
  fail_rate: number
  avg_gpa: number
  avg_grade: number
  health_score: number
}

export interface ApiTreeNode {
  id: number | string
  type: "school" | "department" | "program" | "specialization" | "course"
  code: string
  label: string
  metrics: ApiTreeMetrics
  children: ApiTreeNode[]
}

export interface ApiDashboardDepartmentOption {
  id: number
  code: string
  name: string
}

export interface ApiDashboardProgramOption {
  id: number
  code: string
  name: string
  department_id: number
}

export interface ApiDashboardSemesterOption {
  id: number
  code: string
  name: string
  year: number
  term: number
  completed_enrollments: number
}

export interface ApiDashboardCohortOption {
  id: number
  code: string
  year_start: number
}

export interface ApiDashboardTrendRow {
  id: number
  semester: string
  year: number
  term: number
  count: number
  failed_count?: number
  near_fail_count?: number
  department_count?: number
  pass_rate: number
  avg_grade: number
}

export interface ApiDashboardOverview {
  departments: ApiDashboardDepartmentOption[]
  programs: ApiDashboardProgramOption[]
  semesters: ApiDashboardSemesterOption[]
  cohorts: ApiDashboardCohortOption[]
  kpis: {
    total_active_students: number
    program_count: number
    completed_enrollments: number
    failed_enrollments: number
    risk_student_count: number
    pass_rate: number
    avg_grade: number
  }
  trend: ApiDashboardTrendRow[]
  program_rows: {
    id: number
    code: string
    name: string
    department: string | null
    active_students: number
    sections: number
    pass_rate: number
    avg_grade: number
    at_risk: number
    worst_course: string
  }[]
  department_rows: { id: number; name: string; count: number; pass_rate: number }[]
  cohort_rows: { id: number; cohort: string; year_start: number; count: number; pass_rate: number; fail_rate: number }[]
  grade_distribution: { name: string; value: number }[]
  heatmap: { program_id: number; program_name: string; semester_id: number; semester: string; year: number; term: number; pass_rate: number }[]
}

export interface ApiDashboardDepartments {
  departments: ApiDashboardDepartmentOption[]
  programs: ApiDashboardProgramOption[]
  semesters: ApiDashboardSemesterOption[]
  cohorts: ApiDashboardCohortOption[]
  kpis: {
    students: number
    completed_enrollments: number
    passed_enrollments: number
    failed_enrollments: number
    pass_rate: number
    avg_grade: number
    at_risk: number
    at_risk_rate: number
  }
  dept_stats: {
    id: number
    name: string
    short_name: string
    student_count: number
    enrollment_count: number
    pass_rate: number
    avg_grade: number
    at_risk: number
    at_risk_rate: number
  }[]
  trend: ApiDashboardTrendRow[]
  heatmap: { department_id: number; department: string; semester_id: number; semester: string; year: number; term: number; pass_rate: number }[]
  drill_course_fail: { id: number; name: string; total: number; failed: number; rate: number }[]
  drill_section_abnormal: { id: number; code: string; course_name: string; fail_rate: number; avg_fail: number; diff: number }[]
}

export interface ApiDashboardProgram {
  departments: ApiDashboardDepartmentOption[]
  programs: ApiDashboardProgramOption[]
  semesters: ApiDashboardSemesterOption[]
  cohorts: ApiDashboardCohortOption[]
  program: ApiDashboardProgramOption
  kpis: {
    students: number
    completed_enrollments: number
    pass_rate: number
    avg_grade: number
    at_risk: number
    bottlenecks: number
  }
  trend: ApiDashboardTrendRow[]
  course_stats: { id: number; code: string; name: string; group: string; total: number; pass_rate: number; avg_grade: number; failed: number; near_fail: number }[]
  groups: { name: string; pass_rate: number }[]
  distribution: { name: string; value: number }[]
  cohort_heatmap: { cohort_id: number; cohort: string; semester_id: number; semester: string; year: number; term: number; pass_rate: number }[]
}

export interface ApiDashboardCourses {
  departments: ApiDashboardDepartmentOption[]
  programs: ApiDashboardProgramOption[]
  semesters: ApiDashboardSemesterOption[]
  cohorts: ApiDashboardCohortOption[]
  filters: {
    semester_code: string | null
    department_id: number | null
    program_id: number | null
    course_id: number | null
    date_from: string | null
    date_to: string | null
  }
  course_rows: {
    id: number
    code: string
    name: string
    credits: number
    completed_enrollments: number
    pass_rate: number
    avg_grade: number
    failed_count: number
    near_fail_count: number
    section_count: number
    clo_attainment_rate: number | null
    clo_evidence_count: number
    data_status: "ready" | "missing_clo" | "insufficient_sample"
    health_score: number | null
  }[]
  selected_course: null | {
    course: {
      id: number
      code: string
      name: string
      credits: number
    }
    kpis: {
      completed_enrollments: number
      pass_rate: number
      avg_grade: number
      section_count: number
      failed_count: number
      near_fail_count: number
      clo_attainment_rate: number | null
      clo_evidence_count: number
      data_status: "ready" | "missing_clo" | "insufficient_sample"
      health_score: number | null
    }
    trend: ApiDashboardTrendRow[]
    clo_trend: {
      clo_id: number
      clo_code: string
      clo_name: string
      semester: string
      year: number
      term: number
      evidence_count: number
      attainment_rate: number | null
    }[]
    clo_rows: {
      id: number
      code: string
      name: string
      evidence_count: number
      avg_score: number | null
      attainment_rate: number | null
    }[]
    grade_distribution: { name: string; value: number }[]
    section_rows: {
      id: number
      section_code: string
      semester_id: number
      semester_code: string
      semester_name: string
      completed_enrollments: number
      failed_count: number
      pass_rate: number
      avg_grade: number
      pass_rate_diff: number
    }[]
  }
}

export interface ApiDashboardOutcomes {
  departments: ApiDashboardDepartmentOption[]
  programs: ApiDashboardProgramOption[]
  semesters: ApiDashboardSemesterOption[]
  cohorts: ApiDashboardCohortOption[]
  kpis: {
    programs_with_evidence: number
    plos_with_evidence: number
    clos_with_evidence: number
    courses_with_evidence: number
    evidence_count: number
    student_count: number
    attainment_pct: number
    plos_at_target: number
  }
  plo_rows: {
    department_id: number | null
    department_name: string | null
    program_id: number
    program_code: string
    program_name: string
    plo_id: number
    plo_code: string
    plo_name: string
    evidence_count: number
    student_count: number
    course_count: number
    semester_count: number
    avg_score: number | null
    attainment_pct: number
  }[]
  plo_trend: {
    program_id: number
    program_code: string
    program_name: string
    plo_id: number
    plo_code: string
    plo_name: string
    semester: string
    year: number
    term: number
    evidence_count: number
    attainment_pct: number
  }[]
  driver_courses: {
    program_id: number
    program_code: string
    program_name: string
    plo_id: number
    plo_code: string
    plo_name: string
    course_id: number
    course_code: string
    course_name: string
    evidence_count: number
    student_count: number
    attainment_pct: number
  }[]
  driver_clos: {
    program_id: number
    program_code: string
    program_name: string
    plo_id: number
    plo_code: string
    course_id: number
    course_code: string
    course_name: string
    clo_id: number
    clo_code: string
    clo_name: string
    evidence_count: number
    attainment_pct: number
  }[]
  quality_rows: {
    department_id: number | null
    department_name: string | null
    program_id: number
    program_code: string
    program_name: string
    plo_count: number
    program_courses: number
    courses_with_clo: number
    courses_with_component_clo_mapping: number
    mapped_clo_count: number
    evidence_count: number
    courses_with_evidence: number
    students_with_evidence: number
    semesters_with_evidence: number
    data_status: "ready" | "partial" | "missing"
  }[]
  data_status: "ready" | "partial"
  warnings: string[]
}

// --- Report Agent ---
export type ApiReportAgentMode = "explain" | "root_cause" | "narrative" | "action_planning" | "workflow" | "compare"

export interface ApiReportAgentPendingAction {
  id: string
  session_id: string
  action_type: string
  payload_json: Record<string, unknown>
  status: string
  created_at: string
}

export interface ApiReportAgentAskResponse {
  response: string
  session_id: string
  mode: string
  prompt_version: string
  memory_summary: string | null
  tool_calls: {
    tool_name: string
    tool_input: Record<string, unknown>
    tool_output: Record<string, unknown>
    status: string
    latency_ms: number
  }[]
  pending_actions: ApiReportAgentPendingAction[]
  latency_ms: number
}

// --- Chat ---
export interface ChatRequest {
  message: string
  context?: Record<string, unknown>
  thread_id?: string
}

export interface ChatSessionSummary {
  id: string
  title: string
  updated_at: string
}

export interface ChatSessionMessage {
  type?: string
  content?: unknown
  data?: {
    content?: unknown
  }
}

export interface ChatSessionDetail {
  id: string
  title: string
  messages: ChatSessionMessage[]
}

export interface ChatResponse {
  response: string
  intent: string
  tool_calls: { tool_name: string; tool_input: Record<string, unknown>; tool_output: string }[]
  latency_ms: number
}

export type ApiOpsPriority = "urgent" | "critical" | "high" | "medium" | "low"
export type ApiOpsTaskStatus = "open" | "assigned" | "in_progress" | "waiting_followup" | "resolved" | "closed" | "cancelled"
export type ApiOpsScopeType = "student" | "section" | "homeroom" | "course" | "program" | "department" | "data_quality" | "system"

export interface ApiOpsAlert {
  id: number
  alert_type: string
  severity: "critical" | "high" | "medium" | "low"
  scope_type: ApiOpsScopeType
  scope_id: string | null
  title: string
  message: string
  source: string
  evidence_json: Record<string, unknown>
  status: "new" | "acknowledged" | "converted" | "dismissed" | "resolved"
  dedupe_key: string
  created_at: string
  expires_at: string | null
}

export interface ApiOpsTaskEvent {
  id: number
  task_id: number
  actor_user_id: string
  event_type: string
  payload_json: Record<string, unknown>
  created_at: string
}

export interface ApiOpsTaskComment {
  id: number
  task_id: number
  actor_user_id: string
  comment: string
  created_at: string
}

export interface ApiOpsTask {
  id: number
  task_type: string
  priority: ApiOpsPriority
  status: ApiOpsTaskStatus
  title: string
  description: string | null
  scope_type: ApiOpsScopeType
  scope_id: string | null
  source_alert_id: number | null
  assignee_user_id: string | null
  assignee_role: ApiUserRole | string | null
  created_by_user_id: string
  due_at: string | null
  follow_up_at: string | null
  resolution_note: string | null
  outcome: string | null
  metadata_json: Record<string, unknown>
  closed_at: string | null
  created_at: string
  updated_at: string
  events: ApiOpsTaskEvent[]
  comments: ApiOpsTaskComment[]
}

export type ApiImprovementOutcome = "improved" | "unchanged" | "worsened" | "needs_follow_up"
export type ApiAppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show"

export interface ApiInterventionAppointment {
  id: number
  case_id: number
  task_id: number | null
  student_id: number
  created_by_user_id: string
  scheduled_at: string
  duration_minutes: number
  meeting_mode: "in_person" | "online" | "phone"
  location: string | null
  purpose: string
  note: string | null
  status: ApiAppointmentStatus
  result: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ApiAdvisorCase {
  id: number
  task_id: number | null
  student_id: number
  student_code: string | null
  student_name: string | null
  scope_type: "section" | "homeroom"
  section_id: number | null
  class_code: string | null
  priority: string
  status: string
  assignee_user_id: string | null
  follow_up_at: string | null
  is_overdue: boolean
  signal_snapshot: Record<string, unknown>
  follow_up_snapshot: Record<string, unknown>
  advisor_assessment: string | null
  advisor_conclusion: "support_needed" | "monitor" | "no_action" | null
  advisor_action_plan: string | null
  assessment_confirmed_by_user_id: string | null
  assessment_confirmed_at: string | null
  improvement_outcome: ApiImprovementOutcome | null
  appointments?: ApiInterventionAppointment[]
  events?: Array<{ id: number; event_type: string; actor_user_id: string; actor_name: string | null; payload: Record<string, unknown>; created_at: string }>
  created_at: string
  updated_at: string
  permissions: Record<string, boolean>
}

export interface ApiOpsNotification {
  id: number
  recipient_user_id: string | null
  recipient_role: ApiUserRole | string | null
  task_id: number | null
  alert_id: number | null
  notification_type: string
  title: string
  message: string
  link_url: string | null
  priority: ApiOpsPriority | string
  read_at: string | null
  created_at: string
}

type ClientEvent = {
  event_name: string
  route?: string | null
  module?: string | null
  entity_type?: string | null
  entity_id?: string | null
  status?: string | null
  duration_ms?: number | null
  payload?: Record<string, unknown>
}

const TRACE_ID_KEY = "eduinsight_trace_id"
const TRACE_ROUTE_KEY = "eduinsight_trace_route"
const REPORT_BUILD_CONTEXT_KEY = "report_build_context_v1"

export type ReportBuildContext = {
  source: string
  route: string
  scope?: {
    scope_type?: string
    scope_id?: string
    semester_id?: string | number
    period?: { from?: string; to?: string }
  }
  filters?: Record<string, string | undefined>
}

export function setReportBuildContext(context: ReportBuildContext) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(REPORT_BUILD_CONTEXT_KEY, JSON.stringify(context))
  window.dispatchEvent(new CustomEvent("report-build-context", { detail: context }))
}

export function getReportBuildContext(route?: string): ReportBuildContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(REPORT_BUILD_CONTEXT_KEY)
    if (!raw) return null
    const context = JSON.parse(raw) as ReportBuildContext
    return !route || context.route === route ? context : null
  } catch {
    return null
  }
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    const next = char === "x" ? value : (value & 0x3) | 0x8
    return next.toString(16)
  })
}

export function startPageTrace(route?: string) {
  if (typeof window === "undefined") return ""
  const nextRoute = route ?? window.location.pathname
  const traceId = randomId()
  sessionStorage.setItem(TRACE_ID_KEY, traceId)
  sessionStorage.setItem(TRACE_ROUTE_KEY, nextRoute)
  return traceId
}

export function getCurrentTraceId() {
  if (typeof window === "undefined") return randomId()
  const existing = sessionStorage.getItem(TRACE_ID_KEY)
  if (existing) return existing
  return startPageTrace(window.location.pathname)
}

function currentRoute() {
  if (typeof window === "undefined") return ""
  return window.location.pathname
}

function currentModule(route = currentRoute()) {
  // Map App Router paths to RBAC module keys (backend context_rbac allowlist).
  // `route` keeps the exact pathname for route_decision.target_route.
  if (route.includes("/manager/analytics")) return "report"
  if (route.includes("/manager/reports")) return "report"
  if (route.includes("/manager/students")) return "dashboard"
  if (route.includes("/manager/courses")) return "tree"
  if (route.includes("/chat")) return "chat"
  if (route.includes("/manager")) return "dashboard"
  if (route.includes("/tree")) return "tree"
  if (route.includes("/settings")) return "settings"
  if (route.includes("/admin")) return "admin"
  return "dashboard"
}

function pageContext(route = currentRoute()) {
  return {
    route,
    module: currentModule(route),
  }
}

/** Page context for chat requests (route + module from pathname). */
export function buildPageContext(route?: string) {
  return pageContext(route ?? currentRoute())
}

/** Map H48 target_route to an App Router path the UI actually serves. */
export function resolveChatHandoffRoute(targetRoute: string): string {
  if (targetRoute === "/chatbot" || targetRoute === "/chat") {
    return "/chat"
  }
  return targetRoute
}

export interface ApiHomeroomClassSummary {
  assignment_id: number
  class_code: string
  teacher_id: number
  teacher_name: string | null
  student_count: number
  active_students: number
  avg_gpa: number | null
  low_gpa_count: number
}

export interface ApiHomeroomStudent {
  id: number
  student_code: string
  full_name: string
  program_name: string
  gpa_cumulative: number | null
  failed_courses: number
  near_fail_courses: number
  completed_enrollments: number
  earned_credits: number
  failed_course_ids: number[]
  latest_semester: string | null
  latest_gpa: number | null
  gpa_delta: number | null
  status: string
  risk_level: "high" | "watch" | "normal"
  risk_reasons: string[]
}

export interface ApiHomeroomClassDetail extends ApiHomeroomClassSummary {
  risk_counts: { high: number; watch: number; normal: number }
  trend: {
    id: number
    semester: string
    year: number
    term: number
    student_count: number
    completed_enrollments: number
    failed_enrollments: number
    avg_gpa: number | null
    pass_rate: number
  }[]
  weak_courses: {
    id: number
    code: string
    name: string
    attempts: number
    failed: number
    fail_rate: number
    avg_grade: number | null
  }[]
  students: ApiHomeroomStudent[]
}

export interface ApiHomeroomAssignment {
  id: number
  teacher_id: number
  class_code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ApiHomeroomStudentAnalytics {
  profile: {
    id: number
    student_code: string
    full_name: string
    class_code: string
    program_name: string
    program_code: string
    cohort_code: string
    status: string
    gpa_cumulative: number | null
    email: string | null
    phone: string | null
  }
  class_benchmark: {
    class_code: string
    class_size: number
    students_with_gpa: number
    avg_gpa: number | null
    gpa_rank: number | null
  }
  kpis: {
    completed_enrollments: number
    passed_courses: number
    failed_courses: number
    near_fail_courses: number
    avg_grade: number
    pass_rate: number
    earned_credits: number
    attempted_credits: number
  }
  trend: {
    id: number
    semester: string
    semester_name: string
    year: number
    term: number
    registered_credits: number
    passed_credits: number
    failed_credits: number
    attempted_course_count: number
    passed_course_count: number
    failed_course_count: number
    gpa_semester: number | null
    avg_grade: number
    pass_rate: number
    class_avg_gpa: number | null
    class_pass_rate: number | null
  }[]
  course_results: {
    id: number
    course_id: number
    course_code: string
    course_name: string
    credits: number
    section_id: number
    semester_id: number
    semester: string
    year: number
    term: number
    final_grade: number | null
    grade_4: number | null
    is_passed: boolean | null
    attempt_number: number
    status: string
    class_avg_grade: number | null
    class_pass_rate: number | null
    grade_gap: number | null
  }[]
  weak_courses: {
    id: number
    course_id: number
    course_code: string
    course_name: string
    credits: number
    section_id: number
    semester_id: number
    semester: string
    year: number
    term: number
    final_grade: number | null
    grade_4: number | null
    is_passed: boolean | null
    attempt_number: number
    status: string
    class_avg_grade: number | null
    class_pass_rate: number | null
    grade_gap: number | null
  }[]
  competencies: {
    id: number
    code: string
    name: string
    evidence_count: number
    score: number | null
    attainment_rate: number
    class_score: number | null
    class_attainment_rate: number | null
  }[]
  risk: {
    level: "high" | "watch" | "normal"
    reasons: string[]
    recommendations: string[]
  }
}

export interface ApiInterventionContact {
  id: number
  actor_user_id: string
  actor_name: string | null
  student_id: number
  section_id: number | null
  class_code: string | null
  channel: "email" | "phone" | "meeting" | "in_person" | "other" | string
  status: "drafted" | "logged" | "emailed" | "failed" | string
  subject: string | null
  message: string | null
  note: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ApiInterventionDraft {
  subject: string
  message: string
  risk_level: "high" | "watch" | "normal"
  risk_score: number
  reasons: string[]
  recommended_actions: string[]
  source: string
}

export interface ApiAtRiskStudent {
  student_id: number
  student_code: string
  full_name: string
  program_name?: string | null
  class_code?: string | null
  email?: string | null
  phone?: string | null
  status: string
  gpa_cumulative: number | null
  fail_count: number
  near_fail_count: number
  dropout_probability: number | null
  dropout_risk_level: string | null
  risk_level: "high" | "watch" | "normal"
  risk_score: number
  reasons: string[]
  recommended_actions: string[]
  last_contacted_at: string | null
  contact_count: number
  course_fail_probability?: number | null
  course_predicted_status?: "likely_fail" | "at_risk" | "likely_pass" | string | null
  signals?: ApiRiskSignal[]
  data_confidence?: ApiDataConfidence
  credit_progress_prediction?: ApiCreditProgressPrediction | null
  case_summary?: ApiCaseSummary
  open_case?: ApiInterventionCaseRef | null
}

export interface ApiRiskSignal {
  type: "academic_rule" | "dropout_ml" | "course_failure_rule" | "credit_progress_ml" | string
  level: "high" | "watch" | "normal" | string
  label: string
  reason: string
  probability: number | null
  model_name?: string | null
  model_version?: string | null
  model_type?: string | null
  source?: string | null
  availability?: "ready" | "insufficient_data" | string | null
  component_weight_coverage?: number | null
  scored_at?: string | null
  top_factors?: unknown[]
  count?: number
}

export interface ApiDataConfidence {
  level: "high" | "medium" | "low" | string
  prediction_coverage?: number
  ml_coverage?: number
  dropout_coverage?: number
  course_risk_coverage?: number
  is_stale?: boolean
  latest_scored_at?: string | null
  warning?: string
  message?: string
}

export interface ApiCreditProgressPrediction {
  semester_id: number
  semester_code: string
  registered_credits: number
  expected_passed_credits: number
  expected_failed_credits: number
  high_risk_failed_credits: number
  risk_level: "high" | "medium" | "low" | string
  scored_at: string
  model_name: string
  model_version: string
}

export interface ApiCaseSummary {
  total?: number
  open: number
  new?: number
  monitoring?: number
  resolved?: number
  overdue?: number
}

export interface ApiInterventionCaseRef {
  id: number
  student_id: number
  status: string
  priority: string
  assignee_user_id: string | null
  follow_up_at: string | null
}

export type ApiAnalyticsDataStatus = "ready" | "partial" | "empty" | "stale"

export interface ApiPagination {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface ApiDashboardSectionRow {
  id: number
  section_code: string
  course_id: number
  course_code: string
  course_name: string
  semester_id: number
  semester_code: string
  semester_name: string
  teacher_id: number | null
  teacher_name: string | null
  student_count: number
  graded_count: number
  missing_grade_count: number
  failed_count: number
  avg_grade: number
  pass_rate: number
  prediction_coverage: number
  prediction_scored_at: string | null
  risk_level: "high" | "watch" | "normal" | "pending"
  priority_score?: number
  primary_reason?: string
  recommended_action?: string
}

export interface ApiDashboardSections {
  filters: Record<string, string | number | null>
  summary: {
    total_sections: number
    total_students: number
    needs_action_sections: number
    average_pass_rate: number
    missing_grade_count: number
    prediction_coverage: number
  }
  hierarchy: {
    level: "department" | "program" | "course"
    items: Array<{
      id: number
      code: string
      name: string
      section_count: number
      student_count: number
      pass_rate: number
      high_sections: number
      watch_sections: number
      pending_sections: number
      normal_sections: number
      needs_action_rate?: number
      priority_score?: number
      primary_reason?: string
    }>
  }
  risk_distribution: Array<{ risk_level: "high" | "watch" | "normal" | "pending"; value: number }>
  section_matrix: Array<{
    id: number
    section_code: string
    course_id: number
    course_code: string
    course_name: string
    student_count: number
    pass_rate: number
    avg_grade: number
    risk_level: "high" | "watch" | "normal" | "pending"
    prediction_coverage: number
    failed_count: number
    missing_grade_count: number
    priority_score?: number
    primary_reason?: string
    recommended_action?: string
  }>
  items: ApiDashboardSectionRow[]
  pagination: ApiPagination
  data_status: ApiAnalyticsDataStatus
  warnings: string[]
}

export interface ApiDashboardSectionStudent {
  student_id: number
  student_code: string
  full_name: string
  final_grade: number | null
  is_passed: boolean | null
  dropout_probability: number | null
  dropout_risk_level: string | null
  top_factors: unknown
  scored_at: string | null
  risk_level: "high" | "watch" | "normal" | "pending"
}

export interface ApiDashboardSectionStudents {
  items: ApiDashboardSectionStudent[]
  pagination: ApiPagination
  data_status: ApiAnalyticsDataStatus
  warnings: string[]
}

export interface ApiSectionInterventionWorklistRow {
  id: number
  section_code: string
  course_id: number
  semester_id: number
  course_code: string
  course_name: string
  department_id: number | null
  semester_code: string
  semester_name: string
  teacher_name: string | null
  student_count: number
  graded_count: number
  failed_count: number
  pass_rate: number | null
  avg_grade: number | null
  support_priority: "high" | "watch" | "normal"
  high_students: number
  watch_students: number
  students_with_signals: number
  signals: ApiRiskSignal[]
  case_summary: ApiCaseSummary
  data_confidence: ApiDataConfidence
}

export interface ApiSectionInterventionWorklist {
  summary: {
    total_sections: number
    needs_action: number
    students_with_signals: number
    open_cases: number
  }
  sections: ApiSectionInterventionWorklistRow[]
}

export interface ApiInterventionWorkspace {
  scope: Record<string, unknown>
  summary: ApiInterventionScopeSummary["summary"]
  students: ApiAtRiskStudent[]
  cases?: ApiInterventionCaseRef[]
  case_summary?: ApiCaseSummary
  data_confidence?: ApiDataConfidence
  next_action?: string
  support?: {
    scope_type: "section" | "homeroom" | string
    section_id?: number | null
    class_code?: string | null
    history?: ApiInterventionContact[]
    campaigns?: unknown
    workflow_actions?: Record<string, unknown>
  }
}

export interface ApiStudentSupportProfile {
  profile: Record<string, unknown>
  scope: { section_id?: number | null; class_code?: string | null }
  risk: {
    risk_level: "high" | "watch" | "normal" | string
    risk_score: number
    reasons: string[]
    recommended_actions: string[]
  }
  signals: {
    fail_count: number
    near_fail_count: number
    dropout_prediction?: Record<string, unknown> | null
    credit_progress_prediction?: ApiCreditProgressPrediction | null
    course_predictions: Array<{
      enrollment_id: number
      section_id: number
      section_code: string
      course_id: number
      course_code: string
      course_name: string
      credits: number
      fail_probability: number | null
      predicted_status: string | null
      explanation?: { reasons?: string[]; component_weight_coverage?: number | null; model_type?: string; availability?: string }
      scored_at: string | null
      model_type?: string | null
      source?: string | null
    }>
  }
  contact_history: ApiInterventionContact[]
  case_summary?: ApiCaseSummary
  cases?: ApiInterventionCaseRef[]
  data_confidence?: ApiDataConfidence
  next_actions: string[]
}

export interface ApiInterventionScopeSummary {
  scope: Record<string, unknown>
  summary: { total: number; high: number; watch: number; normal: number; contacted: number }
  priority_students: ApiAtRiskStudent[]
  reason_groups: Record<string, number>
  recommendations: string[]
  source: string
}

export interface ApiBulkInterventionNotifyResult {
  scope: Record<string, unknown>
  delivery_mode: "audit_only" | string
  requested: number
  created_count: number
  skipped_count: number
  created: {
    contact_id: number
    student_id: number
    student_code: string
    full_name: string
    email: string | null
    status: string
  }[]
  skipped: {
    student_id: number
    student_code: string
    full_name: string
    reason: string
  }[]
  message: string
}

export interface ApiBulkInterventionDraftResult {
  scope: Record<string, unknown>
  delivery_mode: "draft_only" | string
  draft_count: number
  skipped_count: number
  drafts: {
    student_id: number
    student_code: string
    full_name: string
    email: string
    risk_level: "high" | "watch" | "normal"
    risk_score: number
    subject: string
    message: string
    reasons: string[]
    recommended_actions: string[]
  }[]
  skipped: {
    student_id: number
    student_code: string
    full_name: string
    reason: string
  }[]
  message: string
}

export interface ApiInterventionMessage {
  id: number
  campaign_id: number
  student_id: number
  student_code: string | null
  full_name: string | null
  contact_id: number | null
  channel: "email" | "phone" | "meeting" | "in_person" | "other" | string
  recipient_email: string | null
  subject: string | null
  body: string | null
  template_key: string | null
  template_version: string | null
  status: "drafted" | "approved" | "queued" | "sent" | "failed" | "cancelled" | string
  approved_by_user_id: string | null
  approved_at: string | null
  sent_at: string | null
  provider_message_id: string | null
  error_code: string | null
  error_message: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ApiInterventionCampaign {
  id: number
  actor_user_id: string
  actor_name: string | null
  scope_type: "section" | "homeroom" | string
  section_id: number | null
  class_code: string | null
  title: string
  objective: "early_support" | "course_recovery" | "advisor_checkin" | string
  status: "draft" | "reviewing" | "approved" | "sending" | "completed" | "cancelled" | string
  source: "agent" | "manual" | string
  summary_json: Record<string, unknown>
  created_at: string
  updated_at: string
  messages: ApiInterventionMessage[]
  delivery_mode?: string
  created_contact_count?: number
  sent_count?: number
  queued_count?: number
  failed_count?: number
  message?: string
}

export interface ApiCampaignDeliveryStatus {
  configured: boolean
  delivery_mode: "smtp" | "smtp_not_configured" | string
  smtp_host: string | null
  smtp_port: number
  from_email: string | null
  from_name: string
  missing: string[]
}

function isApiError(err: unknown, statusCode: number, detail?: string) {
  if (!(err instanceof Error)) return false
  const statusMatch = err.message.includes(`API ${statusCode}`)
  return statusMatch && (!detail || err.message.includes(detail))
}

async function fetcher<T>(input: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  const method = (init?.method ?? "GET").toUpperCase()
  const cacheKey = token ? `${method}:${input}:${token.slice(-16)}` : `${method}:${input}`
  if (method === "GET") {
    const cached = getApiCache<T>(cacheKey)
    if (cached !== undefined) return cached
    const inFlight = getApiInFlight<T>(cacheKey)
    if (inFlight) return inFlight
  } else {
    clearApiReadCache()
  }
  const customInit = { ...init }
  customInit.headers = {
    ...customInit.headers,
    "ngrok-skip-browser-warning": "true",
    "x-trace-id": getCurrentTraceId(),
    "x-page-route": currentRoute(),
    "x-page-context": JSON.stringify(pageContext()),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const request = fetch(input, customInit)
    .then(async (response) => {
  if (response.status === 204) {
    return null as T
  }
  const text = await response.text()
  const contentType = response.headers.get("content-type") || ""
  const data = contentType.includes("application/json") && text ? JSON.parse(text) : text

  if (!response.ok) {
    throw new Error(
      `API ${response.status} ${response.statusText}: ${typeof data === "string" ? data : JSON.stringify(data)}`
    )
  }

      if (method === "GET") setApiCache(cacheKey, data as T)
      return data as T
    })
    .finally(() => {
      if (method === "GET") apiInFlight.delete(cacheKey)
    })

  if (method === "GET") apiInFlight.set(cacheKey, request as Promise<unknown>)
  return request
}

const USER_CACHE_KEY = "current_user_cache_v1"
const USER_CACHE_TTL_MS = 10 * 60_000
let meInFlight: Promise<ApiUser> | null = null
const API_CACHE_TTL_MS = 10 * 60_000
const apiCache = new Map<string, { expiresAt: number; value: unknown }>()
const apiInFlight = new Map<string, Promise<unknown>>()

function getApiCache<T>(key: string): T | undefined {
  const cached = apiCache.get(key)
  if (!cached) return undefined
  if (Date.now() > cached.expiresAt) {
    apiCache.delete(key)
    return undefined
  }
  return cached.value as T
}

function setApiCache<T>(key: string, value: T) {
  apiCache.set(key, { expiresAt: Date.now() + API_CACHE_TTL_MS, value })
}

function getApiInFlight<T>(key: string): Promise<T> | null {
  const request = apiInFlight.get(key)
  return request ? (request as Promise<T>) : null
}

function clearApiReadCache() {
  apiCache.clear()
}

/**
 * Invalidate cached GET responses for a specific path prefix. Chat streaming
 * bypasses the GET cache but still needs to force a refresh of related GETs
 * (e.g. `/api/v1/chat/sessions`) so the sidebar reflects the newly created
 * or updated session after `session_created` / `done` events.
 */
export function invalidateApiCacheByPrefix(pathPrefix: string) {
  for (const key of apiCache.keys()) {
    // Cache keys have the form `${METHOD}:${path}:${tokenSuffix?}` — match on
    // the path segment so we invalidate regardless of token.
    if (key.includes(`:${pathPrefix}`)) {
      apiCache.delete(key)
    }
  }
}

export function saveAccessToken(token: string) {
  meInFlight = null
  clearApiReadCache()
  apiInFlight.clear()
  localStorage.setItem("access_token", token)
  sessionStorage.removeItem(USER_CACHE_KEY)
  localStorage.removeItem(USER_CACHE_KEY)
}

export function clearAccessToken() {
  meInFlight = null
  clearApiReadCache()
  apiInFlight.clear()
  localStorage.removeItem("access_token")
  sessionStorage.removeItem(USER_CACHE_KEY)
  localStorage.removeItem(USER_CACHE_KEY)
}

export function getAccessToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : null
}

function isApiUser(value: unknown): value is ApiUser {
  return Boolean(
    value
    && typeof value === "object"
    && "id" in value
    && "email" in value
    && "role" in value
  )
}

export function getCachedCurrentUser(): ApiUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY) ?? localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && "user" in parsed) {
      const wrapped = parsed as { cached_at?: number; token_suffix?: string; user?: unknown }
      const tokenSuffix = getAccessToken()?.slice(-16)
      if (
        !wrapped.cached_at
        || !tokenSuffix
        || wrapped.token_suffix !== tokenSuffix
        || Date.now() - wrapped.cached_at > USER_CACHE_TTL_MS
      ) {
        sessionStorage.removeItem(USER_CACHE_KEY)
        localStorage.removeItem(USER_CACHE_KEY)
        return null
      }
      if (isApiUser(wrapped.user)) {
        sessionStorage.setItem(USER_CACHE_KEY, raw)
        return wrapped.user
      }
      return null
    }
    return isApiUser(parsed) ? parsed : null
  } catch {
    sessionStorage.removeItem(USER_CACHE_KEY)
    localStorage.removeItem(USER_CACHE_KEY)
    return null
  }
}

function setCachedCurrentUser(user: ApiUser) {
  if (typeof window !== "undefined") {
    const tokenSuffix = getAccessToken()?.slice(-16)
    if (!tokenSuffix) return
    const payload = JSON.stringify({ cached_at: Date.now(), token_suffix: tokenSuffix, user })
    sessionStorage.setItem(USER_CACHE_KEY, payload)
    localStorage.setItem(USER_CACHE_KEY, payload)
  }
}

export function getCurrentUserCached() {
  const cachedUser = getCachedCurrentUser()
  if (cachedUser) return Promise.resolve(cachedUser)

  return getCurrentUserFresh()
}

export function getCurrentUserFresh() {
  if (!meInFlight) {
    const requestedToken = getAccessToken()
    meInFlight = fetcher<ApiUser>("/api/v1/auth/me")
      .then((user) => {
        if (getAccessToken() === requestedToken) setCachedCurrentUser(user)
        return user
      })
      .finally(() => {
        meInFlight = null
      })
  }
  return meInFlight
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&")
  return q ? `?${q}` : ""
}

export const api = {
  // --- Observability ---
  trackEvent: (event: ClientEvent) =>
    fetcher<{ status: string }>("/api/v1/observability/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...event,
        route: event.route ?? currentRoute(),
        module: event.module ?? currentModule(),
        payload: event.payload ?? {},
      }),
    }),

  // --- Operational alerts / tasks / notifications ---
  getAlerts: (params?: { status?: string; severity?: string; scope_type?: string; limit?: number }) =>
    fetcher<ApiOpsAlert[]>(`/api/v1/alerts${qs(params ?? {})}`),
  acknowledgeAlert: (id: number) =>
    fetcher<ApiOpsAlert>(`/api/v1/alerts/${id}/acknowledge`, { method: "POST" }),
  dismissAlert: (id: number) =>
    fetcher<ApiOpsAlert>(`/api/v1/alerts/${id}/dismiss`, { method: "POST" }),
  convertAlertToTask: (id: number) =>
    fetcher<ApiOpsTask>(`/api/v1/alerts/${id}/convert-to-task`, { method: "POST" }),
  generateAlerts: (kind?: "student-risk" | "section-risk" | "course-risk" | "outcome-risk" | "data-quality" | "system") =>
    fetcher<{ status: string; kind: string; created: number }>(
      `/api/v1/admin/alerts/generate${kind ? `/${kind}` : ""}`,
      { method: "POST" },
    ),
  getTasks: (params?: { status?: string; priority?: string; scope_type?: string; assignee?: string; overdue?: boolean; limit?: number }) =>
    fetcher<ApiOpsTask[]>(`/api/v1/tasks${qs(params ?? {})}`),
  getMyTasks: () =>
    fetcher<ApiOpsTask[]>("/api/v1/tasks/my"),
  getTask: (id: number) =>
    fetcher<ApiOpsTask>(`/api/v1/tasks/${id}`),
  createTask: (body: {
    task_type: string
    priority?: ApiOpsPriority
    title: string
    description?: string | null
    scope_type: ApiOpsScopeType
    scope_id?: string | null
    source_alert_id?: number | null
    assignee_user_id?: string | null
    assignee_role?: string | null
    due_at?: string | null
    follow_up_at?: string | null
    metadata_json?: Record<string, unknown>
  }) =>
    fetcher<ApiOpsTask>("/api/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateTask: (id: number, body: Partial<{
    priority: ApiOpsPriority
    status: ApiOpsTaskStatus
    title: string
    description: string | null
    due_at: string | null
    follow_up_at: string | null
    assignee_user_id: string | null
    assignee_role: string | null
    metadata_json: Record<string, unknown>
  }>) =>
    fetcher<ApiOpsTask>(`/api/v1/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  assignTask: (id: number, body: { assignee_user_id: string; due_at?: string | null }) =>
    fetcher<ApiOpsTask>(`/api/v1/tasks/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  addTaskComment: (id: number, comment: string) =>
    fetcher<ApiOpsTask>(`/api/v1/tasks/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    }),
  setTaskFollowUp: (id: number, body: { follow_up_at: string; note?: string | null }) =>
    fetcher<ApiOpsTask>(`/api/v1/tasks/${id}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getAdvisorCases: (params?: { status?: string; priority?: string; scope_type?: "section" | "homeroom"; student_id?: number; overdue?: boolean }) =>
    fetcher<ApiAdvisorCase[]>(`/api/v1/interventions/cases${qs(params ?? {})}`),
  syncAdvisorCases: (maxCases = 100) =>
    fetcher<{ created: number; skipped_existing: number; message: string }>(`/api/v1/interventions/cases/sync-risk-signals?max_cases=${maxCases}`, { method: "POST" }),
  getAdvisorCase: (id: number) =>
    fetcher<ApiAdvisorCase>(`/api/v1/interventions/cases/${id}`),
  saveAdvisorAssessment: (id: number, body: {
    assessment: string
    conclusion: "support_needed" | "monitor" | "no_action"
    action_plan?: string | null
    confirm?: boolean
  }) => fetcher<ApiAdvisorCase>(`/api/v1/interventions/cases/${id}/assessment`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  recordAdvisorFollowUp: (id: number, body: { outcome: ApiImprovementOutcome; note?: string | null }) =>
    fetcher<ApiAdvisorCase>(`/api/v1/interventions/cases/${id}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  createBulkStudentNotice: (body: { case_ids: number[]; title: string; message: string }) =>
    fetcher<{ created_count: number; message: string }>("/api/v1/interventions/bulk-notice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getInterventionAppointments: (params?: { case_id?: number; student_id?: number; upcoming?: boolean }) =>
    fetcher<ApiInterventionAppointment[]>(`/api/v1/interventions/appointments${qs(params ?? {})}`),
  createInterventionAppointment: (caseId: number, body: {
    scheduled_at: string
    duration_minutes?: number
    meeting_mode?: "in_person" | "online" | "phone"
    location?: string | null
    purpose: string
    note?: string | null
  }) => fetcher<ApiInterventionAppointment>(`/api/v1/interventions/cases/${caseId}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  updateInterventionAppointment: (id: number, body: Partial<{
    scheduled_at: string
    duration_minutes: number
    meeting_mode: "in_person" | "online" | "phone"
    location: string | null
    purpose: string
    note: string | null
    status: ApiAppointmentStatus
    result: string | null
  }>) => fetcher<ApiInterventionAppointment>(`/api/v1/interventions/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  closeTask: (id: number, body: { resolution_note: string; outcome?: string | null; status?: "resolved" | "closed" }) =>
    fetcher<ApiOpsTask>(`/api/v1/tasks/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getNotifications: (params?: { unread_only?: boolean; limit?: number }) =>
    fetcher<ApiOpsNotification[]>(`/api/v1/notifications${qs(params ?? {})}`),
  getUnreadNotificationCount: () =>
    fetcher<{ unread: number }>("/api/v1/notifications/unread-count"),
  markNotificationRead: (id: number) =>
    fetcher<ApiOpsNotification>(`/api/v1/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    fetcher<{ read: number }>("/api/v1/notifications/read-all", { method: "POST" }),

  // --- Auth ---
  login: async (body: { email: string; password: string }) => {
    const form = new URLSearchParams()
    form.set("username", body.email)
    form.set("password", body.password)
    const result = await fetcher<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })
    saveAccessToken(result.access_token)
    return result
  },
  me: getCurrentUserCached,
  meFresh: getCurrentUserFresh,
  getUsers: (params?: { limit?: number; skip?: number }) =>
    fetcher<ApiUser[]>(`/api/v1/auth/users${qs({ limit: params?.limit, skip: params?.skip })}`),
  createUser: (body: {
    email: string
    password: string
    full_name: string
    role: ApiUserRole
    position?: string | null
    department_id?: number | null
  }) =>
    fetcher<ApiUser>("/api/v1/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateUser: (id: string, body: Partial<Pick<ApiUser, "full_name" | "role" | "position" | "department_id" | "is_active">>) =>
    fetcher<ApiUser>(`/api/v1/auth/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  // --- Reports ---
  getReports: (params?: { limit?: number; date_from?: string; date_to?: string; report_type?: string; scope_type?: string; scope_id?: string }) =>
    fetcher<ApiReport[]>(`/api/v1/reports${qs(params ?? {})}`),
  getReport: (id: string) =>
    fetcher<ApiReport>(`/api/v1/reports/${id}`),
  generateReport: (body: { report_type: ApiReportType; actor_role?: string; scope_type?: string; scope_id?: string; semester_id?: number; period_start?: string; period_end?: string }) =>
    fetcher<ApiReport>("/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getReportSchedules: (params?: { active_only?: boolean; limit?: number }) =>
    fetcher<ApiReportSchedule[]>(`/api/v1/reports/schedules${qs({ active_only: params?.active_only ? "true" : undefined, limit: params?.limit })}`),
  createReportSchedule: (body: ApiReportScheduleCreate) =>
    fetcher<ApiReportSchedule>("/api/v1/reports/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  runReportSchedule: (
    id: number,
    body: { trigger?: "manual" | "scheduled" | "grade_update" | "midterm_grade" | "final_grade" },
  ) =>
    fetcher<ApiReportScheduleRun>(`/api/v1/reports/schedules/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  createReportFeedback: (id: string, body: { rating?: number; is_helpful?: boolean; comment?: string }) =>
    fetcher<ApiReportFeedback>(`/api/v1/reports/${id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  // --- Students ---
  getStudents: (params?: { limit?: number; offset?: number; program_id?: number; cohort_id?: number }) =>
    fetcher<ApiStudent[]>(`/api/v1/students${qs(params ?? {})}`),
  getStudentByCode: (studentCode: string) =>
    fetcher<ApiStudent>(`/api/v1/students/by-code/${encodeURIComponent(studentCode)}`),
  getDropoutRisk: async (studentId: number): Promise<ApiDropoutRisk | null> => {
    try {
      return await fetcher<ApiDropoutRisk>(`/api/v1/predictions/students/${studentId}/dropout-risk`)
    } catch (err: unknown) {
      if (isApiError(err, 404, "Dropout prediction not found")) {
        try {
          return await fetcher<ApiDropoutRisk>(`/api/v1/predictions/students/${studentId}/dropout-risk/predict`, {
            method: "POST"
          })
        } catch (predictErr: unknown) {
          if (isApiError(predictErr, 404, "No completed dropout model run found")) {
            return null
          }
          throw predictErr
        }
      }
      if (isApiError(err, 404, "No completed dropout model run found")) {
        return null
      }
      throw err
    }
  },
  getStudentSemesterPrediction: (studentId: number, semesterId: number) =>
    fetcher<any>(`/api/v1/predictions/students/${studentId}/semesters/${semesterId}`),
  getStudentSemesterEnrollmentPredictions: (studentId: number, semesterId: number) =>
    fetcher<any[]>(`/api/v1/predictions/students/${studentId}/semesters/${semesterId}/enrollments`),

  createStudent: (body: { student_code: string; full_name: string; program_id: number; cohort_id: number; gender?: string; class_code?: string; status?: string }) =>
    fetcher<ApiStudent>("/api/v1/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateStudent: (id: number, body: Partial<{ full_name: string; gender: string; class_code: string; status: string }>) =>
    fetcher<ApiStudent>(`/api/v1/students/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteStudent: (id: number) =>
    fetcher<void>(`/api/v1/students/${id}`, { method: "DELETE" }),
  getStudentTokenData: async (params?: { department_id?: number; program_id?: number }) => {
    void params
    // Return mock data for now as backend might not have this endpoint yet
    return {
      total_students: 1200,
      active_students: 1150,
      demographics: { male: 600, female: 500, other: 50 },
      enrollment_status: { "Đang học": 1150, "Bảo lưu": 30, "Thôi học": 20 }
    } as ApiStudentTokenData
  },

  // --- Cohorts ---
  getCohorts: (params?: { limit?: number }) =>
    fetcher<ApiCohort[]>(`/api/v1/cohorts${qs(params ?? {})}`),

  // --- Departments ---
  getDepartments: (params?: { limit?: number }) =>
    fetcher<ApiDepartment[]>(`/api/v1/departments${qs(params ?? {})}`),
  createDepartment: (body: { university_id: number; code: string; name: string; description?: string }) =>
    fetcher<ApiDepartment>("/api/v1/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateDepartment: (id: number, body: Partial<{ name: string; description: string }>) =>
    fetcher<ApiDepartment>(`/api/v1/departments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteDepartment: (id: number) =>
    fetcher<void>(`/api/v1/departments/${id}`, { method: "DELETE" }),

  // --- Programs ---
  getPrograms: (params?: { limit?: number; department_id?: number }) =>
    fetcher<ApiProgram[]>(`/api/v1/programs${qs(params ?? {})}`),
  createProgram: (body: { department_id: number; code: string; name: string; description?: string }) =>
    fetcher<ApiProgram>("/api/v1/programs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateProgram: (id: number, body: Partial<{ name: string; description: string }>) =>
    fetcher<ApiProgram>(`/api/v1/programs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteProgram: (id: number) =>
    fetcher<void>(`/api/v1/programs/${id}`, { method: "DELETE" }),

  // --- Courses ---
  getCourses: (params?: { limit?: number; program_id?: number }) =>
    fetcher<ApiCourse[]>(`/api/v1/courses${qs(params ?? {})}`),
  createCourse: (body: { code: string; name: string; credits: number; program_ids: number[]; description?: string }) =>
    fetcher<ApiCourse>("/api/v1/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateCourse: (id: number, body: Partial<{ name: string; credits: number; description: string; is_active: boolean }>) =>
    fetcher<ApiCourse>(`/api/v1/courses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteCourse: (id: number) =>
    fetcher<void>(`/api/v1/courses/${id}`, { method: "DELETE" }),

  getEnrollments: (params?: { student_id?: number; section_id?: number; course_id?: number; program_id?: number; semester_id?: number; date_from?: string; date_to?: string; limit?: number }) =>
    fetcher<ApiEnrollment[]>(`/api/v1/grades/enrollments${qs(params ?? {})}`),
  getGradeComponents: (params?: { enrollment_id?: number; section_id?: number; limit?: number }) =>
    fetcher<ApiGradeComponent[]>(`/api/v1/grades/components${qs(params ?? {})}`),
  importGrades: (rows: ApiGradeImportRow[]) =>
    fetcher<ApiGradeImportResult>("/api/v1/grades/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    }),
  getGrades: async (params?: { limit?: number }) => {
    const enrolls = await fetcher<ApiEnrollment[]>(`/api/v1/grades/enrollments${qs({ limit: params?.limit ?? 3000 })}`)
    return enrolls.map(e => ({
      id: String(e.id),
      studentId: String(e.student_id),
      tenMonHoc: "",
      maLop: "",
      tinChi: 0,
      diemTX1: null,
      diemTX2: null,
      diemTX3: null,
      diemTX4: null,
      tbThuongKy: null,
      duocDuThi: true,
      diemThiLan1: null,
      diemThiLan2: null,
      diemTongKet: e.final_grade,
      xepLoai: e.grade_letter ?? (e.is_passed ? "C" : "F"),
      ghiChu: "",
      hocKy: "",
    }))
  },

  // --- Sections ---
  getSections: (params?: { limit?: number; course_id?: number; semester_id?: number; teacher_id?: number }) =>
    fetcher<ApiSection[]>(`/api/v1/sections${qs(params ?? {})}`),
  getDashboardSections: (params?: {
    semester_code?: string; department_id?: number; program_id?: number; course_id?: number; section_id?: number
    teacher_id?: number; q?: string; date_from?: string; date_to?: string; risk_level?: string; sort?: string
    limit?: number; offset?: number
  }) => fetcher<ApiDashboardSections>(`/api/v1/analytics/dashboard/sections${qs(params ?? {})}`),
  getDashboardSection: (sectionId: number) =>
    fetcher<{ item: ApiDashboardSectionRow; data_status: ApiAnalyticsDataStatus; warnings: string[] }>(
      `/api/v1/analytics/dashboard/sections/${sectionId}`,
    ),
  getDashboardSectionStudents: (sectionId: number, params?: { risk_level?: string; limit?: number; offset?: number }) =>
    fetcher<ApiDashboardSectionStudents>(`/api/v1/analytics/dashboard/sections/${sectionId}/students${qs(params ?? {})}`),

  // --- Homeroom / academic-advisor classes ---
  getHomeroomClasses: () => fetcher<ApiHomeroomClassSummary[]>("/api/v1/homeroom/classes"),
  getHomeroomClass: (classCode: string) =>
    fetcher<ApiHomeroomClassDetail>(`/api/v1/homeroom/classes/${encodeURIComponent(classCode)}`),
  getHomeroomStudentAnalytics: (studentId: number) =>
    fetcher<ApiHomeroomStudentAnalytics>(`/api/v1/homeroom/students/${studentId}/analytics`),
  getHomeroomAssignments: () => fetcher<ApiHomeroomAssignment[]>("/api/v1/homeroom/assignments"),
  createHomeroomAssignment: (body: { teacher_id: number; class_code: string }) =>
    fetcher<ApiHomeroomAssignment>("/api/v1/homeroom/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteHomeroomAssignment: (id: number) =>
    fetcher<void>(`/api/v1/homeroom/assignments/${id}`, { method: "DELETE" }),

  // --- Learning support / interventions ---
  getSectionAtRiskStudents: (sectionId: number) =>
    fetcher<{ scope: Record<string, unknown>; summary: ApiInterventionScopeSummary["summary"]; students: ApiAtRiskStudent[] }>(
      `/api/v1/interventions/sections/${sectionId}/at-risk-students`,
    ),
  getSectionInterventionWorklist: (params?: {
    semester_code?: string
    department_id?: number
    program_id?: number
    course_id?: number
    limit?: number
  }) => fetcher<ApiSectionInterventionWorklist>(`/api/v1/interventions/sections/worklist${qs(params ?? {})}`),
  getSectionInterventionWorkspace: (sectionId: number) =>
    fetcher<ApiInterventionWorkspace>(`/api/v1/interventions/sections/${sectionId}/workspace`),
  getHomeroomAtRiskStudents: (classCode: string) =>
    fetcher<{ scope: Record<string, unknown>; summary: ApiInterventionScopeSummary["summary"]; students: ApiAtRiskStudent[] }>(
      `/api/v1/interventions/homeroom/${encodeURIComponent(classCode)}/at-risk-students`,
    ),
  getHomeroomInterventionWorkspace: (classCode: string) =>
    fetcher<ApiInterventionWorkspace>(`/api/v1/interventions/homeroom/${encodeURIComponent(classCode)}/workspace`),
  getStudentSupportProfile: async (studentId: number, params?: { section_id?: number; class_code?: string }) => {
    try {
      return await fetcher<ApiStudentSupportProfile>(
        `/api/v1/interventions/students/${studentId}/support-profile${qs(params ?? {})}`,
      )
    } catch (err) {
      if (isApiError(err, 403) || isApiError(err, 404)) return null
      throw err
    }
  },
  getInterventionHistory: (studentId: number, params?: { section_id?: number; class_code?: string }) =>
    fetcher<ApiInterventionContact[]>(`/api/v1/interventions/students/${studentId}/history${qs(params ?? {})}`),
  summarizeInterventionScope: (body: { scope_type: "section" | "homeroom"; scope_id?: number | null; class_code?: string | null }) =>
    fetcher<ApiInterventionScopeSummary>("/api/v1/interventions/ai/summarize-scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  createSection: (body: {
    course_id: number
    semester_id: number
    section_code: string
    teacher_id?: number | null
    room?: string | null
    schedule?: string | null
    max_students?: number | null
    is_active?: boolean
  }) =>
    fetcher<ApiSection>("/api/v1/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateSection: (id: number, body: Partial<{
    teacher_id: number | null
    room: string | null
    schedule: string | null
    max_students: number | null
    is_active: boolean
  }>) =>
    fetcher<ApiSection>(`/api/v1/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteSection: (id: number) =>
    fetcher<void>(`/api/v1/sections/${id}`, { method: "DELETE" }),

  // --- Teachers ---
  getTeachers: (params?: { limit?: number; department_id?: number }) =>
    fetcher<ApiTeacher[]>(`/api/v1/teachers${qs(params ?? {})}`),
  createTeacher: (body: {
    department_id: number
    code?: string | null
    full_name: string
    email?: string | null
    phone?: string | null
    academic_title?: string | null
    specialization?: string | null
    is_active?: boolean
    create_account?: boolean
    login_password?: string | null
  }) =>
    fetcher<ApiTeacher>("/api/v1/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateTeacher: (id: number, body: Partial<{
    department_id: number
    code: string | null
    full_name: string
    email: string | null
    phone: string | null
    academic_title: string | null
    specialization: string | null
    is_active: boolean
  }>) =>
    fetcher<ApiTeacher>(`/api/v1/teachers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteTeacher: (id: number) =>
    fetcher<void>(`/api/v1/teachers/${id}`, { method: "DELETE" }),
  provisionTeacherAccount: (id: number, body: { email?: string | null; password: string }) =>
    fetcher<{ teacher_id: number; user_id: string; email: string; role: ApiUserRole }>(`/api/v1/teachers/${id}/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  // --- Semesters ---
  getSemesters: () =>
    fetcher<ApiSemester[]>('/api/v1/semesters'),

  // --- Analytics ---
  getCourseHealth: (id: number) =>
    fetcher<ApiHealthScore>(`/api/v1/analytics/health/course/${id}`),
  getCourseHealthBatch: (course_ids?: number[]) =>
    fetcher<ApiHealthScore[]>(`/api/v1/analytics/health/courses/batch${course_ids && course_ids.length > 0 ? '?' + course_ids.map(id => `course_ids=${id}`).join('&') : ''}`),
  getProgramHealth: (id: number) =>
    fetcher<ApiHealthScore>(`/api/v1/analytics/health/program/${id}`),
  getDepartmentHealth: (id: number) =>
    fetcher<ApiHealthScore>(`/api/v1/analytics/health/department/${id}`),
  getDashboardOverview: (params?: { semester_code?: string; department_id?: number; date_from?: string; date_to?: string }) =>
    fetcher<ApiDashboardOverview>(`/api/v1/analytics/dashboard/overview${qs(params ?? {})}`),
  getDashboardDepartments: (params?: { semester_code?: string; department_id?: number; program_id?: number; date_from?: string; date_to?: string }) =>
    fetcher<ApiDashboardDepartments>(`/api/v1/analytics/dashboard/departments${qs(params ?? {})}`),
  getDashboardOutcomes: (params?: { semester_code?: string; department_id?: number; program_id?: number; plo_id?: number; min_evidence?: number; date_from?: string; date_to?: string }) =>
    fetcher<ApiDashboardOutcomes>(`/api/v1/analytics/dashboard/outcomes${qs(params ?? {})}`),
  getDashboardProgram: (id: number, params?: { semester_code?: string; cohort_id?: number; date_from?: string; date_to?: string }) =>
    fetcher<ApiDashboardProgram>(`/api/v1/analytics/dashboard/programs/${id}${qs(params ?? {})}`),
  getDashboardCourses: (params?: { semester_code?: string; department_id?: number; program_id?: number; date_from?: string; date_to?: string }) =>
    fetcher<ApiDashboardCourses>(`/api/v1/analytics/dashboard/courses${qs(params ?? {})}`),
  getDashboardCourse: (id: number, params?: { semester_code?: string; department_id?: number; program_id?: number; date_from?: string; date_to?: string }) =>
    fetcher<ApiDashboardCourses>(`/api/v1/analytics/dashboard/courses/${id}${qs(params ?? {})}`),
  getTree: () =>
    fetcher<ApiTreeNode>("/api/v1/tree"),

  // --- Chat ---
  chat: (body: ChatRequest) =>
    fetcher<ChatResponse>("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getChatSessions: () =>
    fetcher<ChatSessionSummary[]>("/api/v1/chat/sessions"),
  getChatSessionById: (thread_id: string) =>
    fetcher<ChatSessionDetail>(`/api/v1/chat/sessions/${thread_id}`),
  deleteChatSession: (thread_id: string) =>
    fetcher<void>(`/api/v1/chat/sessions/${thread_id}`, { method: "DELETE" }),

  // --- Report Agent ---
  askReportAgent: (body: { message: string; session_id?: string; report_id?: string; mode?: ApiReportAgentMode; context?: Record<string, unknown> }) =>
    fetcher<ApiReportAgentAskResponse>("/api/v1/report-agent/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  planReportBuild: (body: { message: string; session_id?: string; context?: Record<string, unknown> }) =>
    fetcher<ApiReportBuildPlan>("/api/v1/report-agent/build/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  confirmReportAgentAction: (id: string, body: { action: "confirm" | "cancel" }) =>
    fetcher<{ id: string; status: string; result: Record<string, unknown> }>(`/api/v1/report-agent/tools/confirm/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),

  // --- Observability Admin ---
  getObservabilityEvents: (params?: {
    user_id?: string
    session_id?: string
    trace_id?: string
    event_name?: string
    status?: string
    route?: string
    module?: string
    from?: string
    to?: string
    skip?: number
    limit?: number
  }) => fetcher<ApiObservabilityEventList>(`/api/v1/observability/admin/events${qs(params ?? {})}`),

  getObservabilitySessions: (params?: {
    user_id?: string
    session_id?: string
    trace_id?: string
    event_name?: string
    status?: string
    route?: string
    module?: string
    from?: string
    to?: string
    skip?: number
    limit?: number
  }) => fetcher<ApiObservabilitySessionList>(`/api/v1/observability/admin/sessions${qs(params ?? {})}`),

  getObservabilityUserAggregates: (params?: {
    user_id?: string
    session_id?: string
    trace_id?: string
    event_name?: string
    status?: string
    route?: string
    module?: string
    from?: string
    to?: string
    skip?: number
    limit?: number
  }) => fetcher<ApiObservabilityUserAggregateList>(`/api/v1/observability/admin/users/aggregates${qs(params ?? {})}`),
}

export interface RouteDecisionPayload {
  mode: "inline" | "full_chat"
  target_route: string
  reason: string
  preserve_context: boolean
}

export type SSEEvent =
  | { type: "router"; intent: string; intent_category?: string; complexity?: string }
  | { type: "route_decision"; route_decision: RouteDecisionPayload }
  | { type: "tool_call"; tool: string; input: unknown }
  | { type: "tool_result"; output: string }
  | { type: "token"; content: string }
  | { type: "done"; latency_ms: number; thread_id?: string }
  | { type: "error"; message: string }
  | { type: "session_created"; thread_id: string; title: string }

export async function* chatStreamV2(
  body: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  console.log("chatStreamV2 called. Token present:", !!token)
  const payload: ChatRequest = {
    ...body,
    context: { ...buildPageContext(), ...(body.context ?? {}) },
  }
  const res = await fetch("/api/v1/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "x-trace-id": getCurrentTraceId(),
      "x-page-route": currentRoute(),
      "x-page-context": JSON.stringify(pageContext()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n\n")
    buffer = lines.pop() ?? ""

    for (const block of lines) {
      for (const line of block.split("\n")) {
        if (!line.startsWith("data: ")) continue
        try {
          yield JSON.parse(line.slice(6)) as SSEEvent
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    }
  }
}
