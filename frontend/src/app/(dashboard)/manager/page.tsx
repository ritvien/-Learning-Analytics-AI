"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { School, MessageSquare } from "lucide-react"
import { api } from "@/lib/api"
import type { ApiTreeMetrics, ApiTreeNode } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Department } from "@/types"
import { DetailPanel } from "@/components/dashboard/detail-panel"
import { KpiWidgets } from "@/components/dashboard/kpi-widgets"

const emptyMetrics: ApiTreeMetrics = {
  student_count: 0,
  course_count: 0,
  completed_enrollments: 0,
  passed_enrollments: 0,
  failed_enrollments: 0,
  pass_rate: 0,
  fail_rate: 0,
  avg_gpa: 0,
  avg_grade: 0,
  health_score: 0,
}

function mapTreeToDepartments(tree: ApiTreeNode | null): Department[] {
  return (tree?.children ?? [])
    .filter((node) => node.type === "department")
    .map((department) => ({
      id: String(department.id),
      tenKhoa: department.label,
      moTa: department.code,
      nganhs: department.children
        .filter((node) => node.type === "program")
        .flatMap((program) =>
          program.children
            .filter((node) => node.type === "specialization")
            .map((specialization) => ({
              id: String(specialization.id),
              tenNganh: specialization.label === "Chưa phân loại" ? program.label : specialization.label,
              khoaId: String(department.id),
              moTa: specialization.code,
            }))
        ),
    }))
}

function flattenMetrics(tree: ApiTreeNode | null): Record<string, ApiTreeMetrics> {
  const metrics: Record<string, ApiTreeMetrics> = {}
  const walk = (node: ApiTreeNode) => {
    metrics[`${node.type}_${node.id}`] = node.metrics
    node.children.forEach(walk)
  }
  if (tree) walk(tree)
  return metrics
}

