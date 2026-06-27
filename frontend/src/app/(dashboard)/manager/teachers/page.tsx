"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Teacher } from "@/types"
import { api, getCachedCurrentUser, type ApiDepartment, type ApiTeacher, type ApiSection, type ApiSemester, type ApiCourse } from "@/lib/api"
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
import { ArrowUpDown, KeyRound, Pencil, Plus, Trash2, BookOpen } from "lucide-react"

const ACTIVE_STATUS: Teacher["trangThai"] = "Đang công tác"
const INACTIVE_STATUS: Teacher["trangThai"] = "Đã nghỉ"

type TeacherRow = Teacher & { userId: string | null; sectionCount: number }

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim()
  return text ? text : null
}

function toTeacher(row: ApiTeacher, departments: ApiDepartment[], sections: ApiSection[]): TeacherRow {
  const departmentName = departments.find((item) => item.id === row.department_id)?.name
  const teacherSections = sections.filter((s) => s.teacher_id === row.id)
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
  }
}

export default function TeachersPage() {
  const [teachers, setTeachers] = React.useState<TeacherRow[]>([])
  const [rawTeachers, setRawTeachers] = React.useState<ApiTeacher[]>([])
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [sections, setSections] = React.useState<ApiSection[]>([])
  const [semesters, setSemesters] = React.useState<ApiSemester[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editTeacher, setEditTeacher] = React.useState<TeacherRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<TeacherRow | null>(null)
  const [accountTarget, setAccountTarget] = React.useState<TeacherRow | null>(null)
  const [assignTarget, setAssignTarget] = React.useState<TeacherRow | null>(null)
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
      const [apiTeachers, apiDepartments, apiSections, apiSemesters, apiCourses] = await Promise.all([
        api.getTeachers({ limit: 1000 }),
        api.getDepartments({ limit: 100 }),
        api.getSections({ limit: 3000 }),
        api.getSemesters(),
        api.getCourses({ limit: 3000 }),
      ])
      setRawTeachers(apiTeachers)
      setDepartments(apiDepartments)
      setSections(apiSections)
      setSemesters(apiSemesters)
      setCourses(apiCourses)
      setTeachers(apiTeachers.map((teacher) => toTeacher(teacher, apiDepartments, apiSections)))
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
      accessorKey: "sectionCount",
      header: "Số lớp phụ trách",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.sectionCount} lớp
        </Badge>
      ),
    },
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
            <Button variant="ghost" size="icon-sm" onClick={() => setAssignTarget(teacher)} title="Phân lớp">
              <BookOpen className="h-4 w-4 text-primary" />
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
    </div>
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
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [onlyUnassigned, setOnlyUnassigned] = React.useState<boolean>(false)
  const [saving, setSaving] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [tempAssignedIds, setTempAssignedIds] = React.useState<number[]>([])

  React.useEffect(() => {
    if (semesters.length > 0 && !selectedSemesterId) {
      const latest = [...semesters].sort((a, b) => b.id - a.id)[0]
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

  const filteredSections = sections.filter((sec) => {
    if (String(sec.semester_id) !== selectedSemesterId) return false
    
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

  const handleCheckboxChange = (sectionId: number, checked: boolean) => {
    if (checked) {
      setTempAssignedIds((prev) => [...prev, sectionId])
    } else {
      setTempAssignedIds((prev) => prev.filter((id) => id !== sectionId))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const currentSemesterSections = sections.filter((s) => String(s.semester_id) === selectedSemesterId)
      
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
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle>Phân công lớp học phần</DialogTitle>
          <DialogDescription>
            Phân công lớp cho giảng viên <strong>{teacher.hoTen}</strong> ({teacher.maGV})
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive mb-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 py-2 flex-1 overflow-hidden">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Học kỳ</Label>
              <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                <SelectTrigger><SelectValue placeholder="Chọn học kỳ" /></SelectTrigger>
                <SelectContent>
                  {semesters.map((sem) => (
                    <SelectItem key={sem.id} value={String(sem.id)}>{sem.name}</SelectItem>
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

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="onlyUnassigned" 
              checked={onlyUnassigned} 
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="onlyUnassigned" className="text-sm font-medium cursor-pointer">
              Chỉ hiển thị các lớp chưa phân công (hoặc đang phân cho giảng viên này)
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu phân công"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
