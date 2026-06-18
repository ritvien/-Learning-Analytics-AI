"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterCombobox } from "@/components/ui/filter-combobox"
import {
  api,
  type ApiCourse,
  type ApiDepartment,
  type ApiEnrollment,
  type ApiProgram,
  type ApiSection,
  type ApiSemester,
  type ApiStudent,
} from "@/lib/api"

// ─── GPA tier definitions (4.0 scale) ────────────────────────────────────────
const GPA_TIERS = [
  { key: "xuat_sac", label: "Xuất sắc",    min: 3.6, max: 4.1,  color: "#10b981" },
  { key: "gioi",     label: "Giỏi",         min: 3.2, max: 3.6,  color: "#3b82f6" },
  { key: "kha",      label: "Khá",          min: 2.5, max: 3.2,  color: "#a3e635" },
  { key: "tb",       label: "Trung bình",   min: 2.0, max: 2.5,  color: "#f59e0b" },
  { key: "nguy_co",  label: "Nguy cơ",      min: 0,   max: 2.0,  color: "#ef4444" },
]

type UnitStat = {
  id: number
  name: string
  shortName: string
  parentName?: string
  activeStudents: number
  totalEnrollments: number
  passRate: number
  failRate: number
  avgGpa: number
  atRisk: number
  atRiskPct: number
  avgGrade: number
  worstCourse: string
  gpaTiers: Record<string, number>
  prevPassRate: number | null
  trend: "up" | "down" | "stable" | null
}

