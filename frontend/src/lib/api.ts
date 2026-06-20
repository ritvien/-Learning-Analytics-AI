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
  type: "school" | "department" | "program" | "course"
  code: string
  label: string
  metrics: ApiTreeMetrics
  children: ApiTreeNode[]
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
  generateReport: (body: { report_type: ApiReportType; actor_role?: string; scope_type?: string; scope_id?: string; semester_id?: number }) =>
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
  confirmReportAgentAction: (id: string, body: { action: "confirm" | "cancel" }) =>
    fetcher<{ id: string; status: string; result: Record<string, unknown> }>(`/api/v1/report-agent/tools/confirm/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
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
