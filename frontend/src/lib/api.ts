import type { Course, Department, GradeRecord, Student, Teacher } from "@/types"

async function fetcher<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const text = await response.text()
  const contentType = response.headers.get("content-type") || ""
  const data = contentType.includes("application/json") ? JSON.parse(text) : text

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${typeof data === "string" ? data : ""}`)
  }

  return data as T
}

export type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
}

export const api = {
  fetcher,
  getStudents: () => fetcher<Student[]>('/api/v1/students'),
  getTeachers: () => fetcher<Teacher[]>('/api/v1/teachers'),
  getCourses: () => fetcher<Course[]>('/api/v1/courses'),
  getDepartments: () => fetcher<Department[]>('/api/v1/departments'),
  getGrades: () => fetcher<GradeRecord[]>('/api/v1/grades'),
  importStudents: async (payload: FormData) => {
    const response = await fetch('/api/v1/import/students', {
      method: 'POST',
      body: payload,
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result?.message || 'Import students failed')
    return result as ApiResponse<null>
  },
  importGrades: async (payload: FormData) => {
    const response = await fetch('/api/v1/import/grades', {
      method: 'POST',
      body: payload,
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result?.message || 'Import grades failed')
    return result as ApiResponse<null>
  },
}
