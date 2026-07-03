"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BookOpen, CheckCircle2, GitBranch, Gauge, Target, Users, UserX } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  api,
  getCachedCurrentUser,
  type ApiDashboardDepartments,
  type ApiDashboardOutcomes,
  type ApiDashboardOverview,
} from "@/lib/api"
import { analyticsHref, parseAnalyticsFilters, serializeAnalyticsFilters } from "@/lib/analytics-filters"

const OUTCOME_TARGET = 70
const PASS_TARGET = 75

type PerformanceRow = {
  id: number
  code: string
  name: string
  department: string | null
  level: "Khoa" | "Ngành"
  students: number
  volume: number
  passRate: number | null
  avgGrade: number | null
  atRisk: number | null
  atRiskRate: number | null
  outcome: number | null
  weakPlos: number
}

function pct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${value.toFixed(digits)}%`
}

function numberText(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("vi-VN")
}

function barColor(value: number) {
  if (value >= 85) return "#059669"
  if (value >= OUTCOME_TARGET) return "#2563eb"
  if (value >= 55) return "#f59e0b"
  return "#dc2626"
}

function performanceTone(row: PerformanceRow) {
  if ((row.passRate ?? 100) < 60 || (row.avgGrade ?? 10) < 5 || (row.atRiskRate ?? 0) >= 20) return "#dc2626"
  if ((row.passRate ?? 100) < PASS_TARGET || (row.outcome ?? 100) < OUTCOME_TARGET || (row.atRiskRate ?? 0) >= 10) return "#f59e0b"
  return "#059669"
}

function performanceRiskScore(row: PerformanceRow) {
  const passGap = row.passRate === null ? 0 : Math.max(0, PASS_TARGET - row.passRate)
  const gradeGap = row.avgGrade === null ? 0 : Math.max(0, 5.5 - row.avgGrade) * 10
  const outcomeGap = row.outcome === null ? 0 : Math.max(0, OUTCOME_TARGET - row.outcome)
  const studentRisk = row.atRiskRate ?? 0
  return passGap * 0.35 + studentRisk * 0.25 + outcomeGap * 0.25 + gradeGap * 0.15
}

function relativeRiskColor(index: number, total: number) {
  if (total <= 1) return "#2563eb"
  const ratio = index / Math.max(1, total - 1)
  if (ratio < 0.34) return "#dc2626"
  if (ratio < 0.67) return "#f59e0b"
  return "#059669"
}

function gapReason(row: ApiDashboardOutcomes["quality_rows"][number], minEvidence: number) {
  if (row.program_courses === 0) return "Chưa map môn học vào chương trình"
  if (row.courses_with_component_clo_mapping === 0) return "Chưa map thành phần điểm với CLO"
  if (row.evidence_count === 0) return "Chưa có evidence CLO/PLO"
  if (row.students_with_evidence < minEvidence) return "Cỡ mẫu outcome quá nhỏ"
  return "Cần rà soát mapping hoặc kỳ dữ liệu"
}

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: PerformanceRow & { plotPassRate: number; plotAvgGrade: number } }> }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="max-w-72 rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-semibold">{row.code} · {row.name}</p>
      <p className="mt-1 text-muted-foreground">{row.level}{row.department && row.level === "Ngành" ? ` · ${row.department}` : ""}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">X - tỷ lệ đạt</span><span className="text-right font-medium">{pct(row.passRate)}</span>
        <span className="text-muted-foreground">Y - điểm TB</span><span className="text-right font-medium">{row.avgGrade?.toFixed(2) ?? "—"}</span>
        <span className="text-muted-foreground">Quy mô</span><span className="text-right font-medium">{numberText(row.volume)} lượt</span>
        <span className="text-muted-foreground">SV rủi ro</span><span className="text-right font-medium">{row.atRisk === null ? "—" : `${numberText(row.atRisk)} (${pct(row.atRiskRate)})`}</span>
        <span className="text-muted-foreground">Outcome</span><span className="text-right font-medium">{pct(row.outcome)}</span>
      </div>
    </div>
  )
}

export default function OutcomeAnalyticsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeFilters = React.useMemo(() => parseAnalyticsFilters(searchParams), [searchParams])
  const currentUser = React.useMemo(() => getCachedCurrentUser(), [])
  const scopedDepartmentId = currentUser?.role === "manager" && currentUser.department_id ? String(currentUser.department_id) : null
  const [data, setData] = React.useState<ApiDashboardOutcomes | null>(null)
  const [healthData, setHealthData] = React.useState<ApiDashboardDepartments | null>(null)
  const [overviewData, setOverviewData] = React.useState<ApiDashboardOverview | null>(null)
  const [semester, setSemester] = React.useState(routeFilters.semester_code ?? "all")
  const [departmentId, setDepartmentId] = React.useState(scopedDepartmentId ?? (routeFilters.department_id ? String(routeFilters.department_id) : "all"))
  const [programId, setProgramId] = React.useState(routeFilters.program_id ? String(routeFilters.program_id) : "all")
  const [ploId, setPloId] = React.useState(searchParams.get("plo_id") ?? "all")
  const [minEvidence, setMinEvidence] = React.useState(searchParams.get("min_evidence") ?? "30")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (scopedDepartmentId && departmentId !== scopedDepartmentId) setDepartmentId(scopedDepartmentId)
  }, [departmentId, scopedDepartmentId])

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    const commonFilters = {
      semester_code: semester === "all" ? undefined : semester,
      department_id: departmentId === "all" ? undefined : Number(departmentId),
      program_id: programId === "all" ? undefined : Number(programId),
    }
    const overviewFilters = {
      semester_code: semester === "all" ? undefined : semester,
      department_id: departmentId === "all" ? undefined : Number(departmentId),
    }
    Promise.all([
      api.getDashboardOutcomes({
        ...commonFilters,
        plo_id: ploId === "all" ? undefined : Number(ploId),
        min_evidence: Number(minEvidence) || 30,
      }),
      api.getDashboardDepartments(commonFilters),
      api.getDashboardOverview(overviewFilters),
    ])
      .then(([payload, nextHealth, nextOverview]) => {
        if (!active) return
        setData(payload)
        setHealthData(nextHealth)
        setOverviewData(nextOverview)
        if (programId !== "all" && !payload.programs.some((program) => String(program.id) === programId)) setProgramId("all")
      })
      .catch((err) => {
        if (!active) return
        console.error(err)
        setError(err instanceof Error ? err.message : "Không tải được dashboard sức khỏe khoa/ngành.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [departmentId, minEvidence, ploId, programId, semester])

  React.useEffect(() => {
    const query = serializeAnalyticsFilters({
      semester_code: semester === "all" ? undefined : semester,
      department_id: departmentId === "all" ? undefined : Number(departmentId),
      program_id: programId === "all" ? undefined : Number(programId),
      source: routeFilters.source,
    })
    const params = new URLSearchParams(query)
    if (ploId !== "all") params.set("plo_id", ploId)
    if (minEvidence !== "30") params.set("min_evidence", minEvidence)
    const next = params.toString()
    if (next !== searchParams.toString()) router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false })
  }, [departmentId, minEvidence, pathname, ploId, programId, routeFilters.source, router, searchParams, semester])

  const filteredPrograms = React.useMemo(() => {
    if (!data) return []
    if (departmentId === "all") return data.programs
    return data.programs.filter((program) => program.department_id === Number(departmentId))
  }, [data, departmentId])

  const ploOptions = React.useMemo(() => {
    const map = new Map<number, { id: number; code: string; name: string }>()
    for (const row of data?.plo_rows ?? []) map.set(row.plo_id, { id: row.plo_id, code: row.plo_code, name: row.plo_name })
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, "vi"))
  }, [data])

  const trendRows = React.useMemo(() => {
    return [...(healthData?.trend ?? [])]
      .sort((a, b) => a.year - b.year || a.term - b.term)
      .slice(-10)
      .map((row) => ({
        semester: row.semester,
        count: row.count,
        passRate: row.pass_rate,
        avgGrade: row.avg_grade,
      }))
  }, [healthData])

  const weakPlos = React.useMemo(() => {
    return [...(data?.plo_rows ?? [])]
      .sort((a, b) => a.attainment_pct - b.attainment_pct || b.evidence_count - a.evidence_count)
      .slice(0, 10)
  }, [data])

  const ploBarRows = React.useMemo(() => {
    return weakPlos.slice(0, 8).map((row) => ({
      id: `${row.program_id}:${row.plo_id}`,
      label: `${row.program_code} · ${row.plo_code}`,
      name: row.plo_name,
      attainment: row.attainment_pct,
      evidence: row.evidence_count,
      programId: row.program_id,
    }))
  }, [weakPlos])

  const outcomeByProgram = React.useMemo(() => {
    const map = new Map<number, { evidence: number; weighted: number; weakPlos: number }>()
    for (const row of data?.plo_rows ?? []) {
      const current = map.get(row.program_id) ?? { evidence: 0, weighted: 0, weakPlos: 0 }
      current.evidence += row.evidence_count
      current.weighted += row.attainment_pct * row.evidence_count
      if (row.attainment_pct < OUTCOME_TARGET) current.weakPlos += 1
      map.set(row.program_id, current)
    }
    return map
  }, [data])

  const programComparison = React.useMemo(() => {
    const rows = overviewData?.program_rows ?? []
    return rows
      .filter((row) => programId === "all" || String(row.id) === programId)
      .map((row) => {
        const outcome = outcomeByProgram.get(row.id)
        return {
          id: row.id,
          code: row.code,
          name: row.name,
          department: row.department,
          activeStudents: row.active_students,
          passRate: row.pass_rate,
          avgGrade: row.avg_grade,
          atRisk: row.at_risk,
          outcome: outcome && outcome.evidence > 0 ? Number((outcome.weighted / outcome.evidence).toFixed(1)) : null,
          weakPlos: outcome?.weakPlos ?? 0,
          z: Math.max(40, row.active_students),
        }
      })
      .sort((a, b) => {
        const aOutcome = a.outcome ?? 0
        const bOutcome = b.outcome ?? 0
        return a.passRate + aOutcome - (b.passRate + bOutcome)
      })
      .slice(0, 18)
  }, [outcomeByProgram, overviewData, programId])
  const observableOutcomeRows = React.useMemo(() => {
    const byProgram = new Map<number, {
      id: number
      code: string
      name: string
      department: string | null
      attainment: number
      evidence: number
      students: number
      semesters: number
      courses: number
      weakPlos: number
    }>()
    for (const row of data?.plo_rows ?? []) {
      if (programId !== "all" && String(row.program_id) !== programId) continue
      const current = byProgram.get(row.program_id) ?? {
        id: row.program_id,
        code: row.program_code,
        name: row.program_name,
        department: row.department_name,
        attainment: 0,
        evidence: 0,
        students: 0,
        semesters: 0,
        courses: 0,
        weakPlos: 0,
      }
      current.attainment += row.attainment_pct * row.evidence_count
      current.evidence += row.evidence_count
      current.students = Math.max(current.students, row.student_count)
      current.semesters = Math.max(current.semesters, row.semester_count)
      current.courses = Math.max(current.courses, row.course_count)
      if (row.attainment_pct < OUTCOME_TARGET) current.weakPlos += 1
      byProgram.set(row.program_id, current)
    }
    return [...byProgram.values()]
      .filter((row) => row.evidence > 0)
      .map((row) => ({ ...row, attainment: Number((row.attainment / row.evidence).toFixed(1)) }))
      .sort((a, b) => b.evidence - a.evidence)
      .slice(0, 12)
  }, [data, programId])
  const departmentOutcomeByName = React.useMemo(() => {
    const map = new Map<string, { evidence: number; weighted: number; weakPlos: number }>()
    for (const row of data?.plo_rows ?? []) {
      if (!row.department_name) continue
      const current = map.get(row.department_name) ?? { evidence: 0, weighted: 0, weakPlos: 0 }
      current.evidence += row.evidence_count
      current.weighted += row.attainment_pct * row.evidence_count
      if (row.attainment_pct < OUTCOME_TARGET) current.weakPlos += 1
      map.set(row.department_name, current)
    }
    return map
  }, [data])
  const performanceRows = React.useMemo<PerformanceRow[]>(() => {
    const shouldCompareDepartments = departmentId === "all" && (healthData?.dept_stats.length ?? 0) >= 2
    if (shouldCompareDepartments) {
      return (healthData?.dept_stats ?? []).map((row) => {
        const outcome = departmentOutcomeByName.get(row.name)
        return {
          id: row.id,
          code: row.short_name,
          name: row.name,
          department: row.name,
          level: "Khoa",
          students: row.student_count,
          volume: row.enrollment_count,
          passRate: row.pass_rate,
          avgGrade: row.avg_grade,
          atRisk: row.at_risk,
          atRiskRate: row.at_risk_rate,
          outcome: outcome && outcome.evidence > 0 ? Number((outcome.weighted / outcome.evidence).toFixed(1)) : null,
          weakPlos: outcome?.weakPlos ?? 0,
        }
      })
    }
    return programComparison.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      department: row.department,
      level: "Ngành",
      students: row.activeStudents,
      volume: row.activeStudents,
      passRate: row.passRate > 0 ? row.passRate : null,
      avgGrade: row.avgGrade > 0 ? row.avgGrade : null,
      atRisk: row.atRisk,
      atRiskRate: row.activeStudents > 0 ? Number(((row.atRisk / row.activeStudents) * 100).toFixed(1)) : null,
      outcome: row.outcome,
      weakPlos: row.weakPlos,
    }))
  }, [departmentId, departmentOutcomeByName, healthData, programComparison])
  const observedPerformanceRows = React.useMemo(() => {
    return performanceRows
      .filter((row) => row.passRate !== null || row.avgGrade !== null || row.outcome !== null || (row.atRisk ?? 0) > 0)
      .sort((a, b) => performanceRiskScore(b) - performanceRiskScore(a))
      .slice(0, 14)
  }, [performanceRows])
  const matrixRows = React.useMemo(() => {
    return observedPerformanceRows
      .filter((row) => row.passRate !== null && row.avgGrade !== null)
      .map((row, index) => {
        const offset = (index % 5) - 2
        return {
          ...row,
          plotPassRate: Math.max(0, Math.min(100, (row.passRate ?? 0) + offset * 0.7)),
          plotAvgGrade: Math.max(0, Math.min(10, (row.avgGrade ?? 0) + offset * 0.035)),
        }
      })
  }, [observedPerformanceRows])
  const sparseOutcomePrograms = React.useMemo(() => {
    const threshold = Number(minEvidence) || 30
    return [...(data?.quality_rows ?? [])]
      .filter((row) => {
        if (programId !== "all" && String(row.program_id) !== programId) return false
        return row.program_courses === 0
          || row.courses_with_component_clo_mapping === 0
          || row.evidence_count === 0
          || row.students_with_evidence < threshold
      })
      .filter((row) => row.program_courses > 0 || row.evidence_count > 0 || row.students_with_evidence > 0)
      .sort((a, b) => a.evidence_count - b.evidence_count || a.program_name.localeCompare(b.program_name, "vi"))
      .slice(0, 12)
  }, [data, minEvidence, programId])
  const unmappedProgramCount = React.useMemo(() => {
    return (data?.quality_rows ?? []).filter((row) => {
      if (programId !== "all" && String(row.program_id) !== programId) return false
      return row.program_courses === 0 && row.evidence_count === 0 && row.students_with_evidence === 0
    }).length
  }, [data, programId])

  const driverCourses = React.useMemo(() => [...(data?.driver_courses ?? [])].slice(0, 12), [data])
  const driverClos = React.useMemo(() => [...(data?.driver_clos ?? [])].slice(0, 12), [data])
  const programLabel = programId === "all" ? "Tất cả ngành" : data?.programs.find((program) => String(program.id) === programId)?.name ?? programId
  const semesterLabel = semester === "all" ? "Tất cả học kỳ" : data?.semesters.find((item) => item.code === semester)?.name ?? semester
  const health = healthData?.kpis
  const mostConcerningUnit = observedPerformanceRows[0] ?? null
  const urgentSignals = [
    mostConcerningUnit ? {
      label: `${mostConcerningUnit.level} cần xem trước`,
      title: `${mostConcerningUnit.code} · ${mostConcerningUnit.name}`,
      value: mostConcerningUnit.passRate === null ? pct(mostConcerningUnit.outcome) : pct(mostConcerningUnit.passRate),
      note: `${numberText(mostConcerningUnit.students)} SV · ${mostConcerningUnit.weakPlos} PLO dưới ngưỡng`,
      tone: performanceRiskScore(mostConcerningUnit) >= 10 ? "danger" : "normal",
    } : null,
    weakPlos[0] ? {
      label: "PLO yếu nhất",
      title: `${weakPlos[0].program_code} · ${weakPlos[0].plo_code}`,
      value: pct(weakPlos[0].attainment_pct),
      note: `${numberText(weakPlos[0].evidence_count)} evidence`,
      tone: weakPlos[0].attainment_pct < OUTCOME_TARGET ? "danger" : "normal",
    } : null,
    driverCourses[0] ? {
      label: "Môn kéo chuẩn xuống",
      title: `${driverCourses[0].course_code} · ${driverCourses[0].plo_code}`,
      value: pct(driverCourses[0].attainment_pct),
      note: driverCourses[0].course_name,
      tone: driverCourses[0].attainment_pct < OUTCOME_TARGET ? "danger" : "normal",
    } : null,
    health ? {
      label: "Rủi ro sinh viên",
      title: "SV có học phần chưa đạt",
      value: pct(health.at_risk_rate),
      note: `${numberText(health.at_risk)} sinh viên trong phạm vi`,
      tone: health.at_risk_rate >= 20 ? "danger" : health.at_risk_rate >= 10 ? "watch" : "normal",
    } : null,
  ].filter((item): item is { label: string; title: string; value: string; note: string; tone: string } => Boolean(item))

  if (loading && !data) return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Đang tổng hợp sức khỏe khoa/ngành...</div>

  if (error) {
    return <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-8 text-sm text-destructive">{error}</CardContent></Card>
  }

  if (!data) return <div className="text-sm text-muted-foreground">Chưa có dữ liệu sức khỏe khoa/ngành.</div>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sức khỏe khoa/ngành</h1>
          <p className="text-sm text-muted-foreground">Góc nhìn quản lý theo kết quả học tập, quy mô, rủi ro sinh viên và mức đạt chuẩn đầu ra.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={semester} onValueChange={(value) => setSemester(value ?? "all")}>
            <SelectTrigger className="w-48"><span className="truncate">{semesterLabel}</span></SelectTrigger>
            <SelectContent><SelectItem value="all">Tất cả học kỳ</SelectItem>{data.semesters.map((item) => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
          {!scopedDepartmentId ? (
            <Select value={departmentId} onValueChange={(value) => { setDepartmentId(value ?? "all"); setProgramId("all") }}>
              <SelectTrigger className="w-56"><span className="truncate">{departmentId === "all" ? "Tất cả khoa" : data.departments.find((department) => String(department.id) === departmentId)?.name ?? departmentId}</span></SelectTrigger>
              <SelectContent><SelectItem value="all">Tất cả khoa</SelectItem>{data.departments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          <Select value={programId} onValueChange={(value) => setProgramId(value ?? "all")}>
            <SelectTrigger className="w-64"><span className="truncate">{programLabel}</span></SelectTrigger>
            <SelectContent><SelectItem value="all">Tất cả ngành</SelectItem>{filteredPrograms.map((program) => <SelectItem key={program.id} value={String(program.id)}>{program.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ploId} onValueChange={(value) => setPloId(value ?? "all")}>
            <SelectTrigger className="w-40"><span className="truncate">{ploId === "all" ? "Tất cả PLO" : ploOptions.find((item) => String(item.id) === ploId)?.code ?? ploId}</span></SelectTrigger>
            <SelectContent><SelectItem value="all">Tất cả PLO</SelectItem>{ploOptions.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={minEvidence} onValueChange={(value) => setMinEvidence(value ?? "30")}>
            <SelectTrigger className="w-36"><span>n ≥ {minEvidence}</span></SelectTrigger>
            <SelectContent><SelectItem value="10">n ≥ 10</SelectItem><SelectItem value="30">n ≥ 30</SelectItem><SelectItem value="100">n ≥ 100</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Sinh viên",
            value: health ? numberText(health.students) : "—",
            note: `${health ? numberText(health.completed_enrollments) : "—"} lượt học có kết quả`,
            icon: Users,
            tone: "text-blue-600",
          },
          {
            label: "Tỷ lệ đạt học phần",
            value: health ? pct(health.pass_rate) : "—",
            note: health ? `${numberText(health.failed_enrollments)} lượt chưa đạt` : "Chưa có dữ liệu",
            icon: CheckCircle2,
            tone: health && health.pass_rate >= PASS_TARGET ? "text-emerald-600" : "text-amber-600",
          },
          {
            label: "Điểm trung bình",
            value: health ? health.avg_grade.toFixed(2) : "—",
            note: "Thang điểm 10 trong phạm vi đang lọc",
            icon: Gauge,
            tone: "text-primary",
          },
          {
            label: "SV cần theo dõi",
            value: health ? numberText(health.at_risk) : "—",
            note: health ? `${pct(health.at_risk_rate)} trên phạm vi lọc` : "Chưa có dữ liệu",
            icon: UserX,
            tone: health && health.at_risk_rate >= 15 ? "text-destructive" : "text-amber-600",
          },
          {
            label: "Outcome attainment",
            value: pct(data.kpis.attainment_pct),
            note: `${data.kpis.plos_at_target}/${data.kpis.plos_with_evidence} PLO đạt ngưỡng ${OUTCOME_TARGET}%`,
            icon: Target,
            tone: data.kpis.attainment_pct >= OUTCOME_TARGET ? "text-emerald-600" : "text-destructive",
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between gap-3 py-4">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p>
              </div>
              <item.icon className={`h-5 w-5 ${item.tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {urgentSignals.length ? (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-base">Điểm cần chú ý trước</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {urgentSignals.map((item) => (
              <div key={item.label} className={`rounded-md border p-3 text-sm ${item.tone === "danger" ? "border-red-200 bg-red-50/50" : item.tone === "watch" ? "border-amber-200 bg-amber-50/50" : ""}`}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">{item.title}</p>
                  <span className={item.tone === "danger" ? "font-semibold text-destructive" : item.tone === "watch" ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>{item.value}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Xu hướng sức khỏe theo học kỳ</CardTitle>
            <CardDescription>Bar là quy mô lượt học; line là tỷ lệ đạt và điểm trung bình.</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            {trendRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendRows} margin={{ top: 12, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="count" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="grade" domain={[0, 10]} hide />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine yAxisId="rate" y={PASS_TARGET} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Bar yAxisId="count" dataKey="count" name="Lượt học" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={52} />
                  <Line yAxisId="rate" type="monotone" dataKey="passRate" name="Tỷ lệ đạt (%)" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="grade" type="monotone" dataKey="avgGrade" name="Điểm TB" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa có đủ dữ liệu học kỳ trong phạm vi hiện tại.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ma trận hiệu suất khoa/ngành</CardTitle>
            <CardDescription>Mỗi chấm là một khoa/ngành. Sang phải là đạt học phần tốt hơn, lên cao là điểm trung bình tốt hơn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span><span className="font-medium text-foreground">X</span>: tỷ lệ đạt học phần (%)</span>
              <span><span className="font-medium text-foreground">Y</span>: điểm trung bình thang 10</span>
              <span><span className="font-medium text-foreground">Size</span>: quy mô lượt học/SV</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" />ưu tiên cao</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />theo dõi</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />ổn hơn</span>
            </div>
            <div className="h-[340px]">
            {observedPerformanceRows.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 18, bottom: 12, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="plotPassRate"
                    name="Tỷ lệ đạt học phần"
                    unit="%"
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    label={{ value: "Tỷ lệ đạt học phần (%)", position: "insideBottom", offset: -4, fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="plotAvgGrade"
                    name="Điểm trung bình"
                    domain={[0, 10]}
                    tick={{ fontSize: 12 }}
                    label={{ value: "Điểm trung bình (0-10)", angle: -90, position: "insideLeft", fontSize: 12 }}
                  />
                  <ZAxis type="number" dataKey="volume" range={[180, 1100]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<MatrixTooltip />} />
                  <ReferenceLine x={PASS_TARGET} stroke="#f59e0b" strokeDasharray="4 4" />
                  <ReferenceLine y={5.5} stroke="#ef4444" strokeDasharray="4 4" />
                  <Scatter data={matrixRows} name="Đơn vị" cursor="pointer">
                    {matrixRows.map((row, index) => <Cell key={`${row.level}:${row.id}`} fill={relativeRiskColor(index, matrixRows.length)} fillOpacity={0.78} stroke="#0f172a" strokeOpacity={0.28} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : observedPerformanceRows.length ? (
              <div className="h-full">
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                  Phạm vi này chưa đủ điểm để vẽ ma trận, nên hiển thị ranking hiệu suất quan sát được.
                </div>
                <ResponsiveContainer width="100%" height="82%">
                  <BarChart data={observedPerformanceRows.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 32, bottom: 8, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="code" width={88} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <ReferenceLine x={PASS_TARGET} stroke="#ef4444" strokeDasharray="4 4" />
                    <Bar dataKey="passRate" name="Tỷ lệ đạt (%)" radius={[0, 5, 5, 0]} maxBarSize={26}>
                      {observedPerformanceRows.slice(0, 8).map((row) => <Cell key={`${row.level}:${row.id}`} fill={performanceTone(row)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : observableOutcomeRows.length ? (
              <div className="h-full">
                <div className="mb-3 rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs text-sky-800">
                  Scope này chưa đủ dữ liệu để vẽ scatter, nên đang hiển thị ngành có evidence outcome quan sát được.
                </div>
                <ResponsiveContainer width="100%" height="82%">
                  <BarChart data={observableOutcomeRows.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 32, bottom: 8, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="code" width={88} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="evidence" name="Evidence outcome" fill="#2563eb" radius={[0, 5, 5, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">{programComparison.length ? "Các ngành trong phạm vi lọc chưa có outcome attainment để đặt lên trục Y." : "Chưa có đủ dữ liệu ngành để so sánh."}</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xếp hạng đơn vị cần ưu tiên</CardTitle>
          <CardDescription>Ưu tiên theo tín hiệu quan sát được: tỷ lệ đạt, điểm trung bình, sinh viên rủi ro và outcome.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-xs">
            <thead><tr className="border-y bg-muted/40 text-left text-muted-foreground">{["Đơn vị", "Cấp", "SV", "Đạt học phần", "Điểm TB", "SV rủi ro", "Outcome", "PLO yếu"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead>
            <tbody className="divide-y">
              {observedPerformanceRows.map((row) => (
                <tr key={`${row.level}:${row.id}`}>
                  <td className="px-4 py-3"><div className="font-medium">{row.code}</div><div className="max-w-[260px] truncate text-muted-foreground">{row.name}</div></td>
                  <td className="px-4 py-3">{row.level}</td>
                  <td className="px-4 py-3 tabular-nums">{numberText(row.students)}</td>
                  <td className="px-4 py-3"><Badge variant={row.passRate !== null && row.passRate < PASS_TARGET ? "destructive" : "secondary"}>{row.passRate === null ? "—" : pct(row.passRate)}</Badge></td>
                  <td className="px-4 py-3 tabular-nums">{row.avgGrade === null ? "—" : row.avgGrade.toFixed(2)}</td>
                  <td className="px-4 py-3 tabular-nums">{row.atRisk === null ? "—" : `${numberText(row.atRisk)} (${pct(row.atRiskRate)})`}</td>
                  <td className="px-4 py-3"><Badge variant={(row.outcome ?? 100) < OUTCOME_TARGET ? "destructive" : "secondary"}>{row.outcome === null ? "—" : pct(row.outcome)}</Badge></td>
                  <td className="px-4 py-3 tabular-nums">{row.weakPlos}</td>
                </tr>
              ))}
              {!observedPerformanceRows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={8}>
                    Chưa có ngành nào đủ tín hiệu phân tích để xếp hạng ưu tiên trong phạm vi hiện tại.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {sparseOutcomePrograms.length || unmappedProgramCount ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ngành chưa đủ dữ liệu phân tích</CardTitle>
            <CardDescription>Các ngành này có trong danh mục nhưng chưa đủ chuỗi mapping để lên biểu đồ outcome.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {unmappedProgramCount ? (
              <div className="border-b px-4 py-3 text-sm text-muted-foreground">
                {unmappedProgramCount} ngành chưa map môn học vào chương trình đang được gom lại, không đưa vào ranking can thiệp.
              </div>
            ) : null}
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-muted-foreground">
                  {["Ngành", "Khoa", "Lý do thiếu", "Môn CTĐT", "Môn map CLO", "Evidence", "SV evidence", "Kỳ"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sparseOutcomePrograms.map((row) => (
                  <tr key={row.program_id}>
                    <td className="px-4 py-3"><div className="font-medium">{row.program_code}</div><div className="max-w-[260px] truncate text-muted-foreground">{row.program_name}</div></td>
                    <td className="px-4 py-3">{row.department_name ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">{gapReason(row, Number(minEvidence) || 30)}</Badge></td>
                    <td className="px-4 py-3 tabular-nums">{numberText(row.program_courses)}</td>
                    <td className="px-4 py-3 tabular-nums">{numberText(row.courses_with_component_clo_mapping)}</td>
                    <td className="px-4 py-3 tabular-nums">{numberText(row.evidence_count)}</td>
                    <td className="px-4 py-3 tabular-nums">{numberText(row.students_with_evidence)}</td>
                    <td className="px-4 py-3 tabular-nums">{numberText(row.semesters_with_evidence)}</td>
                  </tr>
                ))}
                {!sparseOutcomePrograms.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={8}>
                      Không có ngành partial đáng phân tích thêm; phần thiếu hiện chủ yếu là nhóm chưa map môn học.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold">Trục chuẩn đầu ra</h2>
        <p className="text-sm text-muted-foreground">PLO/CLO là một nhóm chỉ báo trong dashboard; dùng phần này để truy nguồn từ PLO yếu tới môn và CLO cụ thể.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          ["PLO có dữ liệu", data.kpis.plos_with_evidence, Target, "text-primary"],
          ["PLO đạt chuẩn", data.kpis.plos_at_target, CheckCircle2, "text-emerald-600"],
          ["CLO có dữ liệu", data.kpis.clos_with_evidence, GitBranch, "text-violet-600"],
          ["Môn có dữ liệu", data.kpis.courses_with_evidence, BookOpen, "text-blue-600"],
          ["Attainment TB", pct(data.kpis.attainment_pct), Target, data.kpis.attainment_pct >= OUTCOME_TARGET ? "text-emerald-600" : "text-destructive"],
        ].map(([label, value, Icon, tone]) => (
          <Card key={String(label)}>
            <CardContent className="flex items-start justify-between gap-2 py-4">
              <div>
                <p className="text-xs text-muted-foreground">{String(label)}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{String(value)}</p>
              </div>
              {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: `h-5 w-5 ${tone}` })}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PLO yếu nhất</CardTitle>
            <CardDescription>Mỗi dòng là một PLO trong một ngành; thanh thể hiện mức đạt so với ngưỡng 70%.</CardDescription>
          </CardHeader>
          <CardContent>
            {ploBarRows.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span className="font-medium text-foreground">Ngưỡng đạt 70%</span>
                  <span>100%</span>
                </div>
                <div className="space-y-3">
                  {ploBarRows.map((row) => (
                    <div key={row.id} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.label}</p>
                          <p className="truncate text-muted-foreground">{row.name}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={row.attainment < OUTCOME_TARGET ? "font-semibold text-destructive" : "font-semibold text-emerald-600"}>{pct(row.attainment)}</p>
                          <p className="text-muted-foreground">{numberText(row.evidence)} mẫu</p>
                        </div>
                      </div>
                      <div className="relative h-3 rounded-full bg-muted">
                        <div className="absolute left-[70%] top-[-3px] h-5 border-l border-red-500" />
                        <div className="h-3 rounded-full" style={{ width: `${Math.min(100, Math.max(0, row.attainment))}%`, backgroundColor: barColor(row.attainment) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa đủ dữ liệu PLO trong phạm vi hiện tại.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Môn kéo PLO xuống</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-xs">
              <thead><tr className="border-y bg-muted/40 text-left text-muted-foreground">{["PLO", "Môn", "Đạt", "Cỡ mẫu", "Action"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr></thead>
              <tbody className="divide-y">{driverCourses.map((row) => <tr key={`${row.plo_id}:${row.course_id}`}><td className="px-4 py-3"><div className="font-semibold">{row.plo_code}</div><div className="text-muted-foreground">{row.program_code}</div></td><td className="px-4 py-3"><div className="font-medium">{row.course_code}</div><div className="max-w-[260px] truncate text-muted-foreground">{row.course_name}</div></td><td className="px-4 py-3"><Badge variant={row.attainment_pct < OUTCOME_TARGET ? "destructive" : "secondary"}>{pct(row.attainment_pct)}</Badge></td><td className="px-4 py-3 tabular-nums">{numberText(row.evidence_count)}</td><td className="px-4 py-3"><Link className="font-medium text-primary hover:underline" href={analyticsHref("/manager/analytics/courses", { course_id: row.course_id, program_id: row.program_id, semester_code: semester === "all" ? undefined : semester, source: "outcomes" })}>Xem môn</Link></td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">CLO driver chi tiết</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {driverClos.length ? driverClos.map((row) => (
            <div key={`${row.plo_id}:${row.clo_id}:${row.course_id}`} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2"><Badge variant="outline">{row.plo_code}</Badge><span className={row.attainment_pct < OUTCOME_TARGET ? "font-semibold text-destructive" : "font-semibold text-emerald-600"}>{pct(row.attainment_pct)}</span></div>
              <p className="mt-2 font-medium">{row.clo_code} · {row.clo_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.course_code} · {row.course_name}</p>
              <p className="mt-2 text-xs text-muted-foreground">{numberText(row.evidence_count)} bản ghi đánh giá</p>
            </div>
          )) : <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Chưa có CLO driver trong phạm vi hiện tại.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
