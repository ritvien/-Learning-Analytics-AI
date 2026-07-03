import type { ApiOpsTask, ApiUserRole } from "@/lib/api"

export type TaskTabKey = "mine" | "alerts" | "active" | "overdue" | "closed" | "all"

export function taskTabsForRole(role: ApiUserRole | null | undefined): TaskTabKey[] {
  if (role === "superadmin" || role === "admin") return ["mine", "alerts", "active", "overdue", "closed", "all"]
  if (role === "manager") return ["mine", "alerts", "active", "overdue", "closed", "all"]
  if (role === "lecturer") return ["mine", "active", "overdue", "closed"]
  return []
}

export function canHandleTask(role: ApiUserRole | null | undefined, task?: ApiOpsTask | null, currentUserId?: string | null) {
  if (!role || !task) return false
  if (role === "superadmin" || role === "admin" || role === "manager") return true
  return role === "lecturer" && task.assignee_user_id === currentUserId
}

export function canAssignTasks(role: ApiUserRole | null | undefined) {
  return role === "superadmin" || role === "admin" || role === "manager"
}

export function canGenerateAlerts(role: ApiUserRole | null | undefined) {
  return role === "superadmin" || role === "admin"
}

const DATA_VOLUME_KEY = /(^total$|evidence_count|enrollment_count|completed_enrollments|student_count|record_count|row_count|sample_count)$/i

export function hasAlertData(evidence: Record<string, unknown> | null | undefined) {
  if (!evidence) return true
  const volumeValues = Object.entries(evidence)
    .filter(([key, value]) => DATA_VOLUME_KEY.test(key) && typeof value === "number")
    .map(([, value]) => value as number)

  return volumeValues.length === 0 || volumeValues.some((value) => value > 0)
}
