"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { GradeRecord } from "@/types"
import { api, type ApiSection, type ApiStudent } from "@/lib/api"
import { DataTable } from "@/components/crud/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, ArrowUpDown, FileDown, FileSpreadsheet, Upload } from "lucide-react"
import * as XLSX from "xlsx"

type GradeMode = "midterm" | "final_exam" | "final_grade"

type ImportRow = {
  row_number?: number
  enrollment_id?: number | null
  student_code?: string | null
  section_code?: string | null
  course_code?: string | null
  final_grade?: number | null
  component_name?: string | null
  component_score?: number | null
  notes?: string | null
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function componentMode(name: string): GradeMode | null {
  const normalized = normalizeHeader(name)
  if (normalized.includes("midterm") || normalized.includes("giua_ky") || normalized.includes("giuaky")) {
    return "midterm"
  }
  if (normalized.includes("final") || normalized.includes("cuoi_ky") || normalized.includes("cuoiky")) {
    return "final_exam"
  }
  return null
}

function readCell(row: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") {
      return row[name]
    }
  }
  return null
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null
  const parsed = Number(String(value).replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function toText(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function normalizeSheetRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value
    }
    return normalized
  })
}

function importRowForMode(record: GradeRecord, mode: GradeMode, value: number): ImportRow {
  const base = {
    enrollment_id: Number(record.id),
    student_code: record.studentCode,
    section_code: record.maLop,
    course_code: record.courseCode,
  }
  if (mode === "final_grade") return { ...base, final_grade: value }
  return {
    ...base,
    final_grade: null,
    component_name: mode === "midterm" ? "Midterm" : "Final",
    component_score: value,
  }
}

