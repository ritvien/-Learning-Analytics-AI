"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, Bot, FileText, ListTodo, RefreshCw, Target } from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { DetailPageSkeleton } from "@/components/loading/page-skeletons"
import {
  api,
  type ApiReport,
  type ApiDashboardSectionRow,
  type ApiDashboardSectionStudent,
  type ApiDashboardSectionStudents,
  type ApiInterventionWorkspace,
} from "@/lib/api"
import { sectionActionLabel, sectionPriorityLabel } from "@/lib/section-analytics"

function levelLabel(level: string) {
  return level === "high" ? "Ưu tiên" : level === "watch" ? "Theo dõi" : level === "pending" ? "Thiếu điểm" : "Ổn định"
}

function formatNumber(value: number | string | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === "") return "—"
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "—"
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function pct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "—"
  return `${formatNumber(value * 100, digits)}%`
}

function chartPayloadId(value: unknown) {
  const payload = value as { student_id?: unknown; payload?: { student_id?: unknown } }
  const parsed = Number(payload.payload?.student_id ?? payload.student_id)
  return Number.isFinite(parsed) ? parsed : null
}

function studentIntervention(student: ApiDashboardSectionStudent) {
  const grade = student.final_grade
  const dropout = student.dropout_probability
  if (grade === null) {
    return { key: "wait_for_grades", label: "Chờ điểm", reason: "Chưa có điểm tổng kết", color: "#64748b" }
  }
  if (grade < 4 && numberValue(dropout) >= 0.7) {
    return { key: "meet_now", label: "Gặp ngay", reason: "Điểm rất thấp + dropout cao", color: "#dc2626" }
  }
  if (grade < 5.5) {
    return { key: "academic_support", label: "Phụ đạo học thuật", reason: "Điểm dưới ngưỡng đạt", color: "#f97316" }
  }
  if (numberValue(dropout) >= 0.7) {
    return { key: "advisor_checkin", label: "Cố vấn liên hệ", reason: "Dropout ML cao dù đã đạt", color: "#8b5cf6" }
  }
  if (dropout === null) {
    return { key: "missing_ml", label: "Bổ sung dữ liệu", reason: "Chưa có dự đoán ML", color: "#64748b" }
  }
  return { key: "monitor", label: "Theo dõi nhẹ", reason: "Chưa có tín hiệu rủi ro mạnh", color: "#16a34a" }
}

function gradeBucket(grade: number | null) {
  if (grade === null) return "Thiếu điểm"
  if (grade < 4) return "0–4"
  if (grade < 5.5) return "4–5.5"
  if (grade < 7) return "5.5–7"
  if (grade < 8.5) return "7–8.5"
  return "8.5–10"
}

function TooltipShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border bg-background/95 p-3 text-xs shadow-lg">{children}</div>
}

function GradeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return <TooltipShell><div className="font-medium">Khoảng điểm {String(row.bucket ?? "")}</div><p className="mt-1 text-muted-foreground">{numberValue(row.count)} sinh viên</p></TooltipShell>
}

function SegmentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return <TooltipShell><div className="font-medium">{String(row.label ?? "")}</div><p className="mt-1 text-muted-foreground">{numberValue(row.value)} sinh viên · {String(row.reason ?? "")}</p></TooltipShell>
}

function StudentMatrixTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return <TooltipShell>
    <div className="font-medium">{String(row.student_code ?? "")} - {String(row.full_name ?? "")}</div>
    <p className="mt-1 text-muted-foreground">{String(row.reason ?? "")}</p>
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
      <span>Điểm</span><span className="text-right">{formatNumber(row.final_grade as number | null)}</span>
      <span>Dropout ML</span><span className="text-right">{row.dropout_probability === null ? "Chưa có" : pct(Number(row.dropout_probability))}</span>
      <span>Nhóm</span><span className="text-right">{String(row.action_label ?? "")}</span>
    </div>
  </TooltipShell>
}

