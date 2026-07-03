import type { AnalyticsFilterState } from "./analytics-filters"

export type SectionHierarchyLevel = "department" | "program" | "course"

export function drillSectionHierarchy(
  filters: AnalyticsFilterState,
  level: SectionHierarchyLevel,
  id: number,
): AnalyticsFilterState {
  if (level === "department") {
    return { ...filters, department_id: id, program_id: undefined, course_id: undefined, section_id: undefined }
  }
  if (level === "program") {
    return { ...filters, program_id: id, course_id: undefined, section_id: undefined }
  }
  return { ...filters, course_id: id, section_id: undefined }
}

export function sectionRiskLabel(level: string) {
  if (level === "high") return "Ưu tiên"
  if (level === "watch") return "Theo dõi"
  if (level === "pending") return "Thiếu điểm"
  return "Ổn định"
}

export function sectionRiskActionLabel(level: string) {
  if (level === "high") return "Can thiệp ngay"
  if (level === "watch") return "Theo dõi sát"
  if (level === "pending") return "Chờ điểm"
  return "Ổn định"
}

export function sectionPriorityLabel(reason: string | null | undefined) {
  if (reason === "high_fail_rate") return "Tỷ lệ trượt cao"
  if (reason === "missing_grade") return "Còn thiếu điểm"
  if (reason === "ml_high_risk") return "Có tín hiệu ML rủi ro"
  if (reason === "low_pass_rate") return "Tỷ lệ đạt thấp"
  if (reason === "small_sample") return "Cỡ lớp nhỏ, cần theo dõi"
  return "Ổn định"
}

export function sectionActionLabel(action: string | null | undefined) {
  if (action === "intervene_now") return "Can thiệp ngay"
  if (action === "monitor") return "Theo dõi sát"
  if (action === "wait_for_grades") return "Chờ cập nhật điểm"
  return "Chưa cần hành động"
}

export function dataQualitySummary(status: string | undefined, warnings: string[] = []) {
  if (!status || status === "ready") return "Dữ liệu sẵn sàng"
  if (status === "empty") return "Chưa có dữ liệu phù hợp"
  if (status === "stale") return "Dữ liệu cần làm mới"
  if (warnings.length) return "Có điểm cần lưu ý về dữ liệu"
  return "Dữ liệu chưa đầy đủ"
}

export function sectionHierarchyLabel(level: SectionHierarchyLevel) {
  if (level === "department") return "Khoa cần can thiệp"
  if (level === "program") return "Ngành cần can thiệp"
  return "Môn học cần can thiệp"
}
