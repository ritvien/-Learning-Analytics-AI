// API types matching backend response shapes
export interface ApiStudent {
  id: number
  student_code: string
  full_name: string
  gender: string | null
  class_code: string | null
  status: string
  program_id: number
  cohort_id: number
  gpa_cumulative: number | null
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
  attempt_number: number
  status: string
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
  code: string | null
  full_name: string
  email: string | null
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

export interface LoginResponse {
  access_token: string
  token_type: "bearer"
}

export type ApiReportType = "school_overview" | "program_health" | "section_intervention"

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
  created_at: string
  feedback_items: ApiReportFeedback[]
}

export interface ApiPloAttainment {
  plo_id: number
  code: string
  name: string
  description: string | null
  assessed_students: number
  avg_score: number
  achieved_students: number
  attainment_rate: number
  evidence_count: number
}

export interface ApiCloAttainment {
  clo_id: number
  code: string
  name: string
  description: string | null
  course_id: number
  assessed_enrollments: number
  avg_score: number | null
  achieved_enrollments: number
  attainment_rate: number | null
  evidence_count: number
}

export interface ApiOutcomeGap {
  scope_type: "plo" | "clo"
  id: number
  code: string
  name: string
  parent_code: string
  avg_score: number | null
  attainment_rate: number | null
  assessed_count: number
}

interface ApiOutcomeGapResponse {
  weak_plos: Array<{
    plo_id: number
    code: string
    name: string
    avg_score: number | null
    attainment_rate: number | null
    assessed_students: number
  }>
  weak_clos: Array<{
    course_id: number
    course_name: string
    clo_id: number
    code: string
    name: string
    avg_score: number | null
    attainment_rate: number | null
    assessed_enrollments: number
  }>
}

export interface ApiStudentOutcomeProfile {
  student: ApiStudent
  plos: Array<{
    plo_id: number
    plo_code: string
    plo_name: string
    achievement_score: number
    evidence_count: number
    is_achieved: boolean
  }>
  weak_clos: Array<{
    clo_id: number
    clo_code: string
    clo_name: string
    course_code: string
    course_name: string
    achievement_score: number
    is_achieved: boolean
  }>
}

export interface ApiOutcomeRecalculation {
  threshold: number
  clo_rows: number
  plo_rows: number
}

// --- Metric Explanation ---
export interface MetricExplainPayload {
  metricKey: string
  label: string
  value: string | number
  unit?: string
  formula: string
  source: string
  interpretation?: string
  scope: {
    level: "school" | "department" | "program" | "course" | "section" | "student" | "outcome"
    id?: string | number
    label?: string
  }
  filters?: Record<string, string | number | null>
  sampleSize?: number
  warnings?: string[]
  drilldowns?: Array<{ label: string; href: string }>
}

// --- Daily Brief ---
export type BriefSeverity = "high" | "medium" | "low"
export type BriefAction = "drill_down" | "ask_agent" | "create_task" | "dismiss"

export interface ApiBriefItem {
  id: string
  severity: BriefSeverity
  title: string
  scope_type: string
  scope_id: number | null
  scope_label?: string
  metric_key: string
  value: number | null
  delta?: number | null
  formula?: string
  sample_size?: number
  actions: BriefAction[]
}

export interface ApiDailyBrief {
  generated_at: string
  role: string
  items: ApiBriefItem[]
}

// --- Tasks ---
export type ApiTaskStatus = "open" | "assigned" | "in_progress" | "submitted" | "reviewed" | "closed"
export type ApiTaskType =
  | "student_intervention"
  | "section_review"
  | "course_review"
  | "data_quality_fix"
  | "outcome_mapping_review"
  | "report_request"
export type ApiTaskPriority = "low" | "medium" | "high" | "critical"

export interface ApiTask {
  id: number
  task_type: ApiTaskType
  priority: ApiTaskPriority
  scope_type: string
  scope_id: number | null
  source_metric?: string | null
  source_value?: number | null
  reason: string
  assignee_id: string | null
  created_by: string | null
  deadline?: string | null
  status: ApiTaskStatus
  resolution_note?: string | null
  created_at: string
  updated_at: string
  closed_at?: string | null
}

export interface ApiCreateTask {
  task_type: ApiTaskType
  priority: ApiTaskPriority
  scope_type: string
  scope_id?: number | null
  source_metric?: string
  source_value?: number
  reason: string
  assignee_id?: string | null
  deadline?: string | null
}

export interface ApiTaskComment {
  id: number
  task_id: number
  user_id: string | null
  comment: string
  created_at: string
}

// --- Interventions ---
export interface ApiIntervention {
  id: number
  student_id: number
  created_by: string | null
  action_type: string
  note: string
  status: string
  follow_up_date?: string | null
  created_at: string
  updated_at: string
}