function KpiCard({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: "danger" | "warning" | "success" }) {
  const toneClass = tone === "danger" ? "border-red-500/30" : tone === "warning" ? "border-amber-500/30" : tone === "success" ? "border-emerald-500/30" : ""
  return <Card className={toneClass}>
    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
    <CardContent><div className="text-2xl font-bold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent>
  </Card>
}

export function SectionAnalyticsDetail({ sectionId }: { sectionId: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [section, setSection] = React.useState<ApiDashboardSectionRow | null>(null)
  const [students, setStudents] = React.useState<ApiDashboardSectionStudents | null>(null)
  const [workspace, setWorkspace] = React.useState<ApiInterventionWorkspace | null>(null)
  const [risk, setRisk] = React.useState("all")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [reloadKey, setReloadKey] = React.useState(0)
  const [report, setReport] = React.useState<ApiReport | null>(null)
  const [reportLoading, setReportLoading] = React.useState(false)
  const [aiResponse, setAiResponse] = React.useState("")
  const [aiLoading, setAiLoading] = React.useState(false)

  const backHref = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("section_id")
    params.delete("source")
    const query = params.toString()
    return `/manager/analytics/sections${query ? `?${query}` : ""}`
  }, [searchParams])

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    Promise.all([
      api.getDashboardSection(sectionId),
      api.getDashboardSectionStudents(sectionId, { risk_level: risk === "all" ? undefined : risk, limit: 100 }),
      api.getSectionInterventionWorkspace(sectionId),
    ]).then(([detail, nextStudents, nextWorkspace]) => {
      if (!active) return
      setSection(detail.item)
      setStudents(nextStudents)
      setWorkspace(nextWorkspace)
    }).catch((reason: unknown) => {
      if (!active) return
      setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu lớp học phần.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey, risk, sectionId])

  async function createReport() {
    setReportLoading(true)
    setError("")
    try {
      const created = await api.generateReport({
        report_type: "section_intervention",
        scope_type: "section",
        scope_id: String(sectionId),
        semester_id: section?.semester_id,
      })
      setReport(created)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được báo cáo can thiệp.")
    } finally {
      setReportLoading(false)
    }
  }

  async function askAi() {
    setAiLoading(true)
    setError("")
    try {
      const answer = await api.askReportAgent({
        mode: "action_planning",
        message: `Hãy phân tích lớp ${section?.section_code ?? sectionId} và đề xuất kế hoạch can thiệp ưu tiên dựa trên aggregate, điểm, dropout ML và danh sách sinh viên cần hỗ trợ.`,
        context: {
          route: `/manager/analytics/sections/${sectionId}`,
          scope_type: "section",
          section_id: sectionId,
          section,
          student_evidence: students?.items.slice(0, 20),
          intervention_summary: workspace?.summary,
        },
      })
      setAiResponse(answer.response)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không hỏi được AI cho lớp này.")
    } finally {
      setAiLoading(false)
    }
  }

  const studentItems = students?.items ?? []
  const failedRate = section?.student_count ? (section.failed_count / section.student_count) * 100 : 0
  const primaryAction = section?.recommended_action ? sectionActionLabel(section.recommended_action) : "Xem bằng chứng sinh viên"
  const diagnosis = section
    ? section.failed_count > 0
      ? `${section.failed_count}/${section.student_count} sinh viên chưa đạt; tỷ lệ đạt ${formatNumber(section.pass_rate, 1)}%, điểm TB ${formatNumber(section.avg_grade)}.`
      : section.missing_grade_count > 0
        ? `${section.missing_grade_count} sinh viên chưa có điểm; cần hoàn thiện dữ liệu trước khi chốt can thiệp.`
        : "Lớp chưa có tín hiệu rủi ro học thuật mạnh trong aggregate hiện tại."
    : ""
  const gradeDistribution = React.useMemo(() => {
    const order = ["0–4", "4–5.5", "5.5–7", "7–8.5", "8.5–10", "Thiếu điểm"]
    const counts = new Map(order.map((bucket) => [bucket, 0]))
    studentItems.forEach((student) => counts.set(gradeBucket(student.final_grade), (counts.get(gradeBucket(student.final_grade)) ?? 0) + 1))
    return order.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }))
  }, [studentItems])
  const segments = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; reason: string; value: number; color: string }>()
    studentItems.forEach((student) => {
      const segment = studentIntervention(student)
      const current = map.get(segment.key) ?? { ...segment, value: 0 }
      current.value += 1
      map.set(segment.key, current)
    })
    return Array.from(map.values()).sort((a, b) => {
      const order = ["meet_now", "academic_support", "advisor_checkin", "wait_for_grades", "missing_ml", "monitor"]
      return order.indexOf(a.key) - order.indexOf(b.key)
    })
  }, [studentItems])
  const matrixData = React.useMemo(() => studentItems
    .filter((student) => student.final_grade !== null)
    .map((student) => {
      const segment = studentIntervention(student)
      return {
        ...student,
        x: numberValue(student.final_grade),
        y: student.dropout_probability === null ? 0 : numberValue(student.dropout_probability) * 100,
        reason: segment.reason,
        action_label: segment.label,
        color: segment.color,
      }
    }), [studentItems])
  const urgentStudents = React.useMemo(() => studentItems
    .map((student) => ({ student, segment: studentIntervention(student) }))
    .filter(({ segment }) => ["meet_now", "academic_support", "advisor_checkin", "wait_for_grades"].includes(segment.key))
    .slice(0, 8), [studentItems])

  if (loading && !section) return <DetailPageSkeleton message="Đang tải aggregate lớp..." />

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href={backHref} className="mb-2 inline-flex items-center text-sm text-primary"><ArrowLeft className="mr-1 h-4 w-4" />Danh sách lớp</Link><h1 className="text-2xl font-bold">{section?.section_code ?? `Lớp #${sectionId}`}</h1><p className="text-sm text-muted-foreground">{section ? `${section.course_code} - ${section.course_name} · ${section.semester_name}` : ""}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Thử lại</Button><Button variant="outline" onClick={createReport} disabled={reportLoading || !section}><FileText className="mr-2 h-4 w-4" />{reportLoading ? "Đang tạo..." : "Tạo báo cáo"}</Button><Button variant="outline" onClick={askAi} disabled={aiLoading || !section}><Bot className="mr-2 h-4 w-4" />{aiLoading ? "Đang hỏi..." : "Hỏi AI"}</Button><Button onClick={() => router.push(`/manager/tasks?scope_type=section&scope_id=${sectionId}`)} disabled={!workspace?.students.length}><ListTodo className="mr-2 h-4 w-4" />Mở việc cần xử lý</Button></div>
    </div>
    {error ? <div className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error}</div> : null}
    {section ? <Card className={section.risk_level === "high" ? "border-red-500/30 bg-red-500/5" : "border-primary/20"}>
      <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600"><Target className="h-5 w-5" /></div>
          <div><div className="flex flex-wrap items-center gap-2"><Badge variant={section.risk_level === "high" ? "destructive" : "outline"}>{levelLabel(section.risk_level)}</Badge><span className="text-sm font-medium">{primaryAction}</span></div>
            <h2 className="mt-2 text-lg font-semibold">Chẩn đoán can thiệp lớp</h2>
            <p className="mt-1 text-sm text-muted-foreground">{diagnosis} {section.primary_reason ? sectionPriorityLabel(section.primary_reason) : ""}</p>
          </div>
        </div>
        <div className="grid min-w-64 grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border bg-background/70 p-3"><div className="text-xs text-muted-foreground">Chưa đạt</div><div className="text-xl font-bold text-red-600">{section.failed_count}</div><div className="text-xs text-muted-foreground">{formatNumber(failedRate, 1)}% sĩ số</div></div>
          <div className="rounded-md border bg-background/70 p-3"><div className="text-xs text-muted-foreground">Điểm TB</div><div className="text-xl font-bold">{formatNumber(section.avg_grade)}</div><div className="text-xs text-muted-foreground">Ngưỡng cảnh báo 5.5</div></div>
        </div>
      </CardContent>
    </Card> : null}
    {section ? <div className="grid gap-3 md:grid-cols-5">
      <KpiCard label="Sĩ số" value={section.student_count} note="Sinh viên trong lớp" />
      <KpiCard label="Chưa đạt" value={section.failed_count} note={`${formatNumber(failedRate, 1)}% cần hỗ trợ`} tone={section.failed_count ? "danger" : "success"} />
      <KpiCard label="Tỷ lệ đạt" value={`${formatNumber(section.pass_rate, 1)}%`} note="Theo điểm tổng kết" tone={section.pass_rate < 70 ? "warning" : "success"} />
      <KpiCard label="Điểm TB" value={formatNumber(section.avg_grade)} note="Trục X phân tích học lực" tone={section.avg_grade < 5.5 ? "warning" : "success"} />
      <KpiCard label="ML coverage" value={`${Math.round(section.prediction_coverage * 100)}%`} note={section.prediction_scored_at ? `Scored ${new Date(section.prediction_scored_at).toLocaleDateString("vi-VN")}` : "Chưa có scoring"} />
    </div> : null}
    {report ? <Card className="border-primary/30"><CardHeader><CardTitle className="text-base">Báo cáo đã tạo</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{report.title}</span><Button size="sm" variant="outline" onClick={() => router.push(`/manager/reports?report_id=${encodeURIComponent(report.id)}`)}>Mở báo cáo</Button></CardContent></Card> : null}
    {aiResponse ? <Card className="border-primary/30"><CardHeader><CardTitle className="text-base">Gợi ý AI</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm leading-6">{aiResponse}</CardContent></Card> : null}
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Phân bố điểm lớp</CardTitle><p className="text-xs text-muted-foreground">Nhìn nhanh lớp đang rơi ở vùng rớt nặng, sát ngưỡng hay đã đạt.</p></CardHeader><CardContent className="h-[320px]">{gradeDistribution.some((row) => row.count > 0) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={gradeDistribution}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="bucket" /><YAxis allowDecimals={false} /><Tooltip content={<GradeTooltip />} /><Bar dataKey="count" name="Sinh viên" radius={[6, 6, 0, 0]}>{gradeDistribution.map((row) => <Cell key={row.bucket} fill={row.bucket === "0–4" ? "#dc2626" : row.bucket === "4–5.5" ? "#f97316" : row.bucket === "Thiếu điểm" ? "#64748b" : "#16a34a"} />)}</Bar></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa có điểm để vẽ phân bố.</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Nhóm can thiệp</CardTitle><p className="text-xs text-muted-foreground">Chia sinh viên thành nhóm hành động từ điểm và dropout ML.</p></CardHeader><CardContent className="h-[320px]">{segments.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={segments} dataKey="value" nameKey="label" innerRadius={62} outerRadius={96} paddingAngle={3}>{segments.map((row) => <Cell key={row.key} fill={row.color} />)}</Pie><Tooltip content={<SegmentTooltip />} /><Legend /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa có dữ liệu sinh viên.</div>}</CardContent></Card>
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Ma trận sinh viên: điểm × dropout ML</CardTitle><p className="text-xs text-muted-foreground">Bên trái đường 5.5 là nhóm học lực yếu; phía trên 70% là dropout ML cao.</p></CardHeader><CardContent className="h-[360px]">{matrixData.length ? <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="x" name="Điểm" domain={[0, 10]} /><YAxis type="number" dataKey="y" name="Dropout ML" unit="%" domain={[0, 100]} /><ReferenceLine x={5.5} stroke="#ef4444" strokeDasharray="4 4" label="5.5 điểm" /><ReferenceLine y={70} stroke="#8b5cf6" strokeDasharray="4 4" label="70% ML" /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={<StudentMatrixTooltip />} /><Scatter data={matrixData} onClick={(row) => { const id = chartPayloadId(row); if (id) router.push(`/manager/analytics/students/${id}`) }} cursor="pointer">{matrixData.map((row) => <Cell key={row.student_id} fill={row.color} fillOpacity={row.risk_level === "high" ? 0.92 : 0.68} stroke={row.risk_level === "high" ? "#7f1d1d" : "transparent"} strokeWidth={row.risk_level === "high" ? 1.5 : 0} />)}</Scatter></ScatterChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chưa có đủ điểm để vẽ ma trận.</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Kế hoạch ưu tiên</CardTitle><p className="text-xs text-muted-foreground">Danh sách ngắn để bắt đầu can thiệp, trước khi mở bảng đầy đủ.</p></CardHeader><CardContent className="space-y-3">{urgentStudents.length ? urgentStudents.map(({ student, segment }) => <Link key={student.student_id} href={`/manager/analytics/students/${student.student_id}`} className="block rounded-lg border p-3 transition hover:bg-muted/40"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{student.student_code}</div><div className="text-xs text-muted-foreground">{student.full_name}</div></div><Badge variant={segment.key === "meet_now" ? "destructive" : "outline"}>{segment.label}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Điểm {formatNumber(student.final_grade)}</span><span className="text-right">ML {student.dropout_probability === null ? "—" : pct(student.dropout_probability)}</span></div><p className="mt-2 text-xs text-muted-foreground">{segment.reason}</p></Link>) : <div className="py-12 text-center text-sm text-muted-foreground">Không có nhóm ưu tiên trong bộ lọc hiện tại.</div>}</CardContent></Card>
    </div>
    <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Bằng chứng sinh viên</CardTitle><p className="mt-1 text-xs text-muted-foreground">Bảng này là worklist hành động; click sinh viên để xem hồ sơ chi tiết.</p></div><Select value={risk} onValueChange={(value) => setRisk(value ?? "all")}><SelectTrigger className="w-40"><span>{risk === "all" ? "Mọi mức" : levelLabel(risk)}</span></SelectTrigger><SelectContent><SelectItem value="all">Mọi mức</SelectItem><SelectItem value="high">Ưu tiên</SelectItem><SelectItem value="watch">Theo dõi</SelectItem><SelectItem value="normal">Ổn định</SelectItem><SelectItem value="pending">Thiếu điểm</SelectItem></SelectContent></Select></CardHeader><CardContent>{students?.items.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Sinh viên</th><th className="p-3 text-right">Điểm</th><th className="p-3 text-right">Dropout ML</th><th className="p-3">Lý do chính</th><th className="p-3">Hành động gợi ý</th><th className="p-3">Trạng thái</th></tr></thead><tbody>{students.items.map((student) => { const segment = studentIntervention(student); return <tr key={student.student_id} className="border-b"><td className="p-3"><Link className="font-medium text-primary" href={`/manager/analytics/students/${student.student_id}`}>{student.student_code} - {student.full_name}</Link></td><td className="p-3 text-right">{formatNumber(student.final_grade)}</td><td className="p-3 text-right">{student.dropout_probability === null ? "Chưa có" : pct(student.dropout_probability)}</td><td className="p-3">{segment.reason}</td><td className="p-3"><Badge variant={segment.key === "meet_now" ? "destructive" : "outline"}>{segment.label}</Badge></td><td className="p-3"><Badge variant={student.risk_level === "high" ? "destructive" : "outline"}>{levelLabel(student.risk_level)}</Badge></td></tr> })}</tbody></table></div> : <div className="py-12 text-center text-sm text-muted-foreground">Không có sinh viên phù hợp.</div>}</CardContent></Card>
    {students?.warnings.length ? <details className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">Chất lượng dữ liệu</summary><ul className="mt-2 list-disc space-y-1 pl-5">{students.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
  </div>
}