export default function ManagerDashboard() {
  const router = useRouter()
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({})
  const [tree, setTree] = useState<ApiTreeNode | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selection, setSelection] = useState<{ id: string; type: "department" | "major" } | null>(null)

  useEffect(() => {
    let active = true
    async function loadData() {
      try {
        setIsLoading(true)
        const treeRes = await api.getTree()
        if (active) {
          const feDepartments = mapTreeToDepartments(treeRes)
          setTree(treeRes)
          setDepartments(feDepartments)

          if (feDepartments.length > 0) {
            setSelection({ id: feDepartments[0].id, type: "department" })
            setExpandedDepts(Object.fromEntries(feDepartments.map((department) => [department.id, true])))
          }
          setIsLoading(false)
        }
      } catch (err) {
        console.error("loadData: ERROR", err)
        if (active) {
          setIsLoading(false)
        }
      }
    }
    loadData()
    return () => { active = false }
  }, [])

  const toggleDept = (id: string) => {
    setExpandedDepts((prev) => ({ ...prev, [id]: !prev[id] }))
    setSelection({ id, type: "department" })
  }

  const toggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {}
    if (expand) departments.forEach((d) => { next[d.id] = true })
    setExpandedDepts(next)
  }

  const selectedDepartment = useMemo(() => {
    if (!selection) return undefined
    return departments.find((item) => item.id === selection.id)
  }, [selection, departments])

  const selectedMajor = useMemo(() => {
    if (!selection) return undefined
    return departments.flatMap((item) => item.nganhs).find((major) => major.id === selection.id)
  }, [selection, departments])

  const metricsByNode = useMemo(() => flattenMetrics(tree), [tree])

  const selectedMetrics = useMemo(() => {
    if (!selection) return emptyMetrics
    const key = selection.type === "major" ? `specialization_${selection.id}` : `department_${selection.id}`
    return metricsByNode[key] ?? emptyMetrics
  }, [selection, metricsByNode])

  const averageGpa = selectedMetrics.avg_gpa
  const failRate = selectedMetrics.fail_rate
  const courseCount = selectedMetrics.course_count
  const globalHealthScore = tree?.metrics.health_score ?? 0
  const globalGpaAvg = tree?.metrics.avg_gpa ?? 0
  const globalFailRate = tree?.metrics.fail_rate ?? 0
  const scopeLabel = "toàn trường"
  const totalMajors = departments.reduce((sum, department) => sum + department.nganhs.length, 0)

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Đang tải dữ liệu học thuật...</p>
          </div>
        </div>
      ) : (
        <>
          <KpiWidgets 
            healthScore={globalHealthScore}
            gpaAvg={globalGpaAvg}
            failRate={globalFailRate}
            totalStudents={tree?.metrics.student_count ?? 0}
            totalCourses={tree?.metrics.course_count ?? 0}
            scopeLabel={scopeLabel}
          />
          <div className="flex flex-col w-full bg-background text-foreground transition-colors duration-300 rounded-xl border border-border/50 shadow-sm p-4">
            {/* ── Dashboard Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 shrink-0">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Tổng quan cơ cấu đào tạo</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quan sát cấu trúc khoa, chương trình và chuyên ngành toàn trường. Dữ liệu chi tiết vẫn tuân theo phân quyền từng chức năng.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
                  <span className="rounded-md border bg-muted/40 px-2 py-1">{departments.length} khoa</span>
                  <span className="rounded-md border bg-muted/40 px-2 py-1">{totalMajors} ngành/chuyên ngành</span>
                </div>
              </div>

              {/* ── Toolbar ── */}
              <div className="flex items-center gap-1.5 self-start sm:self-center">
                <button
                  onClick={() => toggleAll(true)}
                  className="px-2.5 py-1.5 text-[10px] font-semibold rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all cursor-pointer"
                >
                  Mở rộng tất cả
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="px-2.5 py-1.5 text-[10px] font-semibold rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border shadow-sm transition-all cursor-pointer"
                >
                  Thu gọn tất cả
                </button>
              </div>
            </div>

            {/* ── Tree View Area ── */}
            <div id="academic-tree-view" className="flex-1 flex flex-col items-center mt-4 w-full">
              {/* ── EPU Root Node ── */}
              <div className="flex flex-col items-center select-none shrink-0">
                <div
                  className="px-8 py-2 rounded-full font-black text-base tracking-[0.2em] text-white
                              bg-gradient-to-r from-[#1B3A5C] to-[#F5A623]
                              shadow-[0_2px_10px_rgba(27,58,92,0.3)] border border-white/10 flex items-center gap-1.5"
                >
                  <School className="h-4 w-4" />
                  VinUni
                </div>
              </div>

              {/* ── Vertical stem from EPU ── */}
              <div className="w-[1.5px] h-5 bg-gradient-to-b from-[#F5A623] to-primary/40 shrink-0" />

              {/* ── Columns Wrapper ── */}
              <div className="w-full overflow-x-auto pb-3">
                <div className="relative flex min-w-[1120px] pt-0">
                  {departments.map((dept, index) => {
                  const isExpanded = !!expandedDepts[dept.id]
                  const isDeptSelected = selection?.type === "department" && selection.id === dept.id

                  const getDeptStatus = (deptId: string) => {
                    const hScore = metricsByNode[`department_${deptId}`]?.health_score
                    const avg = hScore !== undefined ? hScore : 0
                    
                    if (hScore === undefined) {
                      return { percent: "...", colorClass: "bg-card border-border text-muted-foreground", activeColorClass: "bg-card border-primary text-primary", dotClass: "bg-muted" };
                    }

                    if (avg >= 70) {
                      return {
                        percent: avg,
                        colorClass: "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
                        activeColorClass: "bg-emerald-600 border-white text-white shadow-lg scale-[1.05] ring-2 ring-emerald-500 ring-offset-1 font-bold",
                        dotClass: "bg-white",
                      }
                    }
                    if (avg >= 40) {
                      return {
                        percent: avg,
                        colorClass: "bg-amber-500 border-amber-500 text-white hover:bg-amber-600 shadow-sm",
                        activeColorClass: "bg-amber-500 border-white text-white shadow-lg scale-[1.05] ring-2 ring-amber-400 ring-offset-1 font-bold",
                        dotClass: "bg-white",
                      }
                    }
                    return {
                      percent: avg,
                      colorClass: "bg-rose-600 border-rose-600 text-white hover:bg-rose-700 shadow-sm",
                      activeColorClass: "bg-rose-600 border-white text-white shadow-lg scale-[1.05] ring-2 ring-rose-500 ring-offset-1 font-bold",
                      dotClass: "bg-white",
                    }
                  }

                  const deptStatus = getDeptStatus(dept.id)

                  return (
                    <div key={dept.id} className="flex-1 flex flex-col items-center px-[2px] relative min-w-[55px] max-w-[120px] w-full">
                      {/* ── Edge-to-Edge Connecting Line (Zero Gap) ── */}
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] flex">
                        <div className={`flex-1 ${index === 0 ? "invisible" : "bg-primary/30"}`} />
                        <div className={`flex-1 ${index === departments.length - 1 ? "invisible" : "bg-primary/30"}`} />
                      </div>

                      {/* Vertical stem to card */}
                      <div className="w-[1.5px] h-4 bg-primary/30 z-10 shrink-0" />

                      {/* Department card (clickable) */}
                      <button
                        onClick={() => toggleDept(dept.id)}
                        className={`w-full rounded border px-1 py-1.5 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-between min-h-[56px] z-10
                          ${isExpanded ? deptStatus.activeColorClass : deptStatus.colorClass}
                          ${isDeptSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                      >
                        <p className="text-[9px] sm:text-[10px] font-bold leading-tight tracking-wide line-clamp-3">
                          {dept.tenKhoa.replace("Khoa ", "")}
                        </p>
                        <div className="flex items-center gap-1 text-[8px] font-medium mt-1">
                          <span className={`w-1 h-1 rounded-full ${deptStatus.dotClass}`} />
                          <span>{deptStatus.percent}{deptStatus.percent !== "..." ? "%" : ""}</span>
                        </div>
                      </button>

                      {/* Chat AI dropdown for Department */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          title={`Hỏi AI về khoa ${dept.tenKhoa}`}
                          className="absolute top-0 right-0 w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110 z-20 border border-primary/20 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 p-1.5 bg-white border-primary/10 shadow-xl rounded-xl">
                          <DropdownMenuGroup className="flex flex-col gap-0.5">
                            {[`Khoa ${dept.tenKhoa.toLowerCase()} có tổng cộng bao nhiêu sinh viên đang học?`, `Điểm GPA trung bình của toàn bộ sinh viên khoa ${dept.tenKhoa.toLowerCase()} là bao nhiêu?`, `Thống kê số lượng sinh viên theo từng trạng thái (đang học, đã tốt nghiệp, buộc thôi học) của khoa ${dept.tenKhoa.toLowerCase()}?`].map((prompt, i) => (
                              <DropdownMenuItem
                                key={i}
                                className="text-xs py-2 px-2.5 rounded-lg cursor-pointer flex items-start gap-2 hover:bg-primary/5 hover:text-primary transition-colors group/item"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/chat?q=${encodeURIComponent(prompt)}`)
                                }}
                              >
                                <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50 group-hover/item:opacity-100" />
                                <span className="leading-snug">{prompt}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Stem to majors */}
                      <div
                        className={`w-[1.5px] bg-primary/20 transition-all duration-200 shrink-0 ${isExpanded ? "h-3 opacity-100" : "h-0 opacity-0"
                          }`}
                      />

                      {/* Majors list */}
                      <div
                        className={`w-full flex flex-col gap-1 transition-all duration-200 origin-top z-10 ${isExpanded
                          ? "max-h-[800px] opacity-100 scale-y-100 mt-0.5"
                          : "max-h-0 opacity-0 scale-y-95 overflow-hidden pointer-events-none"
                          }`}
                      >
                        {dept.nganhs.map((major) => {
                          const getMajorStatus = (majorId: string) => {
                            const hScore = metricsByNode[`specialization_${majorId}`]?.health_score
                            const percent = hScore !== undefined ? hScore : 0
                            
                            if (hScore === undefined) {
                              return {
                                colorClass: "bg-card border-border text-muted-foreground",
                                dotClass: "bg-muted",
                                percent: "...",
                              }
                            }
                            
                            if (percent >= 70) {
                              return {
                                colorClass: "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
                                dotClass: "bg-white",
                                percent: `${percent}%`,
                              }
                            }
                            if (percent >= 40) {
                              return {
                                colorClass: "bg-amber-500 border-amber-500 text-white hover:bg-amber-600 shadow-sm",
                                dotClass: "bg-white",
                                percent: `${percent}%`,
                              }
                            }
                            return {
                              colorClass: "bg-rose-600 border-rose-600 text-white hover:bg-rose-700 shadow-sm",
                              dotClass: "bg-white",
                              percent: `${percent}%`,
                            }
                          }

                          const status = getMajorStatus(major.id)
                          const isMajorSelected = selection?.type === "major" && selection.id === major.id

                          return (
                            <div
                              key={major.id}
                              id={`major-${major.id}`}
                              onClick={() => setSelection({ id: major.id, type: "major" })}
                              className={`major-node-item group w-full px-1 py-1 rounded border flex flex-col gap-0.5 transition-all duration-150 cursor-pointer relative
                                ${status.colorClass}
                                ${isMajorSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
                            >
                              <p className="text-[7.5px] leading-[1.1] font-semibold text-center break-words line-clamp-3">
                                {major.tenNganh}
                              </p>
                              <div className="flex items-center justify-center gap-1 text-[8px] opacity-90 font-medium">
                                <span className={`w-1 h-1 rounded-full ${status.dotClass}`} />
                                <span>{status.percent}</span>
                              </div>
                              {/* Chat AI dropdown for Major */}
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  title={`Hỏi AI về ngành ${major.tenNganh}`}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110 z-20 border border-primary/20 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MessageSquare className="w-2.5 h-2.5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64 p-1.5 bg-white border-primary/10 shadow-xl rounded-xl">
                                  <DropdownMenuGroup className="flex flex-col gap-0.5">
                                    {[`Điểm GPA trung bình của sinh viên thuộc ngành/chuyên ngành ${major.tenNganh.toLowerCase()} là bao nhiêu?`, `Top 3 môn học có nhiều sinh viên trượt nhất của ngành/chuyên ngành ${major.tenNganh.toLowerCase()}?`, `Có bao nhiêu sinh viên ngành/chuyên ngành ${major.tenNganh.toLowerCase()} đang bị cảnh báo học vụ hoặc buộc thôi học?`].map((prompt, i) => (
                                      <DropdownMenuItem
                                        key={i}
                                        className="text-xs py-2 px-2.5 rounded-lg cursor-pointer flex items-start gap-2 hover:bg-primary/5 hover:text-primary transition-colors group/item"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          router.push(`/chat?q=${encodeURIComponent(prompt)}`)
                                        }}
                                      >
                                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50 group-hover/item:opacity-100" />
                                        <span className="leading-snug">{prompt}</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Detail Panel Area */}
          <div className="mt-6">
            <DetailPanel
              title={selectedMajor ? selectedMajor.tenNganh : selectedDepartment?.tenKhoa ?? "Chưa chọn"}
              subtitle={selectedMajor ? selectedMajor.moTa : selectedDepartment?.moTa ?? "Chọn một khoa hoặc chuyên ngành để xem chi tiết."}
              studentCount={selectedMetrics.student_count}
              averageGpa={averageGpa}
              failRate={failRate}
              courseCount={courseCount}
              topInsights={[
                "Dữ liệu cập nhật realtime từ database",
                selection ? `Đang hiển thị cho ${selectedMetrics.student_count} sinh viên` : "Chưa có dữ liệu"
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
