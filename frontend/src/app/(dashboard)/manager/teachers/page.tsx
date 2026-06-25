"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Teacher } from "@/types"
import { api, getCachedCurrentUser, type ApiDepartment, type ApiTeacher } from "@/lib/api"
import { DataTable } from "@/components/crud/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ArrowUpDown, KeyRound, Pencil, Plus, Trash2 } from "lucide-react"

const ACTIVE_STATUS: Teacher["trangThai"] = "Đang công tác"
const INACTIVE_STATUS: Teacher["trangThai"] = "Đã nghỉ"

type TeacherRow = Teacher & { userId: string | null }

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim()
  return text ? text : null
}

function toTeacher(row: ApiTeacher, departments: ApiDepartment[]): TeacherRow {
  const departmentName = departments.find((item) => item.id === row.department_id)?.name
  return {
    id: String(row.id),
    maGV: row.code ?? `GV-${row.id}`,
    hoTen: row.full_name,
    email: row.email ?? "",
    soDienThoai: row.phone ?? "",
    khoaQuanLy: departmentName ?? `Khoa #${row.department_id}`,
    chucVu: row.academic_title || row.specialization || "Giảng viên",
    trangThai: row.is_active ? ACTIVE_STATUS : INACTIVE_STATUS,
    userId: row.user_id,
  }
}

