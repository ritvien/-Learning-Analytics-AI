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
  max_students: number | null
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

// --- Chat ---
export interface ChatRequest {
  message: string
  context?: Record<string, any>
}

export interface ChatResponse {
  response: string
  intent: string
  tool_calls: { tool_name: string; tool_input: Record<string, any>; tool_output: string }[]
  latency_ms: number
}

async function fetcher<T>(input: string, init?: RequestInit): Promise<T> {
  const customInit = { ...init }
  customInit.headers = {
    ...customInit.headers,
    "ngrok-skip-browser-warning": "true"
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

function qs(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&")
  return q ? `?${q}` : ""
}

export const api = {
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
  getSections: (params?: { limit?: number; course_id?: number }) =>
    fetcher<ApiSection[]>(`/api/v1/sections${qs(params ?? {})}`),

  // --- Semesters ---
  getSemesters: () =>
    fetcher<ApiSemester[]>('/api/v1/semesters'),

  // --- Chat ---
  chat: (body: ChatRequest) =>
    fetcher<ChatResponse>("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  /**
   * SSE streaming chat — calls POST /api/v1/chat/stream
   * and yields parsed SSE events as they arrive.
   */
  chatStream: async function* (body: ChatRequest): AsyncGenerator<
    | { type: "token"; content: string }
    | { type: "done"; intent: string; latency_ms: number }
    | { type: "error"; message: string }
  > {
    const response = await fetch("/api/v1/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      yield { type: "error", message: `API ${response.status}: ${response.statusText}` }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      yield { type: "error", message: "No response body" }
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6))
            yield event
          } catch {
            // skip malformed events
          }
        }
      }
    }
  },

  // --- Auth ---
  login: async (email: string, password: string): Promise<{ access_token: string; token_type: string }> => {
    const formData = new URLSearchParams()
    formData.append("username", email)
    formData.append("password", password)

    return fetcher<{ access_token: string; token_type: string }>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    })
  },
}