type Raw = {
  departments: ApiDepartment[]
  programs: ApiProgram[]
  students: ApiStudent[]
  enrollments: ApiEnrollment[]
  sections: ApiSection[]
  semesters: ApiSemester[]
  courses: ApiCourse[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function pct(a: number, b: number) { return b > 0 ? +(a / b * 100).toFixed(1) : 0 }
function wavg(arr: number[]) { return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0 }
function passColor(r: number) { return r >= 75 ? "#22c55e" : r >= 60 ? "#f59e0b" : "#ef4444" }
function gpaColor(g: number) { return g >= 3.2 ? "#22c55e" : g >= 2.5 ? "#3b82f6" : g >= 2.0 ? "#f59e0b" : "#ef4444" }
function shortLabel(name: string, max = 22) {
  const s = name.replace(/^(Khoa|Ngành|Bộ môn)\s+/i, "")
  return s.length > max ? s.slice(0, max) + "…" : s
}

function heatCls(v: number) {
  if (v >= 80) return "bg-emerald-500 text-white"
  if (v >= 70) return "bg-emerald-300 text-emerald-900"
  if (v >= 60) return "bg-yellow-300 text-yellow-900"
  if (v >= 50) return "bg-orange-400 text-white"
  return "bg-red-500 text-white"
}

// ─── page ────────────────────────────────────────────────────────────────────
export default function DeptComparisonPage() {
  const [raw, setRaw] = React.useState<Raw | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [analysisLevel, setAnalysisLevel] = React.useState<"dept" | "program">("dept")
  const [selectedSemCode, setSelectedSemCode] = React.useState("all")
  const [selectedDeptId, setSelectedDeptId] = React.useState("all")
  const [minEnrollment, setMinEnrollment] = React.useState("5")
  const [expandedRow, setExpandedRow] = React.useState<number | null>(null)
  const [sortField, setSortField] = React.useState("passRate")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")

  React.useEffect(() => {
    Promise.all([
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 1000 }),
      api.getStudents({ limit: 50000 }),
      api.getEnrollments({ limit: 50000 }),
      api.getSections({ limit: 50000 }),
      api.getSemesters(),
      api.getCourses({ limit: 5000 }),
    ])
      .then(([departments, programs, students, enrollments, sections, semesters, courses]) =>
        setRaw({ departments, programs, students, enrollments, sections, semesters, courses }),
      )
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── static maps ────────────────────────────────────────────────────────────
  const maps = React.useMemo(() => {
    if (!raw) return null
    const secMap = new Map(raw.sections.map((s) => [s.id, s]))
    const progMap = new Map(raw.programs.map((p) => [p.id, p]))
    const deptMap = new Map(raw.departments.map((d) => [d.id, d]))
    const courseMap = new Map(raw.courses.map((c) => [c.id, c]))
    return { secMap, progMap, deptMap, courseMap }
  }, [raw])

  // ── sorted semesters ────────────────────────────────────────────────────────
  const sortedSems = React.useMemo(() => {
    if (!raw) return []
    return [...raw.semesters].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.term - b.term,
    )
  }, [raw])

  // ── active students ─────────────────────────────────────────────────────────
  const activeStudents = React.useMemo(
    () => raw?.students.filter((s) => s.status === "active") ?? [],
    [raw],
  )

  // ── semester IDs for trend ──────────────────────────────────────────────────
  const { currentSemId, prevSemId } = React.useMemo(() => {
    if (sortedSems.length === 0) return { currentSemId: null, prevSemId: null }
    if (selectedSemCode === "all") {
      const n = sortedSems.length
      return { currentSemId: sortedSems[n - 1]?.id ?? null, prevSemId: sortedSems[n - 2]?.id ?? null }
    }
    const idx = sortedSems.findIndex((s) => s.code === selectedSemCode)
    return {
      currentSemId: idx >= 0 ? sortedSems[idx].id : null,
      prevSemId: idx > 0 ? sortedSems[idx - 1].id : null,
    }
  }, [sortedSems, selectedSemCode])

  // ── enrollments for selected semester ──────────────────────────────────────
  const filteredEnrolls = React.useMemo(() => {
    if (!raw || !maps) return []
    const activeIds = new Set(activeStudents.map((s) => s.id))
    const semId = selectedSemCode === "all"
      ? null
      : sortedSems.find((s) => s.code === selectedSemCode)?.id ?? null
    return raw.enrollments.filter((e) => {
      if (!activeIds.has(e.student_id)) return false
      if (semId !== null) return maps.secMap.get(e.section_id)?.semester_id === semId
      return true
    })
  }, [raw, maps, activeStudents, selectedSemCode, sortedSems])

  // ── enrollments for previous semester (trend) ───────────────────────────────
  const prevEnrolls = React.useMemo(() => {
    if (!raw || !maps || !prevSemId) return []
    const activeIds = new Set(activeStudents.map((s) => s.id))
    return raw.enrollments.filter(
      (e) => activeIds.has(e.student_id) && maps.secMap.get(e.section_id)?.semester_id === prevSemId,
    )
  }, [raw, maps, activeStudents, prevSemId])

  // ── unit list (departments OR programs) ────────────────────────────────────
  const units = React.useMemo(() => {
    if (!raw || !maps) return []
    if (analysisLevel === "dept") {
      return raw.departments.map((d) => ({ id: d.id, name: d.name, parentName: undefined as string | undefined }))
    }
    return raw.programs
      .filter((p) => selectedDeptId === "all" || p.department_id === Number(selectedDeptId))
      .map((p) => ({
        id: p.id,
        name: p.name,
        parentName: maps.deptMap.get(p.department_id)?.name,
      }))
  }, [raw, maps, analysisLevel, selectedDeptId])

  // ── precompute student sets per unit ────────────────────────────────────────
  const unitStudentSets = React.useMemo(() => {
    const result = new Map<number, Set<number>>()
    if (!raw || !maps) return result
    for (const unit of units) {
      const ids = new Set<number>()
      if (analysisLevel === "dept") {
        for (const s of activeStudents) {
          const prog = maps.progMap.get(s.program_id)
          if (prog?.department_id === unit.id) ids.add(s.id)
        }
      } else {
        for (const s of activeStudents) {
          if (s.program_id === unit.id) ids.add(s.id)
        }
      }
      result.set(unit.id, ids)
    }
    return result
  }, [raw, maps, units, analysisLevel, activeStudents])

  // ── compute stats for every unit ───────────────────────────────────────────
  const unitStats: UnitStat[] = React.useMemo(() => {
    if (!raw || !maps || units.length === 0) return []
    const minE = Number(minEnrollment) || 0

    return units.flatMap((unit) => {
      const studentIds = unitStudentSets.get(unit.id) ?? new Set<number>()
      const unitStudents = activeStudents.filter((s) => studentIds.has(s.id))

      const enrolls = filteredEnrolls.filter((e) => studentIds.has(e.student_id))
      const valid = enrolls.filter((e) => e.is_passed !== null)
      if (valid.length < minE) return []

      const passed = valid.filter((e) => e.is_passed).length
      const passRate = pct(passed, valid.length)
      const failRate = pct(valid.length - passed, valid.length)

      const gpas = unitStudents.flatMap((s) => s.gpa_cumulative !== null ? [s.gpa_cumulative] : [])
      const avgGpa = +wavg(gpas).toFixed(2)
      const atRisk = gpas.filter((g) => g < 2.0).length
      const atRiskPct = pct(atRisk, unitStudents.length)

      const grades = enrolls.flatMap((e) => e.final_grade !== null ? [e.final_grade] : [])
      const avgGrade = +wavg(grades).toFixed(2)

      // GPA tiers (%)
      const tierCounts = Object.fromEntries(GPA_TIERS.map((t) => [t.key, 0]))
      for (const g of gpas) {
        const t = GPA_TIERS.find((t) => g >= t.min && g < t.max)
        if (t) tierCounts[t.key]++
      }
      const gpaTiers = Object.fromEntries(
        GPA_TIERS.map((t) => [t.key, pct(tierCounts[t.key], gpas.length || 1)]),
      )

      // Worst course
      const cfMap = new Map<number, { t: number; f: number }>()
      for (const e of valid) {
        const courseId = maps.secMap.get(e.section_id)?.course_id
        if (!courseId) continue
        const s = cfMap.get(courseId) ?? { t: 0, f: 0 }
        s.t++
        if (!e.is_passed) s.f++
        cfMap.set(courseId, s)
      }
      let worstCourse = "—"
      let worstRate = 0
      for (const [cid, s] of cfMap.entries()) {
        if (s.t < 5) continue
        const r = s.f / s.t
        if (r > worstRate) {
          worstRate = r
          const c = maps.courseMap.get(cid)
          worstCourse = c ? (c.name.length > 34 ? c.name.slice(0, 34) + "…" : c.name) : `Môn ${cid}`
        }
      }

      // Trend
      let prevPassRate: number | null = null
      let trend: "up" | "down" | "stable" | null = null
      if (prevSemId !== null && prevEnrolls.length > 0) {
        const prev = prevEnrolls.filter((e) => studentIds.has(e.student_id) && e.is_passed !== null)
        if (prev.length >= 5) {
          prevPassRate = pct(prev.filter((e) => e.is_passed).length, prev.length)
          const diff = passRate - prevPassRate
          trend = diff > 2 ? "up" : diff < -2 ? "down" : "stable"
        }
      }

      return [{
        id: unit.id,
        name: unit.name,
        shortName: shortLabel(unit.name),
        parentName: unit.parentName,
        activeStudents: unitStudents.length,
        totalEnrollments: valid.length,
        passRate,
        failRate,
        avgGpa,
        atRisk,
        atRiskPct,
        avgGrade,
        worstCourse,
        gpaTiers,
        prevPassRate,
        trend,
      }]
    })
  }, [raw, maps, units, activeStudents, filteredEnrolls, prevEnrolls, prevSemId, minEnrollment, unitStudentSets])

  // ── sort helpers ────────────────────────────────────────────────────────────
  function toggleSort(field: string) {
    setSortDir((d) => (sortField === field ? (d === "asc" ? "desc" : "asc") : "asc"))
    setSortField(field)
  }
  function SortArrow({ field }: { field: string }) {
    if (sortField !== field) return <span className="ml-0.5 text-muted-foreground/40">↕</span>
    return <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
  }

  const tableRows = React.useMemo(() => {
    return [...unitStats].sort((a, b) => {
      const va = (a[sortField as keyof UnitStat] ?? 0) as number
      const vb = (b[sortField as keyof UnitStat] ?? 0) as number
      return sortDir === "asc" ? va - vb : vb - va
    })
  }, [unitStats, sortField, sortDir])

  // ── chart datasets ──────────────────────────────────────────────────────────
  const barPassData = React.useMemo(
    () => [...unitStats].filter((u) => u.totalEnrollments > 0).sort((a, b) => a.passRate - b.passRate),
    [unitStats],
  )
  const barGpaData = React.useMemo(
    () => [...unitStats].filter((u) => u.activeStudents > 0).sort((a, b) => a.avgGpa - b.avgGpa),
    [unitStats],
  )
  const scatterData = React.useMemo(
    () =>
      unitStats.map((u) => ({
        x: u.activeStudents,
        y: u.passRate,
        z: Math.max(u.atRisk, 1),
        name: u.shortName,
        fullName: u.name,
        passRate: u.passRate,
        students: u.activeStudents,
        atRisk: u.atRisk,
        avgGpa: u.avgGpa,
      })),
    [unitStats],
  )
  const stackedGpaData = React.useMemo(
    () =>
      [...unitStats]
        .filter((u) => u.activeStudents >= 5)
        .sort((a, b) => a.gpaTiers["nguy_co"] - b.gpaTiers["nguy_co"])
        .map((u) => ({ name: u.shortName, ...u.gpaTiers })),
    [unitStats],
  )
  const heatmapData = React.useMemo(() => {
    if (!raw || !maps) return null
    const sems = sortedSems.slice(-8)
    const activeIds = new Set(activeStudents.map((s) => s.id))
    const matrix = units.slice(0, 20).map((unit) => {
      const studentIds = unitStudentSets.get(unit.id) ?? new Set<number>()
      const cells = sems.map((sem) => {
        const es = raw.enrollments.filter(
          (e) =>
            activeIds.has(e.student_id) &&
            studentIds.has(e.student_id) &&
            maps.secMap.get(e.section_id)?.semester_id === sem.id &&
            e.is_passed !== null,
        )
        return es.length >= 5 ? pct(es.filter((e) => e.is_passed).length, es.length) : null
      })
      return { name: shortLabel(unit.name, 20), cells }
    })
    return { sems: sems.map((s) => s.code), matrix }
  }, [raw, maps, units, activeStudents, sortedSems, unitStudentSets])

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    if (unitStats.length === 0) return null
    const totalStudents = unitStats.reduce((s, u) => s + u.activeStudents, 0)
    const totalE = unitStats.reduce((s, u) => s + u.totalEnrollments, 0)
    const totalPassed = unitStats.reduce((s, u) => s + Math.round(u.passRate / 100 * u.totalEnrollments), 0)
    const weightedPassRate = pct(totalPassed, totalE)
    const weightedGpa = totalStudents > 0
      ? +(unitStats.reduce((s, u) => s + u.avgGpa * u.activeStudents, 0) / totalStudents).toFixed(2)
      : 0
    const rates = unitStats.filter((u) => u.totalEnrollments >= 10).map((u) => u.passRate)
    const spread = rates.length >= 2 ? +(Math.max(...rates) - Math.min(...rates)).toFixed(1) : null
    return { count: unitStats.length, totalStudents, weightedPassRate, weightedGpa, spread }
  }, [unitStats])

  // ─── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
        Đang tải dữ liệu so sánh...
      </div>
    )
  }

  const unitLabel = analysisLevel === "dept" ? "khoa" : "ngành"

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header + filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">So sánh Khoa / Ngành</h1>
          <p className="text-sm text-muted-foreground">
            Các đơn vị đào tạo đang chênh lệch như thế nào về pass rate, GPA và sinh viên nguy cơ?
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Cấp phân tích toggle */}
          <div className="flex overflow-hidden rounded-lg border text-sm">
            {(["dept", "program"] as const).map((lvl) => (
              <button
                key={lvl}
                className={`px-3 py-1.5 transition-colors ${
                  analysisLevel === lvl
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => { setAnalysisLevel(lvl); setSelectedDeptId("all"); setExpandedRow(null) }}
              >
                {lvl === "dept" ? "Khoa" : "Ngành"}
              </button>
            ))}
          </div>

          <FilterCombobox
            className="w-48"
            placeholder="Tất cả học kỳ"
            value={selectedSemCode}
            onValueChange={(v) => setSelectedSemCode(v)}
            options={sortedSems.map((s) => ({ value: s.code, label: s.name }))}
          />

          {analysisLevel === "program" && (
            <FilterCombobox
              className="w-60"
              placeholder="Tất cả khoa"
              value={selectedDeptId}
              onValueChange={(v) => setSelectedDeptId(v)}
              options={(raw?.departments ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
            />
          )}

          <FilterCombobox
            className="w-44"
            placeholder="Min enroll: Tất cả"
            value={minEnrollment}
            onValueChange={(v) => setMinEnrollment(v)}
            clearValue="0"
            options={[
              { value: "5",   label: "Min enroll ≥ 5" },
              { value: "20",  label: "Min enroll ≥ 20" },
              { value: "50",  label: "Min enroll ≥ 50" },
              { value: "100", label: "Min enroll ≥ 100" },
            ]}
          />
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      {kpis && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            {
              label: `Số ${unitLabel}`,
              value: kpis.count,
              icon: analysisLevel === "dept" ? Building2 : GraduationCap,
              color: "text-indigo-500",
            },
            { label: "Tổng SV active", value: kpis.totalStudents.toLocaleString("vi-VN"), icon: Users, color: "text-blue-500" },
            { label: "Pass rate TB (weighted)", value: `${kpis.weightedPassRate}%`, icon: CheckCircle2, color: "text-emerald-500" },
            { label: "GPA TB", value: kpis.weightedGpa.toFixed(2), icon: TrendingUp, color: "text-primary" },
            {
              label: "Chênh lệch pass rate",
              value: kpis.spread !== null ? `${kpis.spread}%` : "—",
              sub: kpis.spread !== null ? "cao nhất − thấp nhất" : undefined,
              icon: AlertTriangle,
              color: (kpis.spread ?? 0) > 20 ? "text-red-500" : "text-amber-500",
            },
          ].map((k, i) => (
            <Card key={i}>
              <CardContent className="flex items-start justify-between pt-5">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{k.value}</p>
                  {"sub" in k && k.sub && <p className="text-[10px] text-muted-foreground">{k.sub}</p>}
                </div>
                <k.icon className={`h-5 w-5 ${k.color}`} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Row 1: Pass rate bar + GPA bar ───────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pass rate theo {unitLabel}</CardTitle>
            <p className="text-xs text-muted-foreground">Sắp xếp tăng dần — đơn vị yếu nhất ở trên</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, barPassData.length * 38)}>
              <BarChart data={barPassData} layout="vertical" margin={{ left: 8, right: 56 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="shortName" width={155} tick={{ fontSize: 10 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as UnitStat
                    return (
                      <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                        <p className="font-semibold">{d.name}</p>
                        <p>Pass rate: <strong>{d.passRate}%</strong></p>
                        <p>Enrollment: {d.totalEnrollments}</p>
                        <p>SV nguy cơ: {d.atRisk}</p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="passRate"
                  radius={[0, 4, 4, 0]}
                  label={{ position: "right", fontSize: 11, formatter: (v: number) => `${v}%` }}
                >
                  {barPassData.map((d, i) => <Cell key={i} fill={passColor(d.passRate)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">GPA trung bình theo {unitLabel}</CardTitle>
            <p className="text-xs text-muted-foreground">Thang 4.0 — đường đỏ = ngưỡng nguy cơ 2.0</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, barGpaData.length * 38)}>
              <BarChart data={barGpaData} layout="vertical" margin={{ left: 8, right: 56 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 4]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="shortName" width={155} tick={{ fontSize: 10 }} />
                <ReferenceLine
                  x={2.0}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  label={{ value: "2.0", fill: "#ef4444", fontSize: 10, position: "insideTopLeft" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as UnitStat
                    return (
                      <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                        <p className="font-semibold">{d.name}</p>
                        <p>GPA TB: <strong>{d.avgGpa}</strong></p>
                        <p>SV active: {d.activeStudents}</p>
                        <p>SV nguy cơ: {d.atRisk} ({d.atRiskPct}%)</p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="avgGpa"
                  radius={[0, 4, 4, 0]}
                  label={{ position: "right", fontSize: 11 }}
                >
                  {barGpaData.map((d, i) => <Cell key={i} fill={gpaColor(d.avgGpa)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Bubble scatter + Stacked GPA ─────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quy mô vs Chất lượng</CardTitle>
            <p className="text-xs text-muted-foreground">
              X = SV active · Y = pass rate · Kích thước = số SV nguy cơ
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 28, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="SV active"
                  tick={{ fontSize: 10 }}
                  label={{ value: "Số SV active", position: "insideBottom", offset: -12, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Pass rate"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10 }}
                  label={{ value: "Pass rate", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="z" range={[50, 600]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                        <p className="font-semibold">{d.fullName}</p>
                        <p>SV active: <strong>{d.students}</strong></p>
                        <p>Pass rate: <strong>{d.passRate}%</strong></p>
                        <p>
                          SV nguy cơ:{" "}
                          <strong className="text-red-600">{d.atRisk}</strong>
                        </p>
                        <p>GPA TB: {d.avgGpa}</p>
                      </div>
                    )
                  }}
                />
                <Scatter data={scatterData} fillOpacity={0.7} strokeWidth={1}>
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={passColor(d.y)} stroke={passColor(d.y)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {[["#ef4444", "Pass <60%"], ["#f59e0b", "60–75%"], ["#22c55e", "≥75%"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
              <span>Bong bóng lớn hơn = nhiều SV nguy cơ hơn</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cơ cấu học lực theo {unitLabel}</CardTitle>
            <p className="text-xs text-muted-foreground">100% stacked — sắp xếp theo % nguy cơ tăng dần</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, stackedGpaData.length * 30)}>
              <BarChart data={stackedGpaData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={155} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v, name) => [`${v}%`, GPA_TIERS.find((t) => t.key === name)?.label ?? name]}
                />
                <Legend
                  formatter={(v) => GPA_TIERS.find((t) => t.key === v)?.label ?? v}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                {GPA_TIERS.map((tier) => (
                  <Bar key={tier.key} dataKey={tier.key} stackId="gpa" fill={tier.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Heatmap: unit × semester ──────────────────────────────────────── */}
      {heatmapData && heatmapData.matrix.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Pass rate theo {unitLabel} × học kỳ
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-xs">
              <thead>
                <tr>
                  <th className="w-44 pb-2 pr-3 text-left font-medium text-muted-foreground capitalize">
                    {unitLabel}
                  </th>
                  {heatmapData.sems.map((s) => (
                    <th key={s} className="min-w-[64px] pb-2 px-1 text-center font-medium text-muted-foreground">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {heatmapData.matrix.map((row, ri) => (
                  <tr key={ri}>
                    <td className="py-1.5 pr-3 text-[11px] font-medium leading-tight">{row.name}</td>
                    {row.cells.map((val, ci) => (
                      <td key={ci} className="py-1.5 px-1 text-center">
                        {val !== null ? (
                          <span
                            className={`inline-flex min-w-[48px] items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium ${heatCls(val)}`}
                          >
                            {val.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {[["bg-emerald-500","≥80%"],["bg-emerald-300","70–79%"],["bg-yellow-300","60–69%"],["bg-orange-400","50–59%"],["bg-red-500","<50%"]].map(([cls, lbl]) => (
                <span key={lbl} className="flex items-center gap-1">
                  <span className={`inline-block h-3 w-3 rounded ${cls}`} />
                  {lbl}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Bảng so sánh hiệu quả đào tạo theo {unitLabel}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Click tiêu đề cột để sắp xếp. Click hàng để xem chi tiết.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="w-6 px-3 py-3" />
                <th
                  className="cursor-pointer px-4 py-3 font-medium capitalize hover:text-foreground"
                  onClick={() => toggleSort("name")}
                >
                  {unitLabel}<SortArrow field="name" />
                </th>
                {analysisLevel === "program" && (
                  <th className="px-4 py-3 font-medium">Khoa quản lý</th>
                )}
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("activeStudents")}>SV active<SortArrow field="activeStudents" /></th>
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("totalEnrollments")}>Lượt học<SortArrow field="totalEnrollments" /></th>
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("passRate")}>Pass rate<SortArrow field="passRate" /></th>
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("failRate")}>Fail rate<SortArrow field="failRate" /></th>
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("avgGpa")}>GPA TB<SortArrow field="avgGpa" /></th>
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("atRisk")}>SV nguy cơ<SortArrow field="atRisk" /></th>
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("atRiskPct")}>% nguy cơ<SortArrow field="atRiskPct" /></th>
                <th className="cursor-pointer px-3 py-3 text-right font-medium hover:text-foreground" onClick={() => toggleSort("avgGrade")}>Điểm TB môn<SortArrow field="avgGrade" /></th>
                <th className="px-4 py-3 font-medium">Môn trượt nhiều nhất</th>
                <th className="px-3 py-3 text-center font-medium">Xu hướng</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {tableRows.map((row) => {
                const isOpen = expandedRow === row.id
                const colSpan = analysisLevel === "program" ? 15 : 14
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => setExpandedRow(isOpen ? null : row.id)}
                    >
                      <td className="px-3 py-3 text-muted-foreground">
                        {isOpen
                          ? <ChevronDown className="size-3.5" />
                          : <ChevronRight className="size-3.5" />}
                      </td>
                      <td className="px-4 py-3 font-medium leading-snug">{row.name}</td>
                      {analysisLevel === "program" && (
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{row.parentName}</td>
                      )}
                      <td className="px-3 py-3 text-right tabular-nums">{row.activeStudents}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.totalEnrollments}</td>
                      <td className="px-3 py-3 text-right">
                        <Badge variant={row.passRate < 60 ? "destructive" : "secondary"}>
                          {row.passRate}%
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.failRate}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className={row.avgGpa < 2.0 ? "font-semibold text-red-600" : row.avgGpa < 2.5 ? "text-amber-600" : ""}>
                          {row.avgGpa.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className={row.atRisk > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}>
                          {row.atRisk}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.atRiskPct}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.avgGrade.toFixed(2)}</td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-[11px] text-muted-foreground" title={row.worstCourse}>
                        {row.worstCourse}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.trend === "up" && <ArrowUp className="mx-auto size-4 text-emerald-500" />}
                        {row.trend === "down" && <ArrowDown className="mx-auto size-4 text-red-500" />}
                        {row.trend === "stable" && <ArrowRight className="mx-auto size-4 text-muted-foreground" />}
                        {row.trend === null && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={
                              analysisLevel === "dept"
                                ? `/manager/analytics/departments?dept=${row.id}`
                                : `/manager/analytics/programs?program=${row.id}`
                            }
                          >
                            <BookOpen className="size-3" />
                            Xem
                          </Link>
                        </Button>
                      </td>
                    </tr>

                    {/* ── expanded detail ─────────────────────────────── */}
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td colSpan={colSpan} className="px-6 py-4">
                          <div className="grid gap-4 sm:grid-cols-4">
                            {/* GPA mini bar */}
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Cơ cấu GPA
                              </p>
                              <div className="flex h-3 w-full overflow-hidden rounded">
                                {GPA_TIERS.map((t) => (
                                  row.gpaTiers[t.key] > 0 && (
                                    <div
                                      key={t.key}
                                      style={{ width: `${row.gpaTiers[t.key]}%`, background: t.color }}
                                      title={`${t.label}: ${row.gpaTiers[t.key]}%`}
                                    />
                                  )
                                ))}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                {GPA_TIERS.filter((t) => row.gpaTiers[t.key] > 0).map((t) => (
                                  <span key={t.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: t.color }} />
                                    {t.label}: {row.gpaTiers[t.key]}%
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Trend detail */}
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Xu hướng pass rate
                              </p>
                              {row.prevPassRate !== null ? (
                                <p className="text-xs">
                                  Kỳ trước: <strong>{row.prevPassRate}%</strong>
                                  {" → Kỳ này: "}
                                  <strong>{row.passRate}%</strong>
                                  {" ("}
                                  <span
                                    className={
                                      row.passRate > row.prevPassRate
                                        ? "text-emerald-600"
                                        : row.passRate < row.prevPassRate
                                          ? "text-red-600"
                                          : "text-muted-foreground"
                                    }
                                  >
                                    {row.passRate > row.prevPassRate ? "+" : ""}
                                    {(row.passRate - row.prevPassRate).toFixed(1)}%
                                  </span>
                                  {")"}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">Chưa đủ dữ liệu so sánh kỳ trước</p>
                              )}
                            </div>

                            {/* Worst course */}
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Môn kéo điểm nhiều nhất
                              </p>
                              <p className="text-xs">{row.worstCourse}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1.5">
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                                <Link
                                  href={
                                    analysisLevel === "dept"
                                      ? `/manager/analytics/departments?dept=${row.id}`
                                      : `/manager/analytics/programs?program=${row.id}`
                                  }
                                >
                                  <BookOpen className="size-3" />
                                  Xem chi tiết
                                </Link>
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                                <Link
                                  href={`/chat?q=${encodeURIComponent(
                                    `Phân tích ${row.name}: pass rate ${row.passRate}%, GPA TB ${row.avgGpa}, ${row.atRisk} SV nguy cơ. Nguyên nhân và đề xuất?`,
                                  )}`}
                                >
                                  Hỏi AI nguyên nhân
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
