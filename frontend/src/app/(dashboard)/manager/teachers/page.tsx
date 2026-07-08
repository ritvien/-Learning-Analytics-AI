"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Teacher } from "@/types"
import { api, getCachedCurrentUser, type ApiDepartment, type ApiTeacher, type ApiSection, type ApiSemester, type ApiCourse, type ApiUser, type ApiStudent, type ApiProgram, type ApiHomeroomAssignment } from "@/lib/api"
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
import { ArrowUpDown, KeyRound, Pencil, Plus, Trash2, BookOpen, GraduationCap, Users } from "lucide-react"

const ACTIVE_STATUS: Teacher["trangThai"] = "Đang công tác"
const INACTIVE_STATUS: Teacher["trangThai"] = "Đã nghỉ"

type TeacherRow = Teacher & {
  userId: string | null
  sectionCount: number
  departmentId: number
  accountRole?: string | null
  accountActive?: boolean | null
}

type DataCoverageFilter = "all" | "ready" | "missing-section" | "missing-homeroom" | "missing-account"

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim()
  return text ? text : null
}

function teacherErrorMessage(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback
  if (err.message.includes("Teacher code already exists")) {
    return "Mã giảng viên đã tồn tại. Hãy đổi mã khác hoặc bỏ trống nếu chưa có mã chính thức."
  }
  if (err.message.includes("Teacher email already exists")) {
    return "Email này đã được dùng cho giảng viên khác."
  }
  if (err.message.includes("Teacher phone already exists")) {
    return "Số điện thoại này đã được dùng cho giảng viên khác."
  }
  if (err.message.includes("Teacher email is required to create login account")) {
    return "Cần nhập email công tác nếu muốn cấp tài khoản đăng nhập giảng dạy."
  }
  if (err.message.includes("String should have at most 20 characters")) {
    return "Mã giảng viên tối đa 20 ký tự."
  }
  return err.message || fallback
}

function toTeacher(row: ApiTeacher, departments: ApiDepartment[], sections: ApiSection[], users: ApiUser[] = []): TeacherRow {
  const departmentName = departments.find((item) => item.id === row.department_id)?.name
  const teacherSections = sections.filter((s) => s.teacher_id === row.id)
  const linkedUser = row.user_id ? users.find((user) => user.id === row.user_id) : undefined
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
    sectionCount: teacherSections.length,
    departmentId: row.department_id,
    accountRole: linkedUser?.role ?? null,
    accountActive: linkedUser?.is_active ?? null,
  }
}

