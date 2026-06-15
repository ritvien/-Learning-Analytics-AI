"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronRight, GraduationCap, Layers } from "lucide-react"
import type { Department } from "@/types"

export type TreeSelection = {
  id: string
  type: "department" | "major"
}

interface AcademicTreeProps {
  departments: Department[]
  studentCountByMajor: Record<string, number>
  courseCountByDepartment: Record<string, number>
  selected: TreeSelection
  onSelect: (selection: TreeSelection) => void
}

const badgeVariant = (count: number) => {
  if (count > 40) return "destructive"
  if (count > 20) return "secondary"
  return "outline"
}

export function AcademicTree({
  departments,
  studentCountByMajor,
  courseCountByDepartment,
  selected,
  onSelect,
}: AcademicTreeProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(departments.map((item) => item.id)),
  )

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderMajor = (major: Department["nganhs"][number]) => {
    const count = studentCountByMajor[major.id] ?? 0
    const isActive = selected.type === "major" && selected.id === major.id
    return (
      <button
        key={major.id}
        type="button"
        onClick={() => onSelect({ id: major.id, type: "major" })}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition ${
          isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-primary/5"
        }`}
      >
        <div className="flex items-center gap-3">
          <GraduationCap className="h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">{major.tenNganh}</p>
            <p className="text-xs text-muted-foreground">{major.moTa}</p>
          </div>
        </div>
        <Badge variant={badgeVariant(count)}>{count} SV</Badge>
      </button>
    )
  }

  return (
    <Card className="space-y-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Cây học thuật</CardTitle>
            <p className="text-sm text-muted-foreground">Duyệt Khoa → Ngành để xem chi tiết và chỉ số học tập.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {departments.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
          </div>
        ) : (
          departments.map((department) => {
            const isOpen = expanded.has(department.id)
            const deptCount = department.nganhs.reduce((sum, major) => sum + (studentCountByMajor[major.id] ?? 0), 0)
            const courseCount = courseCountByDepartment[department.id] ?? 0
            const isActive = selected.type === "department" && selected.id === department.id

            return (
              <div key={department.id} className="space-y-2">
                <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-primary/5"}`}>
                  <div
                    role="button"
                    onClick={() => onSelect({ id: department.id, type: "department" })}
                    className="inline-flex cursor-pointer items-center gap-3"
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpand(department.id)
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span>{department.tenKhoa}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{department.nganhs.length} ngành</Badge>
                    <Badge variant={badgeVariant(deptCount)}>{deptCount} SV</Badge>
                    <Badge variant="outline">{courseCount} môn</Badge>
                  </div>
                </div>
                {isOpen && (
                  <div className="space-y-2 pl-12">
                    {department.nganhs.map(renderMajor)}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
      <div className="rounded-3xl border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium">Tip:</p>
        <p>Chọn mỗi ngành để xem KPI chuyên sâu, hoặc chọn khoa để duyệt tổng quan toàn bộ chương trình.</p>
      </div>
    </Card>
  )
}
