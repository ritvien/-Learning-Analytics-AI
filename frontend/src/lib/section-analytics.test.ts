import { describe, expect, it } from "vitest"

import {
  dataQualitySummary,
  drillSectionHierarchy,
  sectionActionLabel,
  sectionHierarchyLabel,
  sectionPriorityLabel,
  sectionRiskActionLabel,
  sectionRiskLabel,
} from "./section-analytics"

describe("section analytics interactions", () => {
  it("drills hierarchy while clearing dependent filters", () => {
    const base = { department_id: 1, program_id: 2, course_id: 3, section_id: 4, semester_code: "2025-2" }
    expect(drillSectionHierarchy(base, "department", 9)).toEqual({
      department_id: 9, program_id: undefined, course_id: undefined, section_id: undefined, semester_code: "2025-2",
    })
    expect(drillSectionHierarchy(base, "program", 8).course_id).toBeUndefined()
    expect(drillSectionHierarchy(base, "course", 7).course_id).toBe(7)
  })

  it("provides Vietnamese chart labels", () => {
    expect(sectionHierarchyLabel("department")).toContain("Khoa")
    expect(sectionRiskLabel("high")).toBe("Ưu tiên")
    expect(sectionRiskActionLabel("high")).toBe("Can thiệp ngay")
    expect(sectionPriorityLabel("high_fail_rate")).toContain("trượt")
    expect(sectionActionLabel("wait_for_grades")).toContain("điểm")
    expect(dataQualitySummary("partial", ["x"])).toContain("lưu ý")
  })
})