export default function TeachersPage() {
  const [teachers, setTeachers] = React.useState<TeacherRow[]>([])
  const [rawTeachers, setRawTeachers] = React.useState<ApiTeacher[]>([])
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [sections, setSections] = React.useState<ApiSection[]>([])
  const [semesters, setSemesters] = React.useState<ApiSemester[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [programs, setPrograms] = React.useState<ApiProgram[]>([])
  const [students, setStudents] = React.useState<ApiStudent[]>([])
  const [homeroomAssignments, setHomeroomAssignments] = React.useState<ApiHomeroomAssignment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editTeacher, setEditTeacher] = React.useState<TeacherRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<TeacherRow | null>(null)
  const [accountTarget, setAccountTarget] = React.useState<TeacherRow | null>(null)
  const [assignTarget, setAssignTarget] = React.useState<TeacherRow | null>(null)
  const [homeroomTarget, setHomeroomTarget] = React.useState<TeacherRow | null>(null)
  const [departmentFilter, setDepartmentFilter] = React.useState("all")
  const [coverageFilter, setCoverageFilter] = React.useState<DataCoverageFilter>("all")
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
      const [apiTeachers, apiDepartments, apiSections, apiSemesters, apiCourses, apiPrograms, apiStudents, apiHomeroom] = await Promise.all([
        api.getTeachers({ limit: 1000 }),
        api.getDepartments({ limit: 100 }),
        api.getSections({ limit: 3000 }),
        api.getSemesters(),
        api.getCourses({ limit: 3000 }),
        api.getPrograms({ limit: 1000 }),
        api.getStudents({ limit: 5000 }),
        api.getHomeroomAssignments(),
      ])
      const apiUsers = userRole === "superadmin" || userRole === "admin"
        ? await api.getUsers({ limit: 1000 }).catch(() => [])
        : []
      setRawTeachers(apiTeachers)
      setDepartments(apiDepartments)
      setSections(apiSections)
      setSemesters(apiSemesters)
      setCourses(apiCourses)
      setPrograms(apiPrograms)
      setStudents(apiStudents)
      setHomeroomAssignments(apiHomeroom)
      setTeachers(apiTeachers.map((teacher) => toTeacher(teacher, apiDepartments, apiSections, apiUsers)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách giảng viên")
    } finally {
      setIsLoading(false)
    }
  }, [userRole])

  React.useEffect(() => {
    void Promise.resolve().then(loadTeachers)
  }, [loadTeachers])

  const canCreateTeacher = departments.length > 0

  const getTeacherHomerooms = React.useCallback(
    (teacherId: string | number) => homeroomAssignments.filter(item => item.teacher_id === Number(teacherId)),
    [homeroomAssignments],
  )

  const summary = React.useMemo(() => {
    const withSections = teachers.filter((teacher) => teacher.sectionCount > 0).length
    const withHomeroom = teachers.filter((teacher) => getTeacherHomerooms(teacher.id).length > 0).length
    const withAccount = teachers.filter((teacher) => Boolean(teacher.userId)).length
    return { withSections, withHomeroom, withAccount }
  }, [teachers, getTeacherHomerooms])

  const filteredTeachers = React.useMemo(() => {
    return teachers.filter((teacher) => {
      if (departmentFilter !== "all" && String(teacher.departmentId) !== departmentFilter) return false
      const homeroomCount = getTeacherHomerooms(teacher.id).length
      if (coverageFilter === "ready") return teacher.sectionCount > 0 && homeroomCount > 0 && Boolean(teacher.userId)
      if (coverageFilter === "missing-section") return teacher.sectionCount === 0
      if (coverageFilter === "missing-homeroom") return homeroomCount === 0
      if (coverageFilter === "missing-account") return !teacher.userId
      return true
    })
  }, [teachers, departmentFilter, coverageFilter, getTeacherHomerooms])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const departmentId = Number(fd.get("department_id") ?? 0)
    const loginPassword = nullable(fd.get("loginPassword"))
    if (!departmentId) {
      setError("Vui lòng chọn khoa quản lý cho giảng viên.")
      return
    }
    try {
      const created = await api.createTeacher({
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
      setAssignTarget(toTeacher(created, departments, sections))
    } catch (err) {
      setError(teacherErrorMessage(err, "Không tạo được giảng viên"))
    }
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTeacher) return
    const fd = new FormData(e.currentTarget)
    const departmentId = Number(fd.get("department_id") ?? editTeacher.departmentId)
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
      setError(teacherErrorMessage(err, "Không cập nhật được giảng viên"))
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
      setError(teacherErrorMessage(err, "Không cấp được tài khoản giảng viên"))
    }
  }

  const columns: ColumnDef<TeacherRow>[] = [
    {
      accessorKey: "hoTen",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Giảng viên <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[220px]">
          <div className="font-medium">{row.original.hoTen}</div>
          <div className="text-xs text-muted-foreground">{row.original.maGV} · {row.original.email || "Chưa có email"}</div>
        </div>
      ),
    },
    {
      accessorKey: "khoaQuanLy",
      header: "Khoa / chuyên môn",
      cell: ({ row }) => (
        <div className="max-w-[260px]">
          <div className="truncate font-medium" title={row.original.khoaQuanLy}>{row.original.khoaQuanLy}</div>
          <div className="truncate text-xs text-muted-foreground" title={row.original.chucVu}>{row.original.chucVu}</div>
        </div>
      ),
    },
    {
      accessorKey: "sectionCount",
      header: "Môn dạy",
      cell: ({ row }) => (
        <Badge variant={row.original.sectionCount > 0 ? "default" : "secondary"}>
          {row.original.sectionCount} lớp
        </Badge>
      ),
    },
    {
      id: "homeroomCount",
      header: "Lớp chủ nhiệm",
      cell: ({ row }) => {
        const assigned = getTeacherHomerooms(row.original.id)
        const labels = assigned.map(item => item.class_code)
        return (
          <Badge variant={assigned.length ? "default" : "secondary"} title={labels.join(", ")}>
            {assigned.length ? `${assigned.length} lớp` : "Chưa giao"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "userId",
      header: "Tài khoản",
      cell: ({ row }) => {
        const teacher = row.original
        if (!teacher.userId) {
          return <Badge variant="secondary">Chưa cấp</Badge>
        }
        if (teacher.accountRole === "manager") {
          return <Badge variant="default">Manager kiêm giảng dạy</Badge>
        }
        if (teacher.accountRole && teacher.accountRole !== "lecturer") {
          return <Badge variant="destructive">Role không hợp lệ</Badge>
        }
        if (teacher.accountActive === false) {
          return <Badge variant="destructive">Đã khóa</Badge>
        }
        return <Badge variant="default">Lecturer active</Badge>
      },
    },
    ...(hasWriteAccess ? [{
      id: "actions",
      header: "Thao tác",
      cell: ({ row }: { row: { original: TeacherRow } }) => {
        const teacher = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setAssignTarget(teacher)} title="Phân lớp">
              <BookOpen className="h-4 w-4 text-primary" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setHomeroomTarget(teacher)} title="Giao lớp chủ nhiệm">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setAccountTarget(teacher)} title="Cấp/Reset tài khoản">
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditTeacher(teacher)} title="Sửa">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteTarget(teacher); setIsDeleteOpen(true) }} title="Xóa">
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
            <DialogTrigger render={<Button disabled={!canCreateTeacher} />}>
              <Plus className="mr-2 h-4 w-4" /> Thêm GV
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Thêm Giảng viên</DialogTitle>
                  <DialogDescription>
                    Tạo hồ sơ giảng viên trước; nhập email và mật khẩu nếu muốn cấp hoặc liên kết tài khoản giảng dạy.
                  </DialogDescription>
                </DialogHeader>
                <TeacherForm departments={departments} />
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                  <Button type="submit">Tạo và phân lớp</Button>
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

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Tổng</div>
          <div className="mt-1 text-2xl font-semibold">{teachers.length}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Có môn dạy</div>
          <div className="mt-1 text-2xl font-semibold">{summary.withSections}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Có chủ nhiệm</div>
          <div className="mt-1 text-2xl font-semibold">{summary.withHomeroom}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Có tài khoản</div>
          <div className="mt-1 text-2xl font-semibold">{summary.withAccount}</div>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(220px,1fr)_220px_auto] md:items-end" data-tour="page-teachers-filters">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Khoa</Label>
          <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả khoa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả khoa</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>
                  {department.code} - {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Tình trạng dữ liệu</Label>
          <Select value={coverageFilter} onValueChange={(value) => setCoverageFilter((value ?? "all") as DataCoverageFilter)}>
            <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="ready">Đủ môn + chủ nhiệm</SelectItem>
              <SelectItem value="missing-section">Thiếu môn dạy</SelectItem>
              <SelectItem value="missing-homeroom">Thiếu chủ nhiệm</SelectItem>
              <SelectItem value="missing-account">Thiếu tài khoản</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDepartmentFilter("all")
            setCoverageFilter("all")
          }}
        >
          Xóa lọc
        </Button>
      </div>

      <div data-tour="page-teachers-results">
        <DataTable columns={columns} data={filteredTeachers} searchKey="hoTen" searchPlaceholder="Tìm theo tên GV..." />
      </div>

      <Dialog open={!!editTeacher} onOpenChange={(open) => { if (!open) setEditTeacher(null) }}>
        <DialogContent className="sm:max-w-[680px]">
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
      {assignTarget && (
        <AssignSectionsDialog
          teacher={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={async () => {
            setAssignTarget(null)
            await loadTeachers()
          }}
          semesters={semesters}
          courses={courses}
          sections={sections}
          teachers={rawTeachers}
        />
      )}
      {homeroomTarget && (
        <AssignHomeroomDialog
          teacher={homeroomTarget}
          assignments={homeroomAssignments}
          students={students}
          programs={programs}
          onClose={() => setHomeroomTarget(null)}
          onSaved={async () => {
            setHomeroomTarget(null)
            await loadTeachers()
          }}
        />
      )}
    </div>
  )
}

