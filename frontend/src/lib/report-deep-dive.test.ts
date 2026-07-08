import { describe, expect, it } from "vitest"

import { normalizeReportDeepDiveHref } from "./report-deep-dive"

describe("report deep-dive links", () => {
  it("accepts canonical analytics links and normalizes aliases", () => {
    expect(normalizeReportDeepDiveHref("/manager/analytics/courses?course=11")).toBe(
      "/manager/analytics/courses?course=11&course_id=11",
    )
  })

  it("repairs common report/LLM link shapes", () => {
    expect(normalizeReportDeepDiveHref("manager/analytics/sections?section=13")).toBe(
      "/manager/analytics/sections?section=13&section_id=13",
    )
    expect(normalizeReportDeepDiveHref("/analytics/programs?program_id=7")).toBe(
      "/manager/analytics/programs?program_id=7&program=7",
    )
    expect(normalizeReportDeepDiveHref("/manager/analytics/sections/13")).toBe(
      "/manager/analytics/sections?section_id=13&section=13",
    )
  })

  it("rejects links outside the analytics surface", () => {
    expect(normalizeReportDeepDiveHref("https://evil.example/not-analytics?course_id=1")).toBeNull()
    expect(normalizeReportDeepDiveHref("/manager/reports")).toBeNull()
    expect(normalizeReportDeepDiveHref("/manager/analytics/unknown?x=1")).toBeNull()
  })
})
