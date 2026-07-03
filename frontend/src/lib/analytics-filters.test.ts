import { describe, expect, it } from "vitest"

import {
  analyticsHref,
  parseAnalyticsFilters,
  serializeAnalyticsFilters,
  validateAnalyticsDateRange,
  withDepartment,
  withProgram,
} from "./analytics-filters"

describe("analytics filters", () => {
  it("normalizes legacy aliases into the canonical contract", () => {
    expect(parseAnalyticsFilters("semester=2025-2&department=2&program=7&course=11&section=13")).toEqual({
      semester_code: "2025-2", department_id: 2, program_id: 7, course_id: 11, section_id: 13,
    })
  })

  it("serializes only canonical keys", () => {
    expect(analyticsHref("/manager/analytics/sections", { semester_code: "2025-2", course_id: 11 }))
      .toBe("/manager/analytics/sections?semester_code=2025-2&course_id=11")
    expect(serializeAnalyticsFilters(parseAnalyticsFilters("course=11"))).toBe("course_id=11")
  })

  it("resets dependent filters", () => {
    const filters = { department_id: 1, program_id: 2, course_id: 3, section_id: 4 }
    expect(withDepartment(filters, 9)).toEqual({ department_id: 9, program_id: undefined, course_id: undefined, section_id: undefined })
    expect(withProgram(filters, 8)).toEqual({ department_id: 1, program_id: 8, course_id: undefined, section_id: undefined })
  })

  it("rejects inverted dates", () => {
    expect(validateAnalyticsDateRange({ date_from: "2026-07-03", date_to: "2026-07-02" })).toContain("Ngày bắt đầu")
  })
})
