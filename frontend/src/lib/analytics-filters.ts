export type AnalyticsFilterState = {
  semester_code?: string
  department_id?: number
  program_id?: number
  cohort_id?: number
  course_id?: number
  section_id?: number
  date_from?: string
  date_to?: string
  source?: string
}

const numericKeys = ["department_id", "program_id", "cohort_id", "course_id", "section_id"] as const
const canonicalKeys = ["semester_code", ...numericKeys, "date_from", "date_to", "source"] as const
const aliases: Record<string, keyof AnalyticsFilterState> = {
  semester: "semester_code",
  semester_id: "semester_code",
  department: "department_id",
  program: "program_id",
  course: "course_id",
  section: "section_id",
}

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">

export function parseAnalyticsFilters(input: SearchParamsLike | string): AnalyticsFilterState {
  const params = typeof input === "string" ? new URLSearchParams(input) : new URLSearchParams(input.toString())
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!params.has(canonical) && params.has(alias)) params.set(canonical, params.get(alias) ?? "")
  }
  const result: AnalyticsFilterState = {}
  const semester = params.get("semester_code")?.trim()
  if (semester && semester !== "all") result.semester_code = semester
  for (const key of numericKeys) {
    const value = params.get(key)
    if (!value || value === "all") continue
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) result[key] = parsed
  }
  for (const key of ["date_from", "date_to", "source"] as const) {
    const value = params.get(key)?.trim()
    if (value) result[key] = value
  }
  return result
}

export function serializeAnalyticsFilters(filters: AnalyticsFilterState): string {
  const params = new URLSearchParams()
  for (const key of canonicalKeys) {
    const value = filters[key]
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  return params.toString()
}

export function analyticsHref(path: string, filters: AnalyticsFilterState): string {
  const query = serializeAnalyticsFilters(filters)
  return query ? `${path}?${query}` : path
}

export function validateAnalyticsDateRange(filters: AnalyticsFilterState): string | null {
  if (!filters.date_from || !filters.date_to) return null
  const start = Date.parse(filters.date_from)
  const end = Date.parse(filters.date_to)
  if (Number.isNaN(start) || Number.isNaN(end)) return "Khoảng ngày không hợp lệ."
  return start > end ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." : null
}

export function withDepartment(filters: AnalyticsFilterState, departmentId?: number): AnalyticsFilterState {
  return { ...filters, department_id: departmentId, program_id: undefined, course_id: undefined, section_id: undefined }
}

export function withProgram(filters: AnalyticsFilterState, programId?: number): AnalyticsFilterState {
  return { ...filters, program_id: programId, course_id: undefined, section_id: undefined }
}

export function withCourse(filters: AnalyticsFilterState, courseId?: number): AnalyticsFilterState {
  return { ...filters, course_id: courseId, section_id: undefined }
}
