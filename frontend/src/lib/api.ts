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
  dept_stats: { id: number; name: string; short_name: string; student_count: number; pass_rate: number; avg_grade: number; at_risk: number }[]
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

export function saveAccessToken(token: string) {
  localStorage.setItem("access_token", token)
  sessionStorage.removeItem(USER_CACHE_KEY)
  localStorage.removeItem(USER_CACHE_KEY)
}

export function clearAccessToken() {
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
      const wrapped = parsed as { cached_at?: number; user?: unknown }
      if (!wrapped.cached_at || Date.now() - wrapped.cached_at > USER_CACHE_TTL_MS) {
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
    const payload = JSON.stringify({ cached_at: Date.now(), user })
    sessionStorage.setItem(USER_CACHE_KEY, payload)
    localStorage.setItem(USER_CACHE_KEY, payload)
  }
}

export function getCurrentUserCached() {
  const cachedUser = getCachedCurrentUser()
  if (cachedUser) return Promise.resolve(cachedUser)

  if (!meInFlight) {
    meInFlight = fetcher<ApiUser>("/api/v1/auth/me")
      .then((user) => {
        setCachedCurrentUser(user)
        return user
      })
      .finally(() => {
        meInFlight = null
      })
  }
  return meInFlight
}

function qs(params: Record<string, string | number | undefined>): string {
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
  getUsers: (params?: { limit?: number; skip?: number }) =>
    fetcher<ApiUser[]>(`/api/v1/auth/users${qs({ limit: params?.limit, skip: params?.skip })}`),
  createUser: (body: {
    email: string
    password: string
    full_name: string
    role: ApiUserRole
    department_id?: number | null
  }) =>
    fetcher<ApiUser>("/api/v1/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateUser: (id: string, body: Partial<Pick<ApiUser, "full_name" | "role" | "department_id" | "is_active">>) =>
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
      const error = err as Error
      if (error.message && error.message.includes("404")) {
        return fetcher<ApiDropoutRisk>(`/api/v1/predictions/students/${studentId}/dropout-risk/predict`, {
          method: "POST"
        })
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
    fetcher<{ teacher_id: number; user_id: string; email: string; role: "lecturer" }>(`/api/v1/teachers/${id}/account`, {
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
  getDashboardProgram: (id: number, params?: { semester_code?: string; cohort_id?: number; date_from?: string; date_to?: string }) =>
    fetcher<ApiDashboardProgram>(`/api/v1/analytics/dashboard/programs/${id}${qs(params ?? {})}`),
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
