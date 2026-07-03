import { describe, expect, it } from "vitest"

import { canAssignTasks, canGenerateAlerts, canHandleTask, hasAlertData, taskTabsForRole } from "./task-policy"
import type { ApiOpsTask } from "./api"

const task = {
  id: 1,
  assignee_user_id: "lecturer-1",
} as ApiOpsTask

describe("task policy", () => {
  it("limits lecturer tabs to personal workflow tabs", () => {
    expect(taskTabsForRole("lecturer")).toEqual(["mine", "active", "overdue", "closed"])
    expect(taskTabsForRole("lecturer")).not.toContain("all")
  })

  it("allows managers and admins to assign work", () => {
    expect(canAssignTasks("manager")).toBe(true)
    expect(canAssignTasks("admin")).toBe(true)
    expect(canAssignTasks("lecturer")).toBe(false)
    expect(canAssignTasks("viewer")).toBe(false)
  })

  it("allows lecturers to handle only assigned tasks", () => {
    expect(canHandleTask("lecturer", task, "lecturer-1")).toBe(true)
    expect(canHandleTask("lecturer", task, "lecturer-2")).toBe(false)
    expect(canHandleTask("manager", task, "manager-1")).toBe(true)
  })

  it("limits alert generation to admins", () => {
    expect(canGenerateAlerts("superadmin")).toBe(true)
    expect(canGenerateAlerts("admin")).toBe(true)
    expect(canGenerateAlerts("manager")).toBe(false)
  })

  it("hides alerts whose available data-volume metrics are all zero", () => {
    expect(hasAlertData({ completed_enrollments: 0, historical_completed_enrollments: 0 })).toBe(false)
    expect(hasAlertData({ evidence_count: 0, attainment_pct: 0 })).toBe(false)
    expect(hasAlertData({ completed_enrollments: 0, historical_completed_enrollments: 25 })).toBe(true)
    expect(hasAlertData({ dropout_probability: 0.8, fail_count: 0 })).toBe(true)
  })
})
