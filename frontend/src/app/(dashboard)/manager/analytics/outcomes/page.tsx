"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, Info, MessageSquare, RefreshCw, Target, TrendingDown } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterCombobox } from "@/components/ui/filter-combobox"
import {
  api,
  type ApiCloAttainment,
  type ApiCourse,
  type ApiDepartment,
  type ApiOutcomeGap,
  type ApiOutcomeRecalculation,
  type ApiPloAttainment,
  type ApiProgram,
} from "@/lib/api"

type Insight = {
  title: string
  value: string
  source: string
  formula: string
  interpretation: string
}

function scoreClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "bg-muted text-muted-foreground"
  if (value >= 75) return "bg-emerald-500 text-white"
  if (value >= 60) return "bg-amber-400 text-amber-950"
  return "bg-red-500 text-white"
}

function barColor(value: number | null | undefined) {
  if (value === null || value === undefined) return "#94a3b8"
  if (value >= 75) return "#22c55e"
  if (value >= 60) return "#f59e0b"
  return "#ef4444"
}

function fmt(value: number | null | undefined, suffix = "%") {
  return value === null || value === undefined ? "Chưa có" : `${value.toFixed(1)}${suffix}`
}

function clampPercent(value: number | null | undefined) {
  return Math.max(0, Math.min(100, value ?? 0))
}

function buildAgentUrl(question: string) {
  return `/chat?q=${encodeURIComponent(question)}`
}

