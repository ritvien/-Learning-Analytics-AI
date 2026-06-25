"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Student } from "@/types"
import { api, getCachedCurrentUser } from "@/lib/api"
import { DataTable } from "@/components/crud/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react"

const statusVariant = (s: string) => {
  switch (s) {
    case "Đang học": return "default" as const
    case "Đã tốt nghiệp": return "secondary" as const
    case "Bảo lưu": return "outline" as const
    case "Thôi học": return "destructive" as const
    default: return "default" as const
  }
}

const STATUS_VI: Record<string, Student["trangThai"]> = {
  active: "Đang học",
  graduated: "Đã tốt nghiệp",
  withdrawn: "Bảo lưu",
  expelled: "Thôi học",
}

export default function StudentsPage() {
  const [students, setStudents] = React.useState<Student[]>([])
  const [userRole] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const u = getCachedCurrentUser()
      return u ? u.role : null
    }
    return null
  })

  const hasWriteAccess = userRole === "superadmin" || userRole === "admin" || userRole === "manager"

  React.useEffect(() => {
    Promise.all([api.getStudents({ limit: 500 }), api.getPrograms({ limit: 100 })]).then(
      ([apiStudents, apiPrograms]) => {
        const progMap = new Map(apiPrograms.map((p) => [p.id, p.name]))
        setStudents(
          apiStudents.map((s) => ({
            id: String(s.id),
            mssv: s.student_code,
            hoTen: s.full_name,
            gioiTinh: (s.gender as Student["gioiTinh"]) ?? "Nam",
            ngayVaoTruong: "",
            khoa: "",
            bacDaoTao: "Đại học - Tín chỉ",
            loaiHinh: "Chính quy",
            nganh: progMap.get(s.program_id) ?? "",
            chuyenNganh: "",
            khoaQuanLy: progMap.get(s.program_id) ?? "",
            lop: s.class_code ?? "",
            trangThai: STATUS_VI[s.status] ?? "Đang học",
            coVanHocTap: "",
            soDienThoaiCVHT: "",
            tongTCTichLuy: 0,
            diemTBTichLuy: s.gpa_cumulative ?? 0,
            tongTCNo: 0,
            soMonNo: 0,
          }))
        )
      }
    )
  }, [])
  const [editStudent, setEditStudent] = React.useState<Student | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Student | null>(null)

  const STATUS_EN: Record<string, string> = {
    "Đang học": "active", "Đã tốt nghiệp": "graduated",
    "Bảo lưu": "withdrawn", "Thôi học": "expelled",
  }

  // CREATE
  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    alert("Hiện tại chưa có quyền để thực hiện sửa db (Thêm sinh viên).")
    setIsCreateOpen(false)
  }

  // UPDATE
  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editStudent) return
    alert("Hiện tại chưa có quyền để thực hiện sửa db (Cập nhật sinh viên).")
    setEditStudent(null)
  }

  // DELETE
  const handleDelete = () => {
    if (!deleteTarget) return
    alert("Hiện tại chưa có quyền để thực hiện sửa db (Xóa sinh viên).")
    setDeleteTarget(null)
    setIsDeleteOpen(false)
  }

  const columns: ColumnDef<Student>[] = [
    {
      accessorKey: "mssv",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          MSSV <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "hoTen",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Họ tên <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue("hoTen")}</span>,
    },
    { accessorKey: "lop", header: "Lớp" },
    { accessorKey: "khoaQuanLy", header: "Khoa" },
    {
      accessorKey: "diemTBTichLuy",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          GPA <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const gpa = row.getValue("diemTBTichLuy") as number
        return <span className={gpa < 2.0 ? "text-destructive font-bold" : ""}>{gpa.toFixed(2)}</span>
      },
    },
    {
      accessorKey: "trangThai",
      header: "Trạng thái",
      cell: ({ row }) => {
        const status = row.getValue("trangThai") as string
        return <Badge variant={statusVariant(status)}>{status}</Badge>
      },
    },
    ...(hasWriteAccess ? [{
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => {
        const student = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditStudent(student)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteTarget(student); setIsDeleteOpen(true) }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    } as ColumnDef<Student>] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Sinh viên</h1>
        </div>
        {hasWriteAccess && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" /> Thêm SV
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Thêm Sinh viên mới</DialogTitle>
                  <DialogDescription>Nhập thông tin sinh viên.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="mssv">MSSV</Label><Input id="mssv" name="mssv" required /></div>
                    <div className="space-y-2"><Label htmlFor="hoTen">Họ tên</Label><Input id="hoTen" name="hoTen" required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Giới tính</Label>
                      <Select name="gioiTinh" defaultValue="Nam">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Nam">Nam</SelectItem><SelectItem value="Nữ">Nữ</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label htmlFor="khoa">Khóa</Label><Input id="khoa" name="khoa" placeholder="2022" required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="nganh">Ngành</Label><Input id="nganh" name="nganh" required /></div>
                    <div className="space-y-2"><Label htmlFor="chuyenNganh">Chuyên ngành</Label><Input id="chuyenNganh" name="chuyenNganh" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="khoaQuanLy">Khoa</Label><Input id="khoaQuanLy" name="khoaQuanLy" required /></div>
                    <div className="space-y-2"><Label htmlFor="lop">Lớp</Label><Input id="lop" name="lop" required /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="ngayVaoTruong">Ngày vào trường</Label><Input id="ngayVaoTruong" name="ngayVaoTruong" placeholder="dd/mm/yyyy" /></div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                  <Button type="submit">Tạo mới</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable columns={columns} data={students} searchKey="hoTen" searchPlaceholder="Tìm theo tên..." />

      {/* EDIT Dialog */}
      <Dialog open={!!editStudent} onOpenChange={(open) => { if (!open) setEditStudent(null) }}>
        <DialogContent className="sm:max-w-[500px]">
          {editStudent && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Sửa thông tin — {editStudent.mssv}</DialogTitle>
                <DialogDescription>{editStudent.hoTen}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Họ tên</Label><Input name="hoTen" defaultValue={editStudent.hoTen} required /></div>
                  <div className="space-y-2">
                    <Label>Giới tính</Label>
                    <Select name="gioiTinh" defaultValue={editStudent.gioiTinh}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Nam">Nam</SelectItem><SelectItem value="Nữ">Nữ</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Ngành</Label><Input name="nganh" defaultValue={editStudent.nganh} /></div>
                  <div className="space-y-2"><Label>Chuyên ngành</Label><Input name="chuyenNganh" defaultValue={editStudent.chuyenNganh} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Khoa</Label><Input name="khoaQuanLy" defaultValue={editStudent.khoaQuanLy} /></div>
                  <div className="space-y-2"><Label>Lớp</Label><Input name="lop" defaultValue={editStudent.lop} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <Select name="trangThai" defaultValue={editStudent.trangThai}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Đang học">Đang học</SelectItem>
                      <SelectItem value="Đã tốt nghiệp">Đã tốt nghiệp</SelectItem>
                      <SelectItem value="Bảo lưu">Bảo lưu</SelectItem>
                      <SelectItem value="Thôi học">Thôi học</SelectItem>
                    </SelectContent>
                  </Select>
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

      {/* DELETE Confirm Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa sinh viên <strong>{deleteTarget?.hoTen}</strong> (MSSV: {deleteTarget?.mssv})?
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Hủy</DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