export default function GradesPage() {
  const [grades, setGrades] = React.useState<GradeRecord[]>([])
  const [students, setStudents] = React.useState<ApiStudent[]>([])
  const [sections, setSections] = React.useState<ApiSection[]>([])
  const [sectionFilter, setSectionFilter] = React.useState("all")
  const [importMessage, setImportMessage] = React.useState<string | null>(null)
  const [editGrade, setEditGrade] = React.useState<GradeRecord | null>(null)
  const importInputRef = React.useRef<HTMLInputElement | null>(null)

  const loadGrades = React.useCallback(() => {
    return Promise.all([
      api.getEnrollments({ limit: 5000 }),
      api.getStudents({ limit: 5000 }),
      api.getSections({ limit: 5000 }),
      api.getCourses({ limit: 1000 }),
      api.getGradeComponents({ limit: 10000 }),
    ]).then(([enrolls, apiStudents, apiSections, apiCourses, components]) => {
      setStudents(apiStudents)
      setSections(apiSections)

      const componentMap = new Map<number, { midterm: number | null; final_exam: number | null }>()
      components.forEach((component) => {
        const mode = componentMode(component.component_name)
        if (!mode || mode === "final_grade") return
        const item = componentMap.get(component.enrollment_id) ?? { midterm: null, final_exam: null }
        item[mode] = component.score
        componentMap.set(component.enrollment_id, item)
      })

      setGrades(enrolls.map(e => {
        const section = apiSections.find(s => s.id === e.section_id)
        const course = apiCourses.find(c => c.id === section?.course_id)
        const student = apiStudents.find(s => s.id === e.student_id)
        const componentScores = componentMap.get(e.id)
        return {
          id: String(e.id),
          studentId: String(e.student_id),
          departmentId: course?.department_id ?? null,
          courseId: course?.id ?? null,
          sectionId: section?.id ?? null,
          courseCode: course?.code ?? "",
          studentCode: student?.student_code ?? "",
          tenMonHoc: course?.name || "Chưa có",
          maLop: section?.section_code || "Chưa có",
          tinChi: course?.credits || 0,
          diemTX1: componentScores?.midterm ?? null,
          diemTX2: null,
          diemTX3: null,
          diemTX4: null,
          tbThuongKy: null,
          duocDuThi: true,
          diemThiLan1: componentScores?.final_exam ?? null,
          diemThiLan2: null,
          diemTongKet: e.final_grade,
          xepLoai: e.grade_letter ?? (e.is_passed ? "C" : "F"),
          ghiChu: "",
          hocKy: "",
        }
      }))
    })
  }, [])

  React.useEffect(() => {
    loadGrades()
  }, [loadGrades])

  const visibleSections = React.useMemo(() => {
    const courseIds = new Set(grades.map(g => g.courseId))
    return sections.filter(section => courseIds.has(section.course_id))
  }, [grades, sections])

  const filteredGrades = React.useMemo(() => {
    return grades.filter((grade) => sectionFilter === "all" || grade.sectionId === Number(sectionFilter))
  }, [sectionFilter, grades])

  const getStudentName = (id: string) => students.find(s => String(s.id) === id)?.full_name || id
  const getStudentMSSV = (id: string) => students.find(s => String(s.id) === id)?.student_code || id

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editGrade) return
    const fd = new FormData(e.currentTarget)
    const rows: ImportRow[] = []
    const midterm = toNumber(fd.get("midterm"))
    const finalExam = toNumber(fd.get("final_exam"))
    const finalGrade = toNumber(fd.get("final_grade"))
    if (midterm !== null) rows.push(importRowForMode(editGrade, "midterm", midterm))
    if (finalExam !== null) rows.push(importRowForMode(editGrade, "final_exam", finalExam))
    if (finalGrade !== null) rows.push(importRowForMode(editGrade, "final_grade", finalGrade))
    if (rows.length === 0) {
      setImportMessage("Chưa nhập điểm hợp lệ.")
      return
    }
    const result = await api.importGrades(rows)
    await loadGrades()
    setImportMessage(`Đã lưu điểm cho ${getStudentName(editGrade.studentId)}. ${result.errors[0] ?? ""}`)
    setEditGrade(null)
  }

  const buildImportRows = (sheetRows: Record<string, unknown>[]) => {
    const rows: ImportRow[] = []
    normalizeSheetRows(sheetRows).forEach((row, index) => {
      const base = {
        row_number: index + 2,
        enrollment_id: toNumber(readCell(row, ["enrollment_id", "ma_dang_ky"])) ?? undefined,
        student_code: toText(readCell(row, ["mssv", "student_code", "ma_sinh_vien", "ma_sv"])),
        section_code: toText(readCell(row, ["ma_lop", "section_code", "lop_hoc_phan", "lop"])),
        course_code: toText(readCell(row, ["ma_mon", "ma_hoc_phan", "course_code"])),
        notes: toText(readCell(row, ["ghi_chu", "notes"])),
      }
      const midterm = toNumber(readCell(row, ["diem_giua_ky", "giua_ky", "midterm", "midterm_score"]))
      const finalExam = toNumber(readCell(row, ["diem_cuoi_ky", "cuoi_ky", "final_exam", "final_score"]))
      const finalGrade = toNumber(readCell(row, ["diem_tong_ket", "tong_ket", "final_grade", "diem_final"]))
      if (midterm !== null) rows.push({ ...base, final_grade: null, component_name: "Midterm", component_score: midterm })
      if (finalExam !== null) rows.push({ ...base, final_grade: null, component_name: "Final", component_score: finalExam })
      if (finalGrade !== null) rows.push({ ...base, final_grade: finalGrade })
    })
    return rows
  }

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setImportMessage("Đang đọc file điểm...")
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })
      const rows = buildImportRows(rawRows)
      if (rows.length === 0) {
        setImportMessage("File chưa có cột điểm hợp lệ. Có thể chỉ điền Diem giua ky, Diem cuoi ky hoặc Diem tong ket.")
        return
      }
      const result = await api.importGrades(rows)
      await loadGrades()
      const errorText = result.errors.length ? ` Lỗi: ${result.errors.slice(0, 3).join("; ")}` : ""
      setImportMessage(`Đã nhập ${result.updated_rows}/${result.total_rows} dòng điểm. Bỏ qua ${result.skipped_rows}.${errorText}`)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Không nhập được file điểm.")
    }
  }

  const handleExportExcel = () => {
    const exportData = filteredGrades.map(g => ({
      "Ma dang ky": g.id,
      "MSSV": getStudentMSSV(g.studentId),
      "Ho ten": getStudentName(g.studentId),
      "Ma mon": g.courseCode,
      "Ten mon hoc": g.tenMonHoc,
      "Ma lop": g.maLop,
      "Diem giua ky": g.diemTX1,
      "Diem cuoi ky": g.diemThiLan1,
      "Diem tong ket": g.diemTongKet,
      "Ghi chu": g.ghiChu,
    }))
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Grades")
    XLSX.writeFile(workbook, "Diem_LopHocPhan.xlsx")
  }

  const handleDownloadTemplate = () => {
    const templateRows = filteredGrades.map(g => ({
      "Ma dang ky": g.id,
      "MSSV": getStudentMSSV(g.studentId),
      "Ho ten": getStudentName(g.studentId),
      "Ma mon": g.courseCode,
      "Ten mon hoc": g.tenMonHoc,
      "Ma lop": g.maLop,
      "Diem giua ky": "",
      "Diem cuoi ky": "",
      "Diem tong ket": "",
      "Ghi chu": "",
    }))
    const worksheet = XLSX.utils.json_to_sheet(templateRows.length ? templateRows : [
      {
        "Ma dang ky": "",
        "MSSV": "SV0001",
        "Ho ten": "Nguyen Van A",
        "Ma mon": "IT101",
        "Ten mon hoc": "",
        "Ma lop": "01",
        "Diem giua ky": "",
        "Diem cuoi ky": "",
        "Diem tong ket": "",
        "Ghi chu": "",
      },
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "NhapDiem")
    XLSX.writeFile(workbook, "Mau_Nhap_Diem_LopHocPhan.xlsx")
  }

  const columns: ColumnDef<GradeRecord>[] = [
    {
      accessorKey: "studentId",
      header: "Sinh viên",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{getStudentName(row.original.studentId)}</div>
          <div className="text-xs text-muted-foreground">{getStudentMSSV(row.original.studentId)}</div>
        </div>
      ),
    },
    {
      accessorKey: "tenMonHoc",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Môn học <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    { accessorKey: "maLop", header: "Mã lớp" },
    { accessorKey: "diemTX1", header: "Giữa kỳ", cell: ({ row }) => row.original.diemTX1 === null ? "-" : row.original.diemTX1.toFixed(1) },
    { accessorKey: "diemThiLan1", header: "Cuối kỳ", cell: ({ row }) => row.original.diemThiLan1 === null ? "-" : row.original.diemThiLan1.toFixed(1) },
    { accessorKey: "diemTongKet", header: "Tổng kết", cell: ({ row }) => row.original.diemTongKet === null ? "-" : row.original.diemTongKet.toFixed(1) },
    {
      accessorKey: "xepLoai",
      header: "Xếp loại",
      cell: ({ row }) => {
        const grade = row.getValue("xepLoai") as string
        if (!grade) return "-"
        return <Badge variant={["F", "D", "D+"].includes(grade) ? "destructive" : "default"}>{grade}</Badge>
      },
    },
    {
      id: "actions",
      header: "Nhập tay",
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" onClick={() => setEditGrade(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Điểm</h1>
          <p className="text-sm text-muted-foreground">
            Chọn lớp học phần để xem toàn bộ sinh viên và các cột điểm. Có thể nhập tay hoặc tải mẫu Excel của lớp để điền điểm và import lại.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Xuất mẫu lớp
          </Button>
          <Button variant="outline" onClick={() => importInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Nhập Excel
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileDown className="mr-2 h-4 w-4" /> Xuất điểm
          </Button>
          <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(240px,360px)_1fr]">
          <div className="space-y-2">
            <Label>Lớp học phần</Label>
            <Select value={sectionFilter} onValueChange={(value) => setSectionFilter(value ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tất cả lớp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả lớp</SelectItem>
                {visibleSections.map((section) => (
                  <SelectItem key={section.id} value={String(section.id)}>
                    {section.section_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-sm text-muted-foreground">
            File mẫu có đủ cột giữa kỳ, cuối kỳ, tổng kết; điền cột nào hệ thống nhận cột đó, không bắt nhập đủ.
          </div>
        </CardContent>
      </Card>

      {importMessage ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{importMessage}</div>
      ) : null}

      <DataTable columns={columns} data={filteredGrades} searchKey="tenMonHoc" searchPlaceholder="Tìm theo tên môn..." />

      <Dialog open={!!editGrade} onOpenChange={(open) => { if (!open) setEditGrade(null) }}>
        <DialogContent className="sm:max-w-[560px]">
          {editGrade && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Nhập điểm</DialogTitle>
                <DialogDescription>
                  {getStudentName(editGrade.studentId)} - {editGrade.tenMonHoc} ({editGrade.maLop})
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Giữa kỳ</Label>
                  <Input name="midterm" type="number" min={0} max={10} step="0.1" defaultValue={editGrade.diemTX1 ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Cuối kỳ</Label>
                  <Input name="final_exam" type="number" min={0} max={10} step="0.1" defaultValue={editGrade.diemThiLan1 ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Tổng kết</Label>
                  <Input name="final_grade" type="number" min={0} max={10} step="0.1" defaultValue={editGrade.diemTongKet ?? ""} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Lưu điểm</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