export default function OutcomeAnalyticsPage() {
  const [programs, setPrograms] = React.useState<ApiProgram[]>([])
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [departmentId, setDepartmentId] = React.useState("")
  const [programId, setProgramId] = React.useState("")
  const [courseId, setCourseId] = React.useState("")
  const [plos, setPlos] = React.useState<ApiPloAttainment[]>([])
  const [courseClos, setCourseClos] = React.useState<ApiCloAttainment[]>([])
  const [gaps, setGaps] = React.useState<ApiOutcomeGap[]>([])
  const [threshold, setThreshold] = React.useState("50")
  const [lastRun, setLastRun] = React.useState<ApiOutcomeRecalculation | null>(null)
  const [selectedInsight, setSelectedInsight] = React.useState<Insight | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([
      api.getPrograms({ limit: 1000 }),
      api.getDepartments({ limit: 1000 }),
      api.getCourses({ limit: 5000 }),
    ])
      .then(([programRows, departmentRows, courseRows]) => {
        const firstProgram = programRows[0]
        const firstDepartmentId = firstProgram?.department_id
          ? String(firstProgram.department_id)
          : String(departmentRows[0]?.id ?? "")
        const firstCourse = courseRows.find((course) => (
          firstProgram
            ? course.department_id === firstProgram.department_id && course.program_ids.includes(firstProgram.id)
            : course.department_id === Number(firstDepartmentId)
        ))

        setPrograms(programRows)
        setDepartments(departmentRows)
        setCourses(courseRows)
        setDepartmentId(firstDepartmentId)
        setProgramId(String(firstProgram?.id ?? ""))
        setCourseId(String(firstCourse?.id ?? ""))
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được danh sách lọc"))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    if (!programId) return
    let active = true

    void (async () => {
      setRefreshing(true)
      setError(null)
      try {
        const [ploRows, gapRows] = await Promise.all([
          api.getProgramPloAttainment(Number(programId)),
          api.getOutcomeGaps({ program_id: Number(programId), limit: 12 }),
        ])
        if (!active) return
        setPlos(ploRows)
        setGaps(gapRows)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Không tải được dữ liệu CLO/PLO")
      } finally {
        if (active) setRefreshing(false)
      }
    })()

    return () => {
      active = false
    }
  }, [programId])

  React.useEffect(() => {
    if (!courseId) return
    let active = true

    void (async () => {
      try {
        const rows = await api.getCourseCloAttainment(Number(courseId))
        if (active) setCourseClos(rows)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Không tải được dữ liệu CLO của môn")
      }
    })()

    return () => {
      active = false
    }
  }, [courseId])

  const selectedProgram = programs.find((item) => String(item.id) === programId)
  const department = departments.find((item) => String(item.id) === departmentId)
  const selectedCourse = courses.find((item) => String(item.id) === courseId)
  const filteredPrograms = programs.filter((item) => !departmentId || item.department_id === Number(departmentId))
  const filteredCourses = courses.filter((item) => {
    if (departmentId && item.department_id !== Number(departmentId)) return false
    if (programId && item.program_ids.length && !item.program_ids.includes(Number(programId))) return false
    return true
  })
  const weakPlos = plos.filter((item) => item.attainment_rate < 60)
  const avgAttainment = plos.length ? plos.reduce((sum, item) => sum + item.attainment_rate, 0) / plos.length : 0
  const assessedStudents = plos.length ? Math.max(...plos.map((item) => item.assessed_students)) : 0
  const ploGaps = gaps.filter((item) => item.scope_type === "plo")
  const cloGaps = gaps.filter((item) => item.scope_type === "clo")
  const assessedClos = courseClos.filter((item) => item.assessed_enrollments > 0)
  const courseAvgClo = assessedClos.length
    ? assessedClos.reduce((sum, item) => sum + (item.attainment_rate ?? 0), 0) / assessedClos.length
    : null

  const showKpiInsight = (title: string, value: string, formula: string, interpretation: string) => {
    setSelectedInsight({
      title,
      value,
      source: "Dữ liệu lấy từ bảng PLO/CLO achievement đã tính lại từ điểm thành phần, mapping CLO-PLO và ngưỡng đạt đang chọn.",
      formula,
      interpretation,
    })
  }

  const showPloInsight = (item: ApiPloAttainment) => {
    setSelectedInsight({
      title: `${item.code} · ${item.name}`,
      value: fmt(item.attainment_rate),
      source: `${item.assessed_students.toLocaleString()} sinh viên có dữ liệu, ${item.evidence_count.toLocaleString()} minh chứng CLO liên quan.`,
      formula: "PLO score = trung bình có trọng số từ các CLO map sang PLO. Tỷ lệ đạt = số sinh viên có PLO score >= ngưỡng / số sinh viên được đánh giá.",
      interpretation: item.attainment_rate >= 75
        ? "PLO đang ổn ở mức tổng hợp, nhưng vẫn cần soi CLO/môn để tránh che mất điểm yếu cục bộ."
        : item.attainment_rate >= 60
          ? "PLO ở vùng theo dõi. Nên xem các CLO/môn có tỷ lệ thấp nhất để xác định nguyên nhân."
          : "PLO đang rủi ro. Cần kiểm tra mapping CLO-PLO, rubric và phân phối điểm của các môn đóng góp.",
    })
  }

  const showCloInsight = (item: ApiCloAttainment) => {
    setSelectedInsight({
      title: `${item.code} · ${item.name}`,
      value: fmt(item.attainment_rate),
      source: `${item.achieved_enrollments.toLocaleString()}/${item.assessed_enrollments.toLocaleString()} lượt đánh giá đạt, điểm trung bình ${fmt(item.avg_score, "")}.`,
      formula: "CLO score lấy từ điểm thành phần được map vào CLO. Tỷ lệ đạt = số lượt có CLO score >= ngưỡng / số lượt được đánh giá.",
      interpretation: item.assessed_enrollments === 0
        ? "CLO thiếu minh chứng. Cần map thêm điểm thành phần hoặc kiểm tra dữ liệu điểm của môn."
        : (item.attainment_rate ?? 0) < 60
          ? "CLO yếu. Nên xem lại rubric, đề đánh giá, hoặc cách mapping điểm thành phần vào CLO."
          : "CLO đang ổn theo dữ liệu hiện có. Vẫn nên kiểm tra nếu điểm quá đẹp hoặc số lượt đánh giá quá thấp.",
    })
  }

  const handleDepartmentChange = (value: string) => {
    setDepartmentId(value)
    const nextProgram = programs.find((item) => item.department_id === Number(value))
    const nextCourse = courses.find((item) => (
      item.department_id === Number(value)
      && (!nextProgram || !item.program_ids.length || item.program_ids.includes(nextProgram.id))
    ))
    setProgramId(String(nextProgram?.id ?? ""))
    setCourseId(String(nextCourse?.id ?? ""))
    if (!nextCourse) setCourseClos([])
  }

  const handleProgramChange = (value: string) => {
    setProgramId(value)
    const nextProgram = programs.find((item) => String(item.id) === value)
    const nextCourse = courses.find((item) => (
      (!departmentId || item.department_id === Number(departmentId))
      && (!item.program_ids.length || item.program_ids.includes(Number(value)))
    ))
    setCourseId(String(nextCourse?.id ?? ""))
    if (!nextCourse) setCourseClos([])
  }

  const handleRecalculate = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const result = await api.recalculateOutcomes(Number(threshold))
      setLastRun(result)
      const [ploRows, gapRows, cloRows] = await Promise.all([
        api.getProgramPloAttainment(Number(programId)),
        api.getOutcomeGaps({ program_id: Number(programId), limit: 12 }),
        courseId ? api.getCourseCloAttainment(Number(courseId)) : Promise.resolve([]),
      ])
      setPlos(ploRows)
      setGaps(gapRows)
      setCourseClos(cloRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tính lại được CLO/PLO")
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Đang tải hệ thống CLO/PLO...</div>
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Experimental data warning — CLO/PLO data is auto-seeded, not officially validated */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>
          <span className="font-semibold">Dữ liệu thử nghiệm (Experimental).</span>{" "}
          Dữ liệu CLO/PLO hiện tại được tạo tự động và chưa được xác nhận chính thức. Không sử dụng cho kết luận học thuật hoặc kiểm định.
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Đánh giá CLO/PLO</h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi chuẩn đầu ra theo khoa, ngành và môn học; click vào chỉ số để xem cách tính.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-full text-xs font-medium text-muted-foreground">
            Bộ lọc: Khoa quản lý môn → Ngành có môn thuộc khoa → Môn học → Ngưỡng đạt
          </div>
          <FilterCombobox
            className="w-72"
            placeholder="Chọn khoa…"
            value={departmentId}
            onValueChange={(v) => handleDepartmentChange(v)}
            clearValue=""
            options={departments.map(item => ({ value: String(item.id), label: item.name }))}
          />
          <FilterCombobox
            className="w-72"
            placeholder="Chọn ngành…"
            value={programId}
            onValueChange={(v) => handleProgramChange(v)}
            clearValue=""
            options={filteredPrograms.map(item => ({ value: String(item.id), label: item.name, description: item.code }))}
          />
          <FilterCombobox
            className="w-72"
            placeholder="Chọn môn học…"
            value={courseId}
            onValueChange={(v) => setCourseId(v)}
            clearValue=""
            options={filteredCourses.map(item => ({ value: String(item.id), label: item.name, description: item.code }))}
          />
          <FilterCombobox
            className="w-36"
            placeholder="Ngưỡng đạt"
            value={threshold}
            onValueChange={(v) => setThreshold(v)}
            clearValue=""
            options={[
              { value: "50", label: "Đạt từ 50%" },
              { value: "60", label: "Đạt từ 60%" },
              { value: "70", label: "Đạt từ 70%" },
            ]}
          />
          <Button onClick={handleRecalculate} disabled={!programId || refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            Tính lại
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-900">
          <CardContent className="flex items-center gap-2 py-3 text-sm">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">{selectedProgram?.name ?? "Chưa chọn ngành"}</p>
              <p className="text-xs text-muted-foreground">
                {selectedProgram?.code ?? "--"} · {department?.name ?? "Chưa rõ khoa"} · {selectedCourse?.code ?? "Chưa chọn môn"}
              </p>
            </div>
          </div>
          {lastRun ? (
            <Badge variant="secondary">
              Vừa tính lại: {lastRun.clo_rows.toLocaleString()} CLO, {lastRun.plo_rows.toLocaleString()} PLO
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        title="Hover/click chỉ số để xem công thức. PLO đạt TB = trung bình attainment_rate các PLO; PLO dưới 60% = số PLO có attainment_rate < 60%; SV có bằng chứng = số sinh viên có dữ liệu đánh giá trong PLO."
      >
        <button type="button" onClick={() => showKpiInsight("PLO đang theo dõi", String(plos.length), "Đếm số PLO có trong chương trình được chọn.", "Con số này cho biết dashboard đang đánh giá bao nhiêu chuẩn đầu ra cấp chương trình.")} className="text-left">
          <Card className="h-full hover:border-primary/50"><CardContent className="flex items-start justify-between pt-5"><div><p className="text-xs text-muted-foreground">PLO đang theo dõi</p><p className="mt-1 text-2xl font-bold">{plos.length}</p></div><Target className="h-5 w-5 text-primary" /></CardContent></Card>
        </button>
        <button type="button" onClick={() => showKpiInsight("Tỷ lệ đạt PLO trung bình", fmt(avgAttainment), "Trung bình cộng attainment_rate của các PLO trong ngành đang chọn.", "Nếu số này quá đẹp, hãy soi từng PLO và CLO/môn để phát hiện điểm yếu bị che bởi trung bình.")} className="text-left">
          <Card className="h-full hover:border-primary/50"><CardContent className="flex items-start justify-between pt-5"><div><p className="text-xs text-muted-foreground">Tỷ lệ đạt TB</p><p className="mt-1 text-2xl font-bold">{fmt(avgAttainment)}</p></div><CheckCircle2 className="h-5 w-5 text-emerald-500" /></CardContent></Card>
        </button>
        <button type="button" onClick={() => showKpiInsight("PLO dưới 60%", String(weakPlos.length), "Đếm PLO có attainment_rate < 60%.", "Đây là nhóm cần ưu tiên kiểm tra vì có nguy cơ không đạt chuẩn đầu ra.")} className="text-left">
          <Card className="h-full hover:border-primary/50"><CardContent className="flex items-start justify-between pt-5"><div><p className="text-xs text-muted-foreground">PLO dưới 60%</p><p className="mt-1 text-2xl font-bold">{weakPlos.length}</p></div><TrendingDown className="h-5 w-5 text-red-500" /></CardContent></Card>
        </button>
        <button type="button" onClick={() => showKpiInsight("Sinh viên có bằng chứng", assessedStudents.toLocaleString(), "Lấy số sinh viên lớn nhất có dữ liệu đánh giá trong các PLO.", "Nếu số này thấp hơn quy mô thật của ngành, dữ liệu mapping hoặc điểm thành phần đang thiếu.")} className="text-left">
          <Card className="h-full hover:border-primary/50"><CardContent className="flex items-start justify-between pt-5"><div><p className="text-xs text-muted-foreground">SV có bằng chứng</p><p className="mt-1 text-2xl font-bold">{assessedStudents.toLocaleString()}</p></div><CheckCircle2 className="h-5 w-5 text-blue-500" /></CardContent></Card>
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><Info className="h-4 w-4" /> Cách tính chỉ số đang chọn</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-[0.7fr_1.3fr]">
          {selectedInsight ? (
            <>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{selectedInsight.title}</p>
                <p className="mt-1 text-2xl font-bold">{selectedInsight.value}</p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<a href={buildAgentUrl(`Hãy giải thích sâu chỉ số "${selectedInsight.title}" trong dashboard CLO/PLO. Giá trị hiện tại: ${selectedInsight.value}. Công thức: ${selectedInsight.formula}. Nguồn dữ liệu: ${selectedInsight.source}. Scope hiện tại: khoa ${department?.name ?? "chưa chọn"}, ngành ${selectedProgram?.name ?? "chưa chọn"}, môn ${selectedCourse?.name ?? "chưa chọn"}.`)} />}
                >
                  <MessageSquare className="h-4 w-4" />
                  Hỏi AI
                </Button>
              </div>
              <div className="space-y-2">
                <p><span className="font-medium">Nguồn dữ liệu:</span> {selectedInsight.source}</p>
                <p><span className="font-medium">Công thức:</span> {selectedInsight.formula}</p>
                <p><span className="font-medium">Diễn giải:</span> {selectedInsight.interpretation}</p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground md:col-span-2">Click vào KPI, cột PLO hoặc dòng CLO để xem chỉ số được tính từ dữ liệu nào và có đáng tin hay không.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CLO của môn đang chọn: {selectedCourse ? `${selectedCourse.code} · ${selectedCourse.name}` : "Chưa chọn môn"}</CardTitle>
          <p className="text-xs text-muted-foreground">Soi cấp môn để kiểm tra vì sao PLO cao/thấp, tránh chỉ nhìn số tổng hợp cấp ngành.</p>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">CLO của môn</p><p className="mt-1 text-xl font-bold">{courseClos.length}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">CLO có dữ liệu</p><p className="mt-1 text-xl font-bold">{assessedClos.length}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Tỷ lệ đạt TB</p><p className="mt-1 text-xl font-bold">{fmt(courseAvgClo)}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr className="border-b bg-muted/40">{["CLO", "Điểm TB", "Tỷ lệ đạt", "Đạt/lượt đánh giá", "Nhận định"].map((item) => <th key={item} className="px-4 py-3 text-left font-medium text-muted-foreground">{item}</th>)}</tr></thead>
              <tbody className="divide-y">
                {courseClos.map((item) => (
                  <tr
                    key={item.clo_id}
                    title="Công thức: CLO attainment = số lượt có CLO score >= ngưỡng / số lượt được đánh giá. CLO score lấy từ điểm thành phần map vào CLO."
                    onClick={() => showCloInsight(item)}
                    className="cursor-pointer hover:bg-muted/20"
                  >
                    <td className="px-4 py-3"><p className="font-medium">{item.code}</p><p className="line-clamp-1 text-muted-foreground">{item.name}</p></td>
                    <td className="px-4 py-3">{fmt(item.avg_score, "")}</td>
                    <td className="px-4 py-3"><Badge variant={(item.attainment_rate ?? 0) < 60 ? "destructive" : "secondary"}>{fmt(item.attainment_rate)}</Badge></td>
                    <td className="px-4 py-3">{item.achieved_enrollments.toLocaleString()}/{item.assessed_enrollments.toLocaleString()}</td>
                    <td className="px-4 py-3">{item.assessed_enrollments === 0 ? "Thiếu minh chứng" : (item.attainment_rate ?? 0) < 60 ? "Cần xem lại rubric/điểm TP" : "Đang ổn"}</td>
                  </tr>
                ))}
                {!courseClos.length ? <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Chưa có CLO cho môn đang chọn.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-sm">Mức đạt từng PLO</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={plos} margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <ChartTooltip formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Tỷ lệ đạt"]} labelFormatter={(label) => `Click để xem cách tính ${label}`} />
                <Bar dataKey="attainment_rate" radius={[4, 4, 0, 0]} onClick={(data) => showPloInsight(data.payload as ApiPloAttainment)}>
                  {plos.map((item) => <Cell key={item.plo_id} fill={barColor(item.attainment_rate)} className="cursor-pointer" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">PLO cần chú ý</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(weakPlos.length ? weakPlos : plos.slice().sort((a, b) => a.attainment_rate - b.attainment_rate).slice(0, 3)).map((item) => (
              <button
                type="button"
                key={item.plo_id}
                title="Công thức: PLO score = trung bình có trọng số từ các CLO map sang PLO. PLO attainment = số sinh viên đạt PLO / số sinh viên được đánh giá."
                onClick={() => showPloInsight(item)}
                className="w-full text-left"
              >
                <div className="space-y-1 rounded-md border p-3 hover:border-primary/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.code} · {item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.assessed_students.toLocaleString()} SV · {item.evidence_count.toLocaleString()} minh chứng</p>
                    </div>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${scoreClass(item.attainment_rate)}`}>{fmt(item.attainment_rate)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full rounded-full ${item.attainment_rate >= 60 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${clampPercent(item.attainment_rate)}%` }} />
                  </div>
                </div>
              </button>
            ))}
            {!plos.length ? <p className="text-sm text-muted-foreground">Chưa có dữ liệu PLO cho ngành này.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Khoảng trống PLO</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-xs">
              <thead><tr className="border-b bg-muted/40">{["PLO", "Điểm TB", "Tỷ lệ đạt", "SV đánh giá", "Ưu tiên"].map((item) => <th key={item} className="px-4 py-3 text-left font-medium text-muted-foreground">{item}</th>)}</tr></thead>
              <tbody className="divide-y">
                {ploGaps.map((item) => (
                  <tr key={`${item.scope_type}-${item.id}`} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><p className="font-medium">{item.code}</p><p className="line-clamp-1 text-muted-foreground">{item.name}</p></td>
                    <td className="px-4 py-3">{fmt(item.avg_score, "")}</td>
                    <td className="px-4 py-3"><Badge variant={(item.attainment_rate ?? 0) < 60 ? "destructive" : "secondary"}>{fmt(item.attainment_rate)}</Badge></td>
                    <td className="px-4 py-3">{item.assessed_count.toLocaleString()}</td>
                    <td className="px-4 py-3">{(item.attainment_rate ?? 0) < 50 ? "Cao" : "Theo dõi"}</td>
                  </tr>
                ))}
                {!ploGaps.length ? <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Không có PLO rủi ro trong ngưỡng hiện tại.</td></tr> : null}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">CLO/môn kéo chuẩn đầu ra xuống</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr className="border-b bg-muted/40">{["CLO", "Môn", "Điểm TB", "Tỷ lệ đạt", "Lượt đánh giá"].map((item) => <th key={item} className="px-4 py-3 text-left font-medium text-muted-foreground">{item}</th>)}</tr></thead>
              <tbody className="divide-y">
                {cloGaps.map((item) => (
                  <tr key={`${item.scope_type}-${item.id}`} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><p className="font-medium">{item.code}</p><p className="line-clamp-1 text-muted-foreground">{item.name}</p></td>
                    <td className="px-4 py-3"><span className="font-medium">{item.parent_code}</span></td>
                    <td className="px-4 py-3">{fmt(item.avg_score, "")}</td>
                    <td className="px-4 py-3"><Badge variant={(item.attainment_rate ?? 0) < 60 ? "destructive" : "secondary"}>{fmt(item.attainment_rate)}</Badge></td>
                    <td className="px-4 py-3">{item.assessed_count.toLocaleString()}</td>
                  </tr>
                ))}
                {!cloGaps.length ? <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Không có CLO rủi ro trong ngưỡng hiện tại.</td></tr> : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
