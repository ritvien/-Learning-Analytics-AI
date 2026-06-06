"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Teacher } from "@/types"
import { mockTeachers } from "@/lib/mock-data"
import { DataTable } from "@/components/crud/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react"

export default function TeachersPage() {
  const [teachers, setTeachers] = React.useState<Teacher[]>(mockTeachers)
  const [editTeacher, setEditTeacher] = React.useState<Teacher | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Teacher | null>(null)

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const newTeacher: Teacher = {
      id: `gv-${Date.now()}`,
      maGV: fd.get("maGV") as string,
      hoTen: fd.get("hoTen") as string,
      email: fd.get("email") as string,
      soDienThoai: fd.get("soDienThoai") as string,
      khoaQuanLy: fd.get("khoaQuanLy") as string,
      chucVu: fd.get("chucVu") as string,
      trangThai: "Đang công tác",
    }
    setTeachers([...teachers, newTeacher])
    setIsCreateOpen(false)
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTeacher) return
    const fd = new FormData(e.currentTarget)
    const updated: Teacher = {
      ...editTeacher,
      hoTen: fd.get("hoTen") as string,
      email: fd.get("email") as string,
      soDienThoai: fd.get("soDienThoai") as string,
      khoaQuanLy: fd.get("khoaQuanLy") as string,
      chucVu: fd.get("chucVu") as string,
      trangThai: fd.get("trangThai") as Teacher["trangThai"],
    }
    setTeachers(teachers.map((t) => (t.id === updated.id ? updated : t)))
    setEditTeacher(null)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    setTeachers(teachers.filter((t) => t.id !== deleteTarget.id))
    setDeleteTarget(null)
    setIsDeleteOpen(false)
  }

  const columns: ColumnDef<Teacher>[] = [
    { accessorKey: "maGV", header: "Mã GV" },
    {
      accessorKey: "hoTen",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Họ tên <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue("hoTen")}</span>,
    },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "khoaQuanLy", header: "Khoa" },
    { accessorKey: "chucVu", header: "Chức vụ" },
    {
      accessorKey: "trangThai",
      header: "Trạng thái",
      cell: ({ row }) => {
        const status = row.getValue("trangThai") as string
        return <Badge variant={status === "Đang công tác" ? "default" : "secondary"}>{status}</Badge>
      },
    },
    {
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => {
        const teacher = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditTeacher(teacher)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteTarget(teacher); setIsDeleteOpen(true) }}>
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
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Giảng viên</h1>
          <p className="text-muted-foreground">Thêm, sửa, xóa thông tin giảng viên.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Thêm GV
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Thêm Giảng viên</DialogTitle>
                <DialogDescription>Nhập thông tin giảng viên mới.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Mã GV</Label><Input name="maGV" required /></div>
                  <div className="space-y-2"><Label>Họ tên</Label><Input name="hoTen" required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
                  <div className="space-y-2"><Label>SĐT</Label><Input name="soDienThoai" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Khoa</Label><Input name="khoaQuanLy" required /></div>
                  <div className="space-y-2"><Label>Chức vụ</Label><Input name="chucVu" defaultValue="Giảng viên" /></div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Tạo mới</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={teachers} searchKey="hoTen" searchPlaceholder="Tìm theo tên GV..." />

      {/* EDIT Dialog */}
      <Dialog open={!!editTeacher} onOpenChange={(open) => { if (!open) setEditTeacher(null) }}>
        <DialogContent className="sm:max-w-[450px]">
          {editTeacher && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Sửa — {editTeacher.maGV}</DialogTitle>
                <DialogDescription>{editTeacher.hoTen}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Họ tên</Label><Input name="hoTen" defaultValue={editTeacher.hoTen} required /></div>
                  <div className="space-y-2"><Label>Email</Label><Input name="email" defaultValue={editTeacher.email} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>SĐT</Label><Input name="soDienThoai" defaultValue={editTeacher.soDienThoai} /></div>
                  <div className="space-y-2"><Label>Khoa</Label><Input name="khoaQuanLy" defaultValue={editTeacher.khoaQuanLy} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Chức vụ</Label><Input name="chucVu" defaultValue={editTeacher.chucVu} /></div>
                  <div className="space-y-2">
                    <Label>Trạng thái</Label>
                    <Select name="trangThai" defaultValue={editTeacher.trangThai}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Đang công tác">Đang công tác</SelectItem>
                        <SelectItem value="Nghỉ phép">Nghỉ phép</SelectItem>
                        <SelectItem value="Đã nghỉ">Đã nghỉ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

      {/* DELETE Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa giảng viên <strong>{deleteTarget?.hoTen}</strong> ({deleteTarget?.maGV})?
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

