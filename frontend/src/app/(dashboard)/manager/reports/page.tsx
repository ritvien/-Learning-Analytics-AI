"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, FileText, MessageSquarePlus, Play, RefreshCw, Star } from "lucide-react"

import {
  api,
  type ApiCourse,
  type ApiProgram,
  type ApiReport,
  type ApiReportType,
  type ApiSection,
  type ApiSemester,
  type ApiTeacher,
} from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const reportLabels: Record<ApiReportType, string> = {
  school_overview: "Toàn trường",
  program_health: "Theo ngành",
  section_intervention: "Theo lớp học phần",
}

const actorLabels = {
  manager: "Phòng đào tạo / Manager",
  lecturer: "Giảng viên",
  admin: "Admin",
  viewer: "Người xem",
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN")
}

function getMetricNumber(report: ApiReport | null, key: string) {
  const value = report?.metrics_json?.[key]
  return typeof value === "number" ? value : null
}

function pickRiskVariant(risk: unknown) {
  if (risk === "Cao") return "destructive"
  if (risk === "Trung bình") return "secondary"
  return "outline"
}

export default function ReportsPage() {
  const [reports, setReports] = React.useState<ApiReport[]>([])
  const [selectedReport, setSelectedReport] = React.useState<ApiReport | null>(null)
  const [programs, setPrograms] = React.useState<ApiProgram[]>([])
  const [teachers, setTeachers] = React.useState<ApiTeacher[]>([])
  const [sections, setSections] = React.useState<ApiSection[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [semesters, setSemesters] = React.useState<ApiSemester[]>([])
  const [reportType, setReportType] = React.useState<ApiReportType>("school_overview")
  const [actorRole, setActorRole] = React.useState<keyof typeof actorLabels>("manager")
  const [selectedProgramId, setSelectedProgramId] = React.useState("")
  const [selectedTeacherId, setSelectedTeacherId] = React.useState("all")
  const [selectedSectionId, setSelectedSectionId] = React.useState("")
  const [feedback, setFeedback] = React.useState("")
  const [rating, setRating] = React.useState("5")
  const [isHelpful, setIsHelpful] = React.useState("true")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState("")

  const courseById = React.useMemo(() => new Map(courses.map((item) => [item.id, item])), [courses])
  const teacherById = React.useMemo(() => new Map(teachers.map((item) => [item.id, item])), [teachers])
  const semesterById = React.useMemo(() => new Map(semesters.map((item) => [item.id, item])), [semesters])

  const filteredSections = React.useMemo(() => {
    if (selectedTeacherId === "all") return sections
    return sections.filter((section) => String(section.teacher_id) === selectedTeacherId)
  }, [sections, selectedTeacherId])

  const selectedRisk = selectedReport?.metrics_json?.risk_level ?? "Chưa rõ"
  const passRate = getMetricNumber(selectedReport, "pass_rate")
  const atRisk = getMetricNumber(selectedReport, "at_risk_students") ?? getMetricNumber(selectedReport, "watchlist_count")
  const llmEnhanced = selectedReport?.metrics_json?.llm_enhanced === true

  const refreshReports = React.useCallback(async () => {
    const list = await api.getReports({ limit: 50 })
    setReports(list)
    setSelectedReport((current) => {
      if (!current) return list[0] ?? null
      return list.find((item) => item.id === current.id) ?? list[0] ?? null
    })
  }, [])

  React.useEffect(() => {
    async function loadPageData() {
      setError("")
      try {
        const [reportList, programList, teacherList, sectionList, courseList, semesterList] = await Promise.all([
          api.getReports({ limit: 50 }),
          api.getPrograms({ limit: 500 }),
          api.getTeachers({ limit: 500 }),
          api.getSections({ limit: 1000 }),
          api.getCourses({ limit: 1000 }),
          api.getSemesters(),
        ])
        setReports(reportList)
        setSelectedReport(reportList[0] ?? null)
        setPrograms(programList)
        setTeachers(teacherList)
        setSections(sectionList)
        setCourses(courseList)
        setSemesters(semesterList)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu báo cáo.")
      } finally {
        setIsLoading(false)
      }
    }
    loadPageData()
  }, [])

  React.useEffect(() => {
    if (reportType === "school_overview") {
      setActorRole("manager")
      return
    }
    if (reportType === "section_intervention") setActorRole("lecturer")
  }, [reportType])

  React.useEffect(() => {
    if (filteredSections.length && !filteredSections.some((section) => String(section.id) === selectedSectionId)) {
      setSelectedSectionId(String(filteredSections[0].id))
    }
    if (!filteredSections.length) setSelectedSectionId("")
  }, [filteredSections, selectedSectionId])

  React.useEffect(() => {
    if (programs.length && !selectedProgramId) setSelectedProgramId(String(programs[0].id))
  }, [programs, selectedProgramId])

  function sectionLabel(section: ApiSection) {
    const course = courseById.get(section.course_id)
    const teacher = section.teacher_id ? teacherById.get(section.teacher_id) : null
    const semester = semesterById.get(section.semester_id)
    const parts = [
      section.section_code,
      course?.name,
      teacher?.full_name,
      semester?.code,
    ].filter(Boolean)
    return parts.join(" - ")
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const scopeId =
      reportType === "program_health"
        ? selectedProgramId
        : reportType === "section_intervention"
          ? selectedSectionId
          : undefined

    if (reportType !== "school_overview" && !scopeId) {
      setError("Bạn cần chọn đối tượng báo cáo trước khi tạo.")
      return
    }

    setIsGenerating(true)
    try {
      const report = await api.generateReport({
        report_type: reportType,
        actor_role: actorRole,
        scope_type:
          reportType === "program_health" ? "program" : reportType === "section_intervention" ? "section" : "school",
        scope_id: scopeId,
      })
      await refreshReports()
      setSelectedReport(report)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được báo cáo.")
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedReport) return
    setError("")
    try {
      await api.createReportFeedback(selectedReport.id, {
        rating: Number(rating),
        is_helpful: isHelpful === "true",
        comment: feedback,
      })
      setFeedback("")
      await refreshReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được feedback.")
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-5 w-5" />
              Tạo báo cáo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label>Góc nhìn báo cáo</Label>
                <Select value={reportType} onValueChange={(value) => setReportType(value as ApiReportType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(reportLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vai trò đọc báo cáo</Label>
                <Select value={actorRole} onValueChange={(value) => setActorRole(value as keyof typeof actorLabels)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(actorLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {reportType === "program_health" ? (
                <div className="space-y-2">
                  <Label>Ngành</Label>
                  <Select value={selectedProgramId} onValueChange={(value) => setSelectedProgramId(value ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Chọn ngành" /></SelectTrigger>
                    <SelectContent>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={String(program.id)}>
                          {program.code} - {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {reportType === "section_intervention" ? (
                <>
                  <div className="space-y-2">
                    <Label>Giảng viên</Label>
                    <Select value={selectedTeacherId} onValueChange={(value) => setSelectedTeacherId(value ?? "all")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả giảng viên</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={String(teacher.id)}>
                            {teacher.code ? `${teacher.code} - ` : ""}{teacher.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!teachers.length ? (
                      <p className="text-xs text-muted-foreground">
                        Chưa có dữ liệu giảng viên, danh sách lớp vẫn có thể chọn bên dưới.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Lớp học phần</Label>
                    <Select value={selectedSectionId} onValueChange={(value) => setSelectedSectionId(value ?? "")}>
                      <SelectTrigger><SelectValue placeholder="Chọn lớp học phần" /></SelectTrigger>
                      <SelectContent>
                        {filteredSections.map((section) => (
                          <SelectItem key={section.id} value={String(section.id)}>
                            {sectionLabel(section)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!filteredSections.length ? (
                      <p className="text-xs text-destructive">
                        Không có lớp học phần phù hợp với giảng viên đang chọn.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={isGenerating || isLoading}>
                {isGenerating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Tạo báo cáo
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Lịch sử báo cáo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? <p className="text-sm text-muted-foreground">Đang tải...</p> : null}
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`w-full rounded-md border p-3 text-left text-sm hover:bg-muted/50 ${
                  selectedReport?.id === report.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="font-medium">{report.title}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{report.actor_role}</Badge>
                  <Badge variant={pickRiskVariant(report.metrics_json?.risk_level)}>
                    Rủi ro {String(report.metrics_json?.risk_level ?? "chưa rõ")}
                  </Badge>
                  <span>{formatDate(report.created_at)}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {selectedReport ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Pass rate</div>
                  <div className="mt-1 text-2xl font-semibold">{passRate ?? "-"}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Cần chú ý</div>
                  <div className="mt-1 text-2xl font-semibold">{atRisk ?? "-"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Mức rủi ro
                  </div>
                  <div className="mt-2">
                    <Badge variant={pickRiskVariant(selectedRisk)}>{String(selectedRisk)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedReport.title}</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedReport.summary}</p>
                  </div>
                  <Badge variant={llmEnhanced ? "default" : "secondary"}>
                    {llmEnhanced ? "LLM enhanced" : "Rule-based"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[680px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-sm leading-6">
                  {selectedReport.content_markdown}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquarePlus className="h-5 w-5" />
                  Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleFeedback} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Đánh giá</Label>
                      <Select value={rating} onValueChange={(value) => setRating(value ?? "5")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <SelectItem key={value} value={String(value)}>{value}/5</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mức hữu ích</Label>
                      <Select value={isHelpful} onValueChange={(value) => setIsHelpful(value ?? "true")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Hữu ích</SelectItem>
                          <SelectItem value="false">Chưa hữu ích</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Ví dụ: báo cáo cần chỉ rõ môn nào gây rủi ro, hoặc đề xuất hành động chưa đủ cụ thể."
                  />
                  <Button type="submit">
                    <Star className="mr-2 h-4 w-4" />
                    Gửi feedback
                  </Button>
                </form>
                <div className="space-y-2">
                  {selectedReport.feedback_items.map((item) => (
                    <div key={item.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {item.rating ?? "-"}/5
                        <Badge variant="outline">{item.is_helpful ? "Hữu ích" : "Chưa hữu ích"}</Badge>
                      </div>
                      <p className="mt-2 text-muted-foreground">{item.comment || "Không có nhận xét."}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Chưa có báo cáo.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
