const ANALYTICS_PREFIX = "/manager/analytics"
const ANALYTICS_SECTIONS = new Set(["departments", "programs", "courses", "sections", "students", "outcomes"])
const ID_PARAM_BY_SECTION: Record<string, string> = {
  departments: "department_id",
  programs: "program_id",
  courses: "course_id",
  sections: "section_id",
  students: "student_id",
}

function normalizeRawHref(rawHref: string) {
  const trimmed = rawHref.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith(ANALYTICS_PREFIX)) return trimmed
  if (trimmed.startsWith("manager/analytics")) return `/${trimmed}`
  if (trimmed.startsWith("/analytics")) return `/manager${trimmed}`
  if (trimmed.startsWith("analytics")) return `/manager/${trimmed}`
  return null
}

function numericParam(url: URL, canonical: string, alias?: string) {
  const value = url.searchParams.get(canonical) ?? (alias ? url.searchParams.get(alias) : null)
  if (!value || !/^\d+$/.test(value)) return
  url.searchParams.set(canonical, value)
  if (alias) url.searchParams.set(alias, value)
}

export function normalizeReportDeepDiveHref(href: unknown) {
  if (typeof href !== "string") return null
  const normalizedRaw = normalizeRawHref(href)
  if (!normalizedRaw) return null
  try {
    const url = new URL(normalizedRaw, "http://localhost")
    if (url.origin !== "http://localhost" && !url.pathname.startsWith(ANALYTICS_PREFIX)) return null
    if (!url.pathname.startsWith(ANALYTICS_PREFIX)) return null

    const pathParts = url.pathname.split("/").filter(Boolean)
    const analyticsSection = pathParts[2]
    if (!analyticsSection || !ANALYTICS_SECTIONS.has(analyticsSection)) return null

    const detailId = pathParts[3]
    const idParam = ID_PARAM_BY_SECTION[analyticsSection]
    if (detailId && idParam && /^\d+$/.test(detailId)) {
      url.pathname = `${ANALYTICS_PREFIX}/${analyticsSection}`
      url.searchParams.set(idParam, detailId)
    }

    numericParam(url, "department_id", "department")
    numericParam(url, "program_id", "program")
    numericParam(url, "course_id", "course")
    numericParam(url, "section_id", "section")
    numericParam(url, "student_id", "student")

    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}