function AssignHomeroomDialog({
  teacher,
  assignments,
  students,
  programs,
  onClose,
  onSaved,
}: {
  teacher: TeacherRow
  assignments: ApiHomeroomAssignment[]
  students: ApiStudent[]
  programs: ApiProgram[]
  onClose: () => void
  onSaved: () => void
}) {
  const [classCode, setClassCode] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const currentAssignments = assignments.filter(item => item.teacher_id === Number(teacher.id))
  const programIds = new Set(programs.filter(item => item.department_id === teacher.departmentId).map(item => item.id))
  const availableClassCodes = [...new Set(
    students
      .filter(item => item.class_code && programIds.has(item.program_id))
      .map(item => item.class_code as string),
  )].sort()

  async function assign() {
    if (!classCode) return
    setSaving(true)
    setError(null)
    try {
      await api.createHomeroomAssignment({ teacher_id: Number(teacher.id), class_code: classCode })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không giao được lớp chủ nhiệm")
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    setSaving(true)
    try {
      await api.deleteHomeroomAssignment(id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gỡ được lớp chủ nhiệm")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Giao lớp chủ nhiệm</DialogTitle>
          <DialogDescription>
            Giao lớp hành chính cho <strong>{teacher.hoTen}</strong>. Quan hệ này độc lập với lớp học phần giảng dạy.
          </DialogDescription>
        </DialogHeader>
        {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Lớp hành chính trong khoa</Label>
            <Select value={classCode} onValueChange={(value) => setClassCode(value ?? "")}>
              <SelectTrigger><SelectValue placeholder="Chọn lớp chủ nhiệm" /></SelectTrigger>
              <SelectContent>
                {availableClassCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Đang được giao</Label>
            {currentAssignments.length ? currentAssignments.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{item.class_code}</span>
                <Button variant="ghost" size="sm" onClick={() => remove(item.id)} disabled={saving}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Gỡ
                </Button>
              </div>
            )) : <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Chưa được giao lớp chủ nhiệm.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button onClick={assign} disabled={!classCode || saving}>{saving ? "Đang lưu..." : "Giao lớp"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AssignSectionsDialogProps {
  teacher: TeacherRow | null
  onClose: () => void
  onSaved: () => void
  semesters: ApiSemester[]
  courses: ApiCourse[]
  sections: ApiSection[]
  teachers: ApiTeacher[]
}

function AssignSectionsDialog({
  teacher,
  onClose,
  onSaved,
  semesters,
  courses,
  sections,
  teachers,
}: AssignSectionsDialogProps) {
  const [selectedSemesterId, setSelectedSemesterId] = React.useState<string>("")
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [onlyUnassigned, setOnlyUnassigned] = React.useState<boolean>(true)
  const [saving, setSaving] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [tempAssignedIds, setTempAssignedIds] = React.useState<number[]>([])

  React.useEffect(() => {
    if (semesters.length > 0 && !selectedSemesterId) {
      const latest = semesters.find((semester) => semester.is_current)
        ?? [...semesters].sort((a, b) => b.year - a.year || b.term - a.term || b.id - a.id)[0]
      setSelectedSemesterId(String(latest.id))
    }
  }, [semesters, selectedSemesterId])

  React.useEffect(() => {
    if (teacher && selectedSemesterId) {
      const currentAssigned = sections
        .filter((s) => s.teacher_id === Number(teacher.id) && String(s.semester_id) === selectedSemesterId)
        .map((s) => s.id)
      setTempAssignedIds(currentAssigned)
    }
  }, [teacher, selectedSemesterId, sections])

  if (!teacher) return null

  const teacherDepartmentCourses = courses.filter((course) => course.department_id === teacher.departmentId)
  const teacherDepartmentCourseIds = new Set(teacherDepartmentCourses.map((course) => course.id))
  const visibleAssignedCount = tempAssignedIds.length
  const currentSemesterSections = sections.filter(
    (section) => String(section.semester_id) === selectedSemesterId && teacherDepartmentCourseIds.has(section.course_id),
  )
  const changedSections = currentSemesterSections.filter((section) => {
    const wasAssigned = section.teacher_id === Number(teacher.id)
    const isChecked = tempAssignedIds.includes(section.id)
    return wasAssigned !== isChecked
  })

  const filteredSections = sections.filter((sec) => {
    if (String(sec.semester_id) !== selectedSemesterId) return false
    if (!teacherDepartmentCourseIds.has(sec.course_id)) return false
    if (selectedCourseId !== "all" && String(sec.course_id) !== selectedCourseId) return false
    
    const course = courses.find((c) => c.id === sec.course_id)
    const matchQuery = 
      sec.section_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course?.code ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      
    if (!matchQuery) return false

    if (onlyUnassigned) {
      return sec.teacher_id === null || sec.teacher_id === Number(teacher.id)
    }

    return true
  })

  const currentTeacherSections = sections.filter(
    (section) => section.teacher_id === Number(teacher.id) && teacherDepartmentCourseIds.has(section.course_id),
  )
  const unassignedVisibleCount = filteredSections.filter((section) => section.teacher_id === null).length

  const handleCheckboxChange = (sectionId: number, checked: boolean) => {
    if (checked) {
      setTempAssignedIds((prev) => [...prev, sectionId])
    } else {
      setTempAssignedIds((prev) => prev.filter((id) => id !== sectionId))
    }
  }

  const handleSelectVisible = () => {
    setTempAssignedIds((current) => {
      const next = new Set(current)
      for (const section of filteredSections) {
        if (section.teacher_id === null || section.teacher_id === Number(teacher.id)) {
          next.add(section.id)
        }
      }
      return Array.from(next)
    })
  }

  const handleClearVisible = () => {
    const visibleIds = new Set(filteredSections.map((section) => section.id))
    setTempAssignedIds((current) => current.filter((id) => !visibleIds.has(id)))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Kiểm tra xem có lớp nào đang được gán cho giảng viên khác mà người dùng muốn chuyển không
      const sectionsToTransfer: ApiSection[] = []
      for (const sec of currentSemesterSections) {
        const wasAssigned = sec.teacher_id === Number(teacher.id)
        const isCurrentlyChecked = tempAssignedIds.includes(sec.id)
        if (isCurrentlyChecked && !wasAssigned && sec.teacher_id !== null && sec.teacher_id !== Number(teacher.id)) {
          sectionsToTransfer.push(sec)
        }
      }

      if (sectionsToTransfer.length > 0) {
        const names = sectionsToTransfer.map(s => {
          const course = courses.find(c => c.id === s.course_id)
          const otherTeacher = teachers.find(t => t.id === s.teacher_id)
          const tName = otherTeacher ? otherTeacher.full_name : `Giảng viên #${s.teacher_id}`
          return `- Lớp ${s.section_code} (${course?.name || "Chưa rõ"}) đang được gán cho ${tName}`
        }).join("\n")
        
        const ok = window.confirm(
          `Có lớp học phần đang được gán cho giảng viên khác. Bạn có chắc chắn muốn chuyển các lớp sau sang giảng viên này?\n\n${names}`
        )
        if (!ok) {
          setSaving(false)
          return
        }
      }

      if (changedSections.length === 0) {
        setError("Chưa có thay đổi nào để lưu. Hãy chọn hoặc bỏ chọn lớp học phần trước.")
        setSaving(false)
        return
      }

      const promises: Promise<unknown>[] = []

      for (const sec of currentSemesterSections) {
        const wasAssigned = sec.teacher_id === Number(teacher.id)
        const isCurrentlyChecked = tempAssignedIds.includes(sec.id)

        if (isCurrentlyChecked && !wasAssigned) {
          promises.push(api.updateSection(sec.id, { teacher_id: Number(teacher.id) }))
        } else if (!isCurrentlyChecked && wasAssigned) {
          promises.push(api.updateSection(sec.id, { teacher_id: null }))
        }
      }

      await Promise.all(promises)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi lưu phân công")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle>Phân công lớp học phần</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Phân công lớp cho <strong>{teacher.hoTen}</strong> ({teacher.maGV}) trong khoa {teacher.khoaQuanLy}.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive mb-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 py-2 flex-1 overflow-hidden">
          <div className="grid gap-3 md:grid-cols-[180px_minmax(280px,1fr)_220px]">
            <div className="space-y-1">
              <Label>Học kỳ</Label>
              <Select value={selectedSemesterId} onValueChange={(value) => setSelectedSemesterId(value ?? "")}>
                <SelectTrigger><SelectValue placeholder="Chọn học kỳ" /></SelectTrigger>
                <SelectContent>
                  {semesters.map((sem) => (
                    <SelectItem key={sem.id} value={String(sem.id)}>{sem.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Môn học trong khoa</Label>
              <Select value={selectedCourseId} onValueChange={(value) => setSelectedCourseId(value ?? "all")}>
                <SelectTrigger className="h-auto min-h-9 w-full whitespace-normal py-2 *:data-[slot=select-value]:line-clamp-none">
                  <SelectValue placeholder="Tất cả môn" />
                </SelectTrigger>
                <SelectContent align="start" className="max-h-80 min-w-[min(560px,calc(100vw-2rem))]">
                  <SelectItem value="all">Tất cả môn trong khoa</SelectItem>
                  {teacherDepartmentCourses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)} className="items-start py-2 pr-8">
                      <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal leading-snug">
                        <span className="font-mono text-xs font-semibold text-primary">{course.code}</span>
                        <span>{course.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tìm kiếm lớp / môn</Label>
              <Input 
                placeholder="Mã lớp, tên môn..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm md:flex-row md:items-center md:justify-between">
            <div className="text-muted-foreground">
              Đang phụ trách <strong className="text-foreground">{currentTeacherSections.length}</strong> lớp.
              Danh sách hiện tại có <strong className="text-foreground">{filteredSections.length}</strong> lớp,
              trong đó <strong className="text-foreground">{unassignedVisibleCount}</strong> lớp chưa phân công.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSelectVisible}>Chọn lớp trống</Button>
              <Button type="button" variant="outline" size="sm" onClick={handleClearVisible}>Bỏ chọn trang này</Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="onlyUnassigned"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="onlyUnassigned" className="text-sm font-medium cursor-pointer">
              Chỉ hiện lớp chưa phân công hoặc đang thuộc giảng viên này
            </Label>
          </div>

          <div className="flex-1 border rounded-md overflow-y-auto min-h-[200px] max-h-[350px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr className="border-b text-left">
                  <th className="p-3 w-12">Chọn</th>
                  <th className="p-3">Mã lớp</th>
                  <th className="p-3">Môn học</th>
                  <th className="p-3">Trạng thái hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">
                      Không tìm thấy lớp học phần nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredSections.map((sec) => {
                    const course = courses.find((c) => c.id === sec.course_id)
                    const isChecked = tempAssignedIds.includes(sec.id)
                    
                    let currentTeacherText = "Chưa phân công"
                    let isAssignedToOther = false
                    if (sec.teacher_id !== null) {
                      if (sec.teacher_id === Number(teacher.id)) {
                        currentTeacherText = "Đang gán cho GV này"
                      } else {
                        const otherTeacher = teachers.find((t) => t.id === sec.teacher_id)
                        currentTeacherText = otherTeacher ? `Đang gán cho: ${otherTeacher.full_name}` : `Đang gán cho GV #${sec.teacher_id}`
                        isAssignedToOther = true
                      }
                    }

                    return (
                      <tr key={sec.id} className="hover:bg-muted/50">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleCheckboxChange(sec.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="p-3 font-mono font-medium">{sec.section_code}</td>
                        <td className="p-3">
                          <div>{course?.name}</div>
                          <div className="text-xs text-muted-foreground">{course?.code} ({course?.credits} tín chỉ)</div>
                        </td>
                        <td className="p-3">
                          {isAssignedToOther ? (
                            <span className="text-amber-600 font-medium text-xs">
                              {currentTeacherText}
                              {isChecked && " (Sẽ chuyển quyền)"}
                            </span>
                          ) : sec.teacher_id === Number(teacher.id) ? (
                            <span className="text-green-600 font-medium text-xs">{currentTeacherText}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{currentTeacherText}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving || changedSections.length === 0}>
            {saving ? "Đang lưu..." : changedSections.length ? `Lưu ${changedSections.length} thay đổi` : `Đã chọn ${visibleAssignedCount} lớp`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeacherForm({ departments, teacher }: { departments: ApiDepartment[]; teacher?: TeacherRow }) {
  const defaultDepartmentValue = teacher?.departmentId
    ? String(teacher.departmentId)
    : departments.length === 1
      ? String(departments[0].id)
      : ""
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Mã GV</Label>
          <Input name="maGV" defaultValue={teacher?.maGV} maxLength={20} placeholder="Bỏ trống nếu chưa có mã riêng" />
          <p className="text-xs text-muted-foreground">Nếu nhập mã, mã này không được trùng với giảng viên đã có.</p>
        </div>
        <div className="space-y-2">
          <Label>Họ tên</Label>
          <Input name="hoTen" defaultValue={teacher?.hoTen} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email công tác</Label>
          <Input name="email" type="email" defaultValue={teacher?.email} />
        </div>
        <div className="space-y-2">
          <Label>SĐT</Label>
          <Input name="soDienThoai" defaultValue={teacher?.soDienThoai} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Khoa quản lý *</Label>
          <Select name="department_id" defaultValue={defaultDepartmentValue}>
            <SelectTrigger className="h-auto min-h-10 w-full items-start whitespace-normal py-2 *:data-[slot=select-value]:line-clamp-none">
              <SelectValue placeholder="Chọn khoa quản lý" />
            </SelectTrigger>
            <SelectContent align="start" className="max-h-80 min-w-[min(640px,calc(100vw-2rem))]">
              {departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)} className="items-start py-2 pr-8">
                  <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal leading-snug">
                    <span className="font-mono text-xs font-semibold text-primary">{department.code}</span>
                    <span>{department.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {departments.length === 1
              ? "Tài khoản hiện tại chỉ có quyền trong khoa này."
              : "Chọn khoa trước để phân lớp theo đúng phạm vi."}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Chức vụ</Label>
          <Input name="chucVu" defaultValue={teacher?.chucVu ?? "Giảng viên"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Chuyên môn</Label>
          <Input name="chuyenMon" defaultValue={teacher?.chucVu === "Giảng viên" ? "" : undefined} placeholder="Ví dụ: AI, Cơ sở dữ liệu" />
        </div>
        {!teacher && (
          <div className="space-y-2">
            <Label>Mật khẩu tài khoản giảng dạy</Label>
            <Input name="loginPassword" type="password" minLength={6} placeholder="Bỏ trống nếu chưa cấp account" />
            <p className="text-xs text-muted-foreground">Cần có email công tác để tạo tài khoản đăng nhập.</p>
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
