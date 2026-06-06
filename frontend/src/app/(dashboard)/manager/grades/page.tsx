"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { GradeRecord, Student } from "@/types"
import { mockGrades, mockStudents } from "@/lib/mock-data"
import { DataTable } from "@/components/crud/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2, ArrowUpDown, FileDown, FileUp } from "lucide-react"
import * as XLSX from "xlsx"

export default function GradesPage() {
  const [grades, setGrades] = React.useState<GradeRecord[]>(mockGrades)
  const [editGrade, setEditGrade] = React.useState<GradeRecord | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Helpers to get student name from ID
  const getStudentName = (id: string) => mockStudents.find(s => s.id === id)?.hoTen || id
  const getStudentMSSV = (id: string) => mockStudents.find(s => s.id === id)?.mssv || id

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editGrade) return
    const fd = new FormData(e.currentTarget)
    
    // Parse numeric fields safely
    const num = (val: FormDataEntryValue | null) => val ? Number(val) : null

    const updated: GradeRecord = {
      ...editGrade,
      diemTX1: num(fd.get("diemTX1")),
      diemTX2: num(fd.get("diemTX2")),
      diemThiLan1: num(fd.get("diemThiLan1")),
      tbThuongKy: num(fd.get("tbThuongKy")),
      diemTongKet: num(fd.get("diemTongKet")),
      xepLoai: fd.get("xepLoai") as string,
      ghiChu: fd.get("ghiChu") as string,
    }
    setGrades(grades.map((g) => (g.id === updated.id ? updated : g)))
    setEditGrade(null)
  }

  // IMPORT EXCEL
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const json = XLSX.utils.sheet_to_json(worksheet)

      // Transform raw JSON into GradeRecord (simplified for demo)
      const newGrades: GradeRecord[] = json.map((row: any, i) => ({
        id: `g-imported-${Date.now()}-${i}`,
        studentId: row.studentId || "sv-1",
        tenMonHoc: row.tenMonHoc || "Unknown",
        maLop: row.maLop || "",
        tinChi: Number(row.tinChi) || 3,
        diemTX1: Number(row.diemTX1) || null,
        diemTX2: Number(row.diemTX2) || null,
        diemTX3: null, diemTX4: null,
        tbThuongKy: Number(row.tbThuongKy) || null,
        duocDuThi: row.duocDuThi !== false,
        diemThiLan1: Number(row.diemThiLan1) || null,
        diemThiLan2: null,
        diemTongKet: Number(row.diemTongKet) || null,
        xepLoai: row.xepLoai || "",
        ghiChu: row.ghiChu || "",
        hocKy: row.hocKy || "HK1 (2023-2024)",
      }))

      setGrades([...grades, ...newGrades])
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    reader.readAsArrayBuffer(file)
  }

  // EXPORT EXCEL
  const handleExportExcel = () => {
    const exportData = grades.map(g => ({
      "MSSV": getStudentMSSV(g.studentId),
      "Họ Tên": getStudentName(g.studentId),
      "Tên Môn Học": g.tenMonHoc,
      "Mã Lớp": g.maLop,
      "Tín Chỉ": g.tinChi,
      "TX1": g.diemTX1,
      "TX2": g.diemTX2,
      "TB Thường Kỳ": g.tbThuongKy,
      "Được Dự Thi": g.duocDuThi ? "Có" : "Không",
      "Thi Lần 1": g.diemThiLan1,
      "Tổng Kết": g.diemTongKet,
      "Xếp Loại": g.xepLoai,
      "Ghi Chú": g.ghiChu,
      "Học Kỳ": g.hocKy
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Grades")
    XLSX.writeFile(workbook, "Diem_SinhVien.xlsx")
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
    { accessorKey: "tbThuongKy", header: "TB.TK" },
    { accessorKey: "diemThiLan1", header: "Thi L1" },
    {
      accessorKey: "diemTongKet",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Tổng kết <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const val = row.getValue("diemTongKet") as number | null
        if (val === null) return "-"
        return <span className={val < 4.0 ? "text-destructive font-bold" : ""}>{val.toFixed(1)}</span>
      }
    },
    {
      accessorKey: "xepLoai",
      header: "Xếp loại",
      cell: ({ row }) => {
        const grade = row.getValue("xepLoai") as string
        if (!grade) return "-"
        return <Badge variant={["F", "D", "D+"].includes(grade) ? "destructive" : "default"}>{grade}</Badge>
      }
    },
    {
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => {
        const grade = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditGrade(grade)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setGrades(grades.filter(g => g.id !== grade.id))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Điểm</h1>
          <p className="text-muted-foreground">Nhập, sửa điểm số sinh viên và xuất/nhập Excel.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImportExcel}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" /> Import Excel
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileDown className="mr-2 h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={grades} searchKey="tenMonHoc" searchPlaceholder="Tìm theo tên môn..." />

      {/* EDIT Dialog */}
      <Dialog open={!!editGrade} onOpenChange={(open) => { if (!open) setEditGrade(null) }}>
        <DialogContent className="sm:max-w-[450px]">
          {editGrade && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Sửa điểm — {getStudentName(editGrade.studentId)}</DialogTitle>
                <DialogDescription>{editGrade.tenMonHoc} ({editGrade.maLop})</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Điểm TX1</Label><Input name="diemTX1" type="number" step="0.1" defaultValue={editGrade.diemTX1 ?? ""} /></div>
                  <div className="space-y-2"><Label>Điểm TX2</Label><Input name="diemTX2" type="number" step="0.1" defaultValue={editGrade.diemTX2 ?? ""} /></div>
                  <div className="space-y-2"><Label>TB.TK</Label><Input name="tbThuongKy" type="number" step="0.1" defaultValue={editGrade.tbThuongKy ?? ""} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Điểm Thi L1</Label><Input name="diemThiLan1" type="number" step="0.1" defaultValue={editGrade.diemThiLan1 ?? ""} /></div>
                  <div className="space-y-2"><Label>Tổng kết</Label><Input name="diemTongKet" type="number" step="0.1" defaultValue={editGrade.diemTongKet ?? ""} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Xếp loại</Label><Input name="xepLoai" defaultValue={editGrade.xepLoai} /></div>
                  <div className="space-y-2"><Label>Ghi chú</Label><Input name="ghiChu" defaultValue={editGrade.ghiChu} /></div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Lưu thay đổi</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
