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

// --- Chat ---
export interface ChatRequest {
  message: string
  context?: Record<string, unknown>
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
  const text = await response.text()
  const contentType = response.headers.get("content-type") || ""
  const data = contentType.includes("application/json") ? JSON.parse(text) : text

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

  // --- Chat ---
  chat: (body: ChatRequest) =>
    fetcher<ChatResponse>("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
}

export type SSEEvent =
  | { type: "router"; intent: string }
  | { type: "tool_call"; tool: string; input: unknown }
  | { type: "tool_result"; output: string }
  | { type: "token"; content: string }
  | { type: "done"; latency_ms: number }
  | { type: "error"; message: string }

export async function* chatStream(
  body: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const res = await fetch("/api/v1/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
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
