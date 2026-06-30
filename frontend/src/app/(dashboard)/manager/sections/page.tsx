"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { api, getCachedCurrentUser, type ApiSection, type ApiSemester, type ApiCourse, type ApiTeacher, type ApiDepartment } from "@/lib/api"
import { DataTable } from "@/components/crud/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Pencil, Plus, Trash2 } from "lucide-react"

type SectionRow = ApiSection & {
  courseName: string
  courseCode: string
  semesterName: string
  teacherName: string
  departmentName: string
  departmentCode: string
}

function courseLabel(course: ApiCourse) {
  return `${course.code} - ${course.name}`
}

function departmentLabel(department: ApiDepartment) {
  return `${department.code} - ${department.name}`
}

function teacherLabel(teacher: ApiTeacher) {
  return `${teacher.code ?? `GV-${teacher.id}`} - ${teacher.full_name}`
}

function semesterLabel(semester: ApiSemester) {
  return `${semester.code} - ${semester.name}`
}

export default function SectionsPage() {
  const [sections, setSections] = React.useState<SectionRow[]>([])
  const [semesters, setSemesters] = React.useState<ApiSemester[]>([])
  const [courses, setCourses] = React.useState<ApiCourse[]>([])
  const [teachers, setTeachers] = React.useState<ApiTeacher[]>([])
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filters state
  const [filterSemesterId, setFilterSemesterId] = React.useState<string>("all")
  const [filterDepartmentId, setFilterDepartmentId] = React.useState<string>("all")
  const [filterCourseId, setFilterCourseId] = React.useState<string>("all")
  const [filterTeacherId, setFilterTeacherId] = React.useState<string>("all")
  const [createCourseId, setCreateCourseId] = React.useState<string>("")

  // Dialog targets
  const [editTarget, setEditTarget] = React.useState<SectionRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<SectionRow | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const [userRole] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const u = getCachedCurrentUser()
      return u ? u.role : null
    }
    return null
  })

  const hasWriteAccess = userRole === "superadmin" || userRole === "admin" || userRole === "manager"
  const activeFilterCourse = filterCourseId === "all"
    ? null
    : courses.find((course) => String(course.id) === filterCourseId)
  const filterDepartmentScopeId = filterDepartmentId !== "all"
    ? filterDepartmentId
    : activeFilterCourse?.department_id
      ? String(activeFilterCourse.department_id)
      : "all"
  const createCourses = courses.filter((course) => filterDepartmentId === "all" || String(course.department_id) === filterDepartmentId)
  const activeCreateCourseId = createCourseId || (createCourses[0]?.id ? String(createCourses[0].id) : "")
  const activeCreateCourse = courses.find((course) => String(course.id) === activeCreateCourseId)
  const createTeachers = teachers.filter((teacher) => !activeCreateCourse || teacher.department_id === activeCreateCourse.department_id)
  const activeCreateDepartment = departments.find((department) => department.id === activeCreateCourse?.department_id)
  const filterCourses = courses.filter((course) => filterDepartmentId === "all" || String(course.department_id) === filterDepartmentId)
  const filterTeachers = teachers.filter((teacher) => (
    filterDepartmentScopeId === "all" || String(teacher.department_id) === filterDepartmentScopeId
  ))

  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [apiSections, apiSemesters, apiCourses, apiTeachers, apiDepartments] = await Promise.all([
        api.getSections({ limit: 10000 }),
        api.getSemesters(),
        api.getCourses({ limit: 3000 }),
        api.getTeachers({ limit: 1000 }),
        api.getDepartments({ limit: 100 }),
      ])

      setSemesters(apiSemesters)
      setCourses(apiCourses)
      setTeachers(apiTeachers)
      setDepartments(apiDepartments)

      // Map rows
      const mapped = apiSections.map(sec => {
        const course = apiCourses.find(c => c.id === sec.course_id)
        const semester = apiSemesters.find(s => s.id === sec.semester_id)
        const teacher = apiTeachers.find(t => t.id === sec.teacher_id)
        const dept = apiDepartments.find(d => d.id === course?.department_id)

        return {
          ...sec,
          courseName: course?.name ?? "Chưa rõ môn học",
          courseCode: course?.code ?? "",
          semesterName: semester ? semesterLabel(semester) : `Kỳ #${sec.semester_id}`,
          teacherName: teacher?.full_name ?? "Chưa phân công",
          departmentName: dept?.name ?? "Chưa rõ khoa",
          departmentCode: dept?.code ?? "",
        }
      })
      setSections(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu lớp học phần")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [loadData])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)
    const fd = new FormData(e.currentTarget)

    const section_code = String(fd.get("section_code")).trim()
    const course_id = Number(activeCreateCourseId)
    const semester_id = Number(fd.get("semester_id"))
    const teacherVal = fd.get("teacher_id")
    const teacher_id = teacherVal && teacherVal !== "none" ? Number(teacherVal) : null
    const room = String(fd.get("room")).trim() || null
    const schedule = String(fd.get("schedule")).trim() || null
    const maxVal = fd.get("max_students")
    const max_students = maxVal ? Number(maxVal) : null

    if (!section_code || !course_id || !semester_id) {
      setSubmitError("Vui lòng điền đầy đủ Mã lớp, Môn học và Học kỳ.")
      return
    }

    try {
      await api.createSection({
        section_code,
        course_id,
        semester_id,
        teacher_id,
        room,
        schedule,
        max_students,
        is_active: true
      })
      setIsCreateOpen(false)
      await loadData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Lỗi khi tạo lớp học phần")
    }
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    setSubmitError(null)
    const fd = new FormData(e.currentTarget)

    const teacherVal = fd.get("teacher_id")
    const teacher_id = teacherVal && teacherVal !== "none" ? Number(teacherVal) : null
    const room = String(fd.get("room")).trim() || null
    const schedule = String(fd.get("schedule")).trim() || null
    const maxVal = fd.get("max_students")
    const max_students = maxVal ? Number(maxVal) : null
    const is_active = fd.get("is_active") === "true"

    try {
      await api.updateSection(editTarget.id, {
        teacher_id,
        room,
        schedule,
        max_students,
        is_active
      })
      setEditTarget(null)
      await loadData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Lỗi khi cập nhật lớp học phần")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteSection(deleteTarget.id)
      setDeleteTarget(null)
      setIsDeleteOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi xóa lớp học phần")
    }
  }

  // Filter application
  const filteredData = sections.filter(sec => {
    if (filterSemesterId !== "all" && String(sec.semester_id) !== filterSemesterId) return false
    if (filterTeacherId !== "all") {
      if (filterTeacherId === "none" && sec.teacher_id !== null) return false
      if (filterTeacherId !== "none" && String(sec.teacher_id) !== filterTeacherId) return false
    }
    if (filterCourseId !== "all" && String(sec.course_id) !== filterCourseId) return false
    
    // For Department filter, we need to map course to department
    if (filterDepartmentId !== "all") {
      const course = courses.find(c => c.id === sec.course_id)
      if (!course || String(course.department_id) !== filterDepartmentId) return false
    }

    return true
  })

  const assignedCount = filteredData.filter(sec => sec.teacher_id !== null).length
  const unlockedCount = filteredData.filter(sec => sec.is_active).length

  const editCourse = editTarget ? courses.find((course) => course.id === editTarget.course_id) : null
  const editTeachers = editCourse
    ? teachers.filter((teacher) => teacher.department_id === editCourse.department_id)
    : teachers

  const columns: ColumnDef<SectionRow>[] = [
    {
      accessorKey: "section_code",
      header: "Mã lớp",
      cell: ({ row }) => <span className="font-mono font-bold text-primary">{row.original.section_code}</span>
    },
    {
      accessorKey: "courseName",
      header: "Môn học",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.courseName}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.courseCode} · {row.original.departmentCode || row.original.departmentName}
          </div>
        </div>
      )
    },
    {
      accessorKey: "semesterName",
      header: "Học kỳ"
    },
    {
      accessorKey: "teacherName",
      header: "Giảng viên",
      cell: ({ row }) => (
        <span className={row.original.teacher_id ? "font-medium text-foreground" : "text-muted-foreground italic"}>
          {row.original.teacherName}
        </span>
      )
    },
    {
      accessorKey: "room",
      header: "Phòng",
      cell: ({ row }) => row.original.room || "-"
    },
    {
      accessorKey: "schedule",
      header: "Lịch học",
      cell: ({ row }) => row.original.schedule || "-"
    },
    {
      accessorKey: "max_students",
      header: "Sĩ số tối đa",
      cell: ({ row }) => row.original.max_students || "-"
    },
    {
      accessorKey: "is_active",
      header: "Trạng thái",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Đang mở" : "Đã khóa"}
        </Badge>
      )
    },
    ...(hasWriteAccess ? [{
      id: "actions",
      header: "Thao tác",
      cell: ({ row }: { row: { original: SectionRow } }) => {
        const sec = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditTarget(sec)} title="Sửa">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteTarget(sec); setIsDeleteOpen(true) }} title="Xóa">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      }
    } as ColumnDef<SectionRow>] : [])
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý lớp học phần</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Đang tải dữ liệu..." : `${filteredData.length} / ${sections.length} lớp học phần`}
          </p>
        </div>
        {hasWriteAccess && (
          <Button
            onClick={() => {
              setSubmitError(null)
              setCreateCourseId("")
              setIsCreateOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Thêm lớp học phần
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Tổng lớp</div>
          <div className="mt-1 text-2xl font-semibold">{filteredData.length}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Đã phân công</div>
          <div className="mt-1 text-2xl font-semibold">{assignedCount}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Chưa phân công</div>
          <div className="mt-1 text-2xl font-semibold">{filteredData.length - assignedCount}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Đang mở</div>
          <div className="mt-1 text-2xl font-semibold">{unlockedCount}</div>
        </div>
      </div>

      {/* Filter widgets */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-card text-card-foreground">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Học kỳ</Label>
          <Select value={filterSemesterId} onValueChange={(value) => setFilterSemesterId(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả học kỳ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {semesters.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{semesterLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {userRole !== "manager" && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Khoa</Label>
            <Select
              value={filterDepartmentId}
              onValueChange={(value) => {
                setFilterDepartmentId(value ?? "all")
                setFilterCourseId("all")
                setFilterTeacherId("all")
              }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả khoa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả khoa</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{departmentLabel(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Môn học</Label>
          <Select
            value={filterCourseId}
            onValueChange={(value) => {
              setFilterCourseId(value ?? "all")
              setFilterTeacherId("all")
            }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả môn học" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả môn học</SelectItem>
              {filterCourses.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{courseLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Giảng viên</Label>
          <Select value={filterTeacherId} onValueChange={(value) => setFilterTeacherId(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả giảng viên" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả giảng viên</SelectItem>
              <SelectItem value="none">Chưa phân công</SelectItem>
              {filterTeachers.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>{teacherLabel(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 md:self-end">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setFilterSemesterId("all")
              setFilterDepartmentId("all")
              setFilterCourseId("all")
              setFilterTeacherId("all")
            }}
          >
            Xóa lọc
          </Button>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu lớp học phần...</div>
        ) : (
          <DataTable columns={columns} data={filteredData} searchKey="section_code" searchPlaceholder="Tìm theo mã lớp..." />
        )}
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Thêm lớp học phần mới</DialogTitle>
              <DialogDescription>Nhập đầy đủ thông tin để tạo mới một lớp học phần.</DialogDescription>
            </DialogHeader>
            
            {submitError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive mt-4">
                {submitError}
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Mã lớp *</Label>
                  <Input name="section_code" placeholder="Ví dụ: COMP101.1" required />
                </div>
                <div className="space-y-1">
                  <Label>Học kỳ *</Label>
                  <Select name="semester_id" defaultValue={semesters[0]?.id ? String(semesters[0].id) : ""}>
                    <SelectTrigger><SelectValue placeholder="Chọn học kỳ" /></SelectTrigger>
                    <SelectContent>
                      {semesters.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{semesterLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Môn học *</Label>
                <Select value={activeCreateCourseId} onValueChange={(value) => setCreateCourseId(value ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Chọn môn học" /></SelectTrigger>
                  <SelectContent>
                    {createCourses.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{courseLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Khoa được lấy theo môn học{activeCreateDepartment ? `: ${activeCreateDepartment.name}` : ""}.
                </p>
              </div>

              <div className="space-y-1">
                <Label>Giảng viên phụ trách</Label>
                <Select name="teacher_id" defaultValue="none">
                    <SelectTrigger><SelectValue placeholder="Chưa phân công" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Chưa phân công</SelectItem>
                    {createTeachers.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{teacherLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <Label>Phòng</Label>
                  <Input name="room" placeholder="A101" />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>Sĩ số tối đa</Label>
                  <Input name="max_students" type="number" placeholder="40" min={1} />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>Lịch học</Label>
                  <Input name="schedule" placeholder="T2 3-5" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Hủy</Button>
              <Button type="submit">Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-[500px]">
          {editTarget && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Chỉnh sửa lớp học phần</DialogTitle>
                <DialogDescription>
                  Cập nhật phòng học, lịch giảng dạy hoặc phân công giảng viên cho lớp <strong>{editTarget.section_code}</strong>.
                </DialogDescription>
              </DialogHeader>

              {submitError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive mt-4">
                  {submitError}
                </div>
              )}

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="opacity-70">Mã lớp (Không đổi)</Label>
                    <Input value={editTarget.section_code} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="opacity-70">Học kỳ (Không đổi)</Label>
                    <Input value={editTarget.semesterName} disabled className="bg-muted" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="opacity-70">Môn học (Không đổi)</Label>
                  <Input value={`${editTarget.courseName} (${editTarget.courseCode})`} disabled className="bg-muted" />
                </div>

                <div className="space-y-1">
                  <Label>Giảng viên phụ trách</Label>
                  <Select name="teacher_id" defaultValue={editTarget.teacher_id ? String(editTarget.teacher_id) : "none"}>
                    <SelectTrigger><SelectValue placeholder="Chưa phân công" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Chưa phân công</SelectItem>
                      {editTeachers.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>{teacherLabel(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Phòng</Label>
                    <Input name="room" defaultValue={editTarget.room || ""} placeholder="A101" />
                  </div>
                  <div className="space-y-1">
                    <Label>Sĩ số tối đa</Label>
                    <Input name="max_students" type="number" defaultValue={editTarget.max_students || ""} placeholder="40" min={1} />
                  </div>
                  <div className="space-y-1">
                    <Label>Lịch học</Label>
                    <Input name="schedule" defaultValue={editTarget.schedule || ""} placeholder="T2 3-5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Trạng thái lớp</Label>
                  <Select name="is_active" defaultValue={String(editTarget.is_active)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Đang mở (Active)</SelectItem>
                      <SelectItem value="false">Đã khóa (Inactive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Hủy</Button>
                <Button type="submit">Lưu thay đổi</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Xác nhận xóa lớp học phần</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa lớp học phần <strong>{deleteTarget?.section_code}</strong>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
