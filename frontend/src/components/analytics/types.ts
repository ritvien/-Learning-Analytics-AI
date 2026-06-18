export type MetricScope = {
  level: "school" | "department" | "program" | "course" | "section" | "student" | "outcome"
  id?: string | number
  label?: string
}

export type MetricExplainPayload = {
  metricKey: string
  label: string
  value: string | number
  unit?: string
  formula: string
  source: string
  interpretation?: string
  scope: MetricScope
  filters?: Record<string, string | number | null>
  sampleSize?: number
  warnings?: string[]
  drilldowns?: Array<{ label: string; href: string }>
}