export default function TeachersPage() {
  const [teachers, setTeachers] = React.useState<TeacherRow[]>([])
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editTeacher, setEditTeacher] = React.useState<TeacherRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<TeacherRow | null>(null)
  const [accountTarget, setAccountTarget] = React.useState<TeacherRow | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [userRole] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const u = getCachedCurrentUser()
      return u ? u.role : null
    }
    return null
  })

  const hasWriteAccess = userRole === "superadmin" || userRole === "admin" || userRole === "manager"

  const loadTeachers = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [apiTeachers, apiDepartments] = await Promise.all([
        api.getTeachers({ limit: 1000 }),
        api.getDepartments({ limit: 100 }),
      ])
      setDepartments(apiDepartments)
      setTeachers(apiTeachers.map((teacher) => toTeacher(teacher, apiDepartments)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách giảng viên")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void Promise.resolve().then(loadTeachers)
  }, [loadTeachers])

  const defaultDepartmentId = departments[0]?.id

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const departmentId = Number(fd.get("department_id") ?? defaultDepartmentId)
    const loginPassword = nullable(fd.get("loginPassword"))
    if (!departmentId) return
    try {
      await api.createTeacher({
        department_id: departmentId,
        code: nullable(fd.get("maGV")),
        full_name: String(fd.get("hoTen") ?? "").trim(),
        email: nullable(fd.get("email")),
        phone: nullable(fd.get("soDienThoai")),
        academic_title: nullable(fd.get("chucVu")),
        specialization: nullable(fd.get("chuyenMon")),
        is_active: true,
        create_account: Boolean(loginPassword),
        login_password: loginPassword,
      })
      setIsCreateOpen(false)
      await loadTeachers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được giảng viên")
    }
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTeacher) return
    const fd = new FormData(e.currentTarget)
    const departmentId = Number(fd.get("department_id") ?? defaultDepartmentId)
    const status = fd.get("trangThai") as Teacher["trangThai"]
    try {
      await api.updateTeacher(Number(editTeacher.id), {
        department_id: departmentId,
        full_name: String(fd.get("hoTen") ?? "").trim(),
        email: nullable(fd.get("email")),
        phone: nullable(fd.get("soDienThoai")),
        academic_title: nullable(fd.get("chucVu")),
        specialization: nullable(fd.get("chuyenMon")),
        is_active: status === ACTIVE_STATUS,
      })
      setEditTeacher(null)
      await loadTeachers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được giảng viên")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteTeacher(Number(deleteTarget.id))
      setDeleteTarget(null)
      setIsDeleteOpen(false)
      await loadTeachers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được giảng viên")
    }
  }

  const handleProvisionAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!accountTarget) return
    const fd = new FormData(e.currentTarget)
    try {
      await api.provisionTeacherAccount(Number(accountTarget.id), {
        email: nullable(fd.get("loginEmail")),
        password: String(fd.get("loginPassword") ?? ""),
      })
      setAccountTarget(null)
      await loadTeachers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cấp được tài khoản giảng viên")
    }
  }

  const columns: ColumnDef<TeacherRow>[] = [
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
    { accessorKey: "soDienThoai", header: "SĐT" },
    { accessorKey: "khoaQuanLy", header: "Khoa" },
    { accessorKey: "chucVu", header: "Chức vụ" },
    {
      accessorKey: "userId",
      header: "Tài khoản",
      cell: ({ row }) => (
        <Badge variant={row.original.userId ? "default" : "secondary"}>
          {row.original.userId ? "Đã cấp" : "Chưa cấp"}
        </Badge>
      ),
    },
    {
      accessorKey: "trangThai",
      header: "Trạng thái",
      cell: ({ row }) => {
        const status = row.getValue("trangThai") as string
        return <Badge variant={status === ACTIVE_STATUS ? "default" : "secondary"}>{status}</Badge>
      },
    },
    ...(hasWriteAccess ? [{
      id: "actions",
      header: "Thao tác",
      cell: ({ row }: { row: { original: TeacherRow } }) => {
        const teacher = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setAccountTarget(teacher)}>
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditTeacher(teacher)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteTarget(teacher); setIsDeleteOpen(true) }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    } as ColumnDef<TeacherRow>] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Giảng viên</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Đang tải dữ liệu..." : `${teachers.length} giảng viên theo phạm vi tài khoản hiện tại`}
          </p>
        </div>
        {hasWriteAccess && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger render={<Button disabled={!defaultDepartmentId} />}>
              <Plus className="mr-2 h-4 w-4" /> Thêm GV
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Thêm Giảng viên</DialogTitle>
                  <DialogDescription>Nhập mật khẩu nếu muốn cấp tài khoản đăng nhập ngay.</DialogDescription>
                </DialogHeader>
                <TeacherForm departments={departments} />
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                  <Button type="submit">Tạo mới</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <DataTable columns={columns} data={teachers} searchKey="hoTen" searchPlaceholder="Tìm theo tên GV..." />

      <Dialog open={!!editTeacher} onOpenChange={(open) => { if (!open) setEditTeacher(null) }}>
        <DialogContent className="sm:max-w-[520px]">
          {editTeacher && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Sửa - {editTeacher.maGV}</DialogTitle>
                <DialogDescription>{editTeacher.hoTen}</DialogDescription>
              </DialogHeader>
              <TeacherForm departments={departments} teacher={editTeacher} />
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Lưu thay đổi</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!accountTarget} onOpenChange={(open) => { if (!open) setAccountTarget(null) }}>
        <DialogContent className="sm:max-w-[420px]">
          {accountTarget && (
            <form onSubmit={handleProvisionAccount}>
              <DialogHeader>
                <DialogTitle>{accountTarget.userId ? "Reset tài khoản" : "Cấp tài khoản"}</DialogTitle>
                <DialogDescription>{accountTarget.hoTen}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Email đăng nhập</Label>
                  <Input name="loginEmail" type="email" defaultValue={accountTarget.email} required />
                </div>
                <div className="space-y-2">
                  <Label>Mật khẩu</Label>
                  <Input name="loginPassword" type="password" minLength={6} required />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">{accountTarget.userId ? "Reset tài khoản" : "Cấp tài khoản"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

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

function TeacherForm({ departments, teacher }: { departments: ApiDepartment[]; teacher?: TeacherRow }) {
  const selectedDepartment = departments.find((department) => department.name === teacher?.khoaQuanLy)
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Mã GV</Label>
          <Input name="maGV" defaultValue={teacher?.maGV} />
        </div>
        <div className="space-y-2">
          <Label>Họ tên</Label>
          <Input name="hoTen" defaultValue={teacher?.hoTen} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input name="email" type="email" defaultValue={teacher?.email} />
        </div>
        <div className="space-y-2">
          <Label>SĐT</Label>
          <Input name="soDienThoai" defaultValue={teacher?.soDienThoai} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Khoa</Label>
          <Select name="department_id" defaultValue={String(selectedDepartment?.id ?? departments[0]?.id ?? "")}>
            <SelectTrigger><SelectValue placeholder="Chọn khoa" /></SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Chức vụ</Label>
          <Input name="chucVu" defaultValue={teacher?.chucVu ?? "Giảng viên"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Chuyên môn</Label>
          <Input name="chuyenMon" />
        </div>
        {!teacher && (
          <div className="space-y-2">
            <Label>Mật khẩu đăng nhập</Label>
            <Input name="loginPassword" type="password" minLength={6} />
          </div>
        )}
        {teacher && (
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select name="trangThai" defaultValue={teacher.trangThai}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ACTIVE_STATUS}>{ACTIVE_STATUS}</SelectItem>
                <SelectItem value={INACTIVE_STATUS}>{INACTIVE_STATUS}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