export interface ApiCreateIntervention {
  student_id: number
  action_type: string
  note: string
  follow_up_date?: string | null
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

export interface ChatSessionDetail {
  id: string
  title: string
  messages: any[] // Mảng các LangChain messages
}

export interface ChatResponse {
  response: string
  intent: string
  tool_calls: { tool_name: string; tool_input: Record<string, unknown>; tool_output: string }[]
  latency_ms: number
}

async function fetcher<T>(input: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  const customInit = { ...init }
  customInit.headers = {
    ...customInit.headers,
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(input, customInit)
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

  return data as T
}

export function saveAccessToken(token: string) {
  localStorage.setItem("access_token", token)
}

export function clearAccessToken() {
  localStorage.removeItem("access_token")
}

export function getAccessToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : null
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&")
  return q ? `?${q}` : ""
}

export const api = {
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
  me: () => fetcher<ApiUser>("/api/v1/auth/me"),
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
  getReports: (params?: { limit?: number }) =>
    fetcher<ApiReport[]>(`/api/v1/reports${qs({ limit: params?.limit })}`),
  getReport: (id: string) =>
    fetcher<ApiReport>(`/api/v1/reports/${id}`),
  generateReport: (body: { report_type: ApiReportType; actor_role?: string; scope_type?: string; scope_id?: string }) =>
    fetcher<ApiReport>("/api/v1/reports", {
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
  createStudent: (body: { student_code: string; full_name: string; program_id: number; cohort_id: number; gender?: string; class_code?: string; status?: string }) =>
    fetcher<ApiStudent>("/api/v1/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateStudent: (id: number, body: Partial<{ full_name: string; gender: string; class_code: string; status: string }>) =>
    fetcher<ApiStudent>(`/api/v1/students/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteStudent: (id: number) =>
    fetcher<void>(`/api/v1/students/${id}`, { method: "DELETE" }),

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

  getEnrollments: (params?: { student_id?: number; section_id?: number; limit?: number }) =>
    fetcher<ApiEnrollment[]>(`/api/v1/grades/enrollments${qs(params ?? {})}`),
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

  // --- Teachers ---
  getTeachers: (params?: { limit?: number; department_id?: number }) =>
    fetcher<ApiTeacher[]>(`/api/v1/teachers${qs(params ?? {})}`),

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
  recalculateOutcomes: (threshold = 50) =>
    fetcher<ApiOutcomeRecalculation>(`/api/v1/analytics/outcomes/recalculate${qs({ threshold })}`, {
      method: "POST",
    }),
  getProgramPloAttainment: (programId: number) =>
    fetcher<ApiPloAttainment[]>(`/api/v1/analytics/outcomes/program/${programId}/plos`),
  getCourseCloAttainment: (courseId: number, sectionId?: number) =>
    fetcher<ApiCloAttainment[]>(`/api/v1/analytics/outcomes/course/${courseId}/clos${qs({ section_id: sectionId })}`),
  getStudentOutcomeProfile: (studentId: number) =>
    fetcher<ApiStudentOutcomeProfile>(`/api/v1/analytics/outcomes/student/${studentId}`),
  getOutcomeGaps: async (params?: { program_id?: number; limit?: number }) => {
    const data = await fetcher<ApiOutcomeGapResponse>(`/api/v1/analytics/outcomes/gaps${qs(params ?? {})}`)
    return [
      ...data.weak_plos.map((item) => ({
        scope_type: "plo" as const,
        id: item.plo_id,
        code: item.code,
        name: item.name,
        parent_code: "",
        avg_score: item.avg_score,
        attainment_rate: item.attainment_rate,
        assessed_count: item.assessed_students,
      })),
      ...data.weak_clos.map((item) => ({
        scope_type: "clo" as const,
        id: item.clo_id,
        code: item.code,
        name: item.name,
        parent_code: item.course_name,
        avg_score: item.avg_score,
        attainment_rate: item.attainment_rate,
        assessed_count: item.assessed_enrollments,
      })),
    ] satisfies ApiOutcomeGap[]
  },

  // --- Daily Brief ---
  getDailyBrief: () =>
    fetcher<ApiDailyBrief>("/api/v1/analytics/brief"),

  // --- Tasks ---
  getTasks: (params?: { status?: ApiTaskStatus; assignee_id?: string; scope_type?: string; limit?: number }) =>
    fetcher<ApiTask[]>(`/api/v1/tasks${qs(params ?? {})}`),
  createTask: (body: ApiCreateTask) =>
    fetcher<ApiTask>("/api/v1/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateTask: (id: number, body: Partial<Pick<ApiTask, "status" | "assignee_id" | "deadline" | "resolution_note">>) =>
    fetcher<ApiTask>(`/api/v1/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  submitTask: (id: number, note: string) =>
    fetcher<ApiTask>(`/api/v1/tasks/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution_note: note }) }),
  closeTask: (id: number, note: string) =>
    fetcher<ApiTask>(`/api/v1/tasks/${id}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution_note: note }) }),
  addTaskComment: (id: number, comment: string) =>
    fetcher<ApiTaskComment>(`/api/v1/tasks/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment }) }),

  // --- Interventions ---
  getInterventions: (params?: { student_id?: number; limit?: number }) =>
    fetcher<ApiIntervention[]>(`/api/v1/interventions${qs(params ?? {})}`),
  createIntervention: (body: ApiCreateIntervention) =>
    fetcher<ApiIntervention>("/api/v1/interventions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  getStudentInterventions: (studentId: number) =>
    fetcher<ApiIntervention[]>(`/api/v1/students/${studentId}/interventions`),

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
}

export type SSEEvent =
  | { type: "router"; intent: string }
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
  const res = await fetch("/api/v1/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
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
