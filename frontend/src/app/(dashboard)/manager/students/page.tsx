"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Student } from "@/types"
import { api, getCachedCurrentUser, type ApiDepartment, type ApiProgram, type ApiCohort } from "@/lib/api"
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
import { Plus, Pencil, Trash2, ArrowUpDown, Users } from "lucide-react"

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

type StudentRow = Student & {
  programId: number
  departmentId: number | null
  cohortId: number
}

export default function StudentsPage() {
  const [students, setStudents] = React.useState<StudentRow[]>([])
  const [departments, setDepartments] = React.useState<ApiDepartment[]>([])
  const [programs, setPrograms] = React.useState<ApiProgram[]>([])
  const [cohorts, setCohorts] = React.useState<ApiCohort[]>([])
  const [departmentFilter, setDepartmentFilter] = React.useState("all")
  const [programFilter, setProgramFilter] = React.useState("all")
  const [cohortFilter, setCohortFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [userRole] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const u = getCachedCurrentUser()
      return u ? u.role : null
    }
    return null
  })

  const hasWriteAccess = userRole === "superadmin" || userRole === "admin" || userRole === "manager"

  React.useEffect(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([
      api.getStudents({ limit: 5000 }),
      api.getDepartments({ limit: 100 }),
      api.getPrograms({ limit: 1000 }),
      api.getCohorts({ limit: 100 }),
    ]).then(
      ([apiStudents, apiDepartments, apiPrograms, apiCohorts]) => {
        setDepartments(apiDepartments)
        setPrograms(apiPrograms)
        setCohorts(apiCohorts)
        const progMap = new Map(apiPrograms.map((p) => [p.id, p]))
        const deptMap = new Map(apiDepartments.map((d) => [d.id, d.name]))
        const cohortMap = new Map(apiCohorts.map((c) => [c.id, c.code]))
        setStudents(
          apiStudents.map((s) => {
            const program = progMap.get(s.program_id)
            const departmentName = program ? deptMap.get(program.department_id) : undefined
            return {
              id: String(s.id),
              mssv: s.student_code,
              hoTen: s.full_name,
              gioiTinh: (s.gender as Student["gioiTinh"]) ?? "Nam",
              ngayVaoTruong: "",
              khoa: cohortMap.get(s.cohort_id) ?? "",
              bacDaoTao: "Đại học - Tín chỉ",
              loaiHinh: "Chính quy",
              nganh: program?.name ?? "",
              chuyenNganh: "",
              khoaQuanLy: departmentName ?? "",
              lop: s.class_code ?? "",
              trangThai: STATUS_VI[s.status] ?? "Đang học",
              coVanHocTap: "",
              soDienThoaiCVHT: "",
              tongTCTichLuy: 0,
              diemTBTichLuy: s.gpa_cumulative ?? 0,
              tongTCNo: 0,
              soMonNo: 0,
              programId: s.program_id,
              departmentId: program?.department_id ?? null,
              cohortId: s.cohort_id,
            }
          })
        )
      }
    ).catch((err) => {
      setError(err instanceof Error ? err.message : "Không tải được danh sách sinh viên")
    }).finally(() => setIsLoading(false))
  }, [])
  const [editStudent, setEditStudent] = React.useState<StudentRow | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<StudentRow | null>(null)

  const STATUS_EN: Record<string, string> = {
    "Đang học": "active", "Đã tốt nghiệp": "graduated",
    "Bảo lưu": "withdrawn", "Thôi học": "expelled",
  }

  const filteredPrograms = React.useMemo(() => {
    return programs.filter((program) => departmentFilter === "all" || String(program.department_id) === departmentFilter)
  }, [programs, departmentFilter])

  React.useEffect(() => {
    if (programFilter === "all") return
    const selected = programs.find((program) => String(program.id) === programFilter)
    if (selected && departmentFilter !== "all" && String(selected.department_id) !== departmentFilter) {
      setProgramFilter("all")
    }
  }, [departmentFilter, programFilter, programs])

  const filteredStudents = React.useMemo(() => {
    return students.filter((student) => {
      if (departmentFilter !== "all" && String(student.departmentId) !== departmentFilter) return false
      if (programFilter !== "all" && String(student.programId) !== programFilter) return false
      if (cohortFilter !== "all" && String(student.cohortId) !== cohortFilter) return false
      if (statusFilter !== "all" && student.trangThai !== statusFilter) return false
      return true
    })
  }, [students, departmentFilter, programFilter, cohortFilter, statusFilter])

  const summary = React.useMemo(() => {
    const active = students.filter((student) => student.trangThai === "Đang học").length
    const lowGpa = students.filter((student) => student.diemTBTichLuy < 2).length
    const classCount = new Set(students.map((student) => student.lop).filter(Boolean)).size
    return { active, lowGpa, classCount }
  }, [students])

  // CREATE
  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const progId = Number(fd.get("program_id"))
    const cohId = Number(fd.get("cohort_id"))
    api.createStudent({
      student_code: fd.get("mssv") as string,
      full_name: fd.get("hoTen") as string,
      program_id: progId,
      cohort_id: cohId,
      gender: fd.get("gioiTinh") as string,
      class_code: fd.get("lop") as string,
      status: "active",
    }).then((s) => {
      const program = programs.find(p => p.id === s.program_id)
      const departmentName = departments.find(d => d.id === program?.department_id)?.name ?? ""
      const cohortCode = cohorts.find(c => c.id === s.cohort_id)?.code ?? ""
      setStudents((prev) => [
        ...prev,
        {
          id: String(s.id),
          mssv: s.student_code,
          hoTen: s.full_name,
          gioiTinh: (s.gender as Student["gioiTinh"]) ?? "Nam",
          ngayVaoTruong: "",
          khoa: cohortCode,
          bacDaoTao: "Đại học - Tín chỉ",
          loaiHinh: "Chính quy",
          nganh: program?.name ?? "",
          chuyenNganh: "",
          khoaQuanLy: departmentName,
          lop: s.class_code ?? "",
          trangThai: STATUS_VI[s.status] ?? "Đang học",
          coVanHocTap: "",
          soDienThoaiCVHT: "",
          tongTCTichLuy: 0,
          diemTBTichLuy: s.gpa_cumulative ?? 0,
          tongTCNo: 0,
          soMonNo: 0,
          programId: s.program_id,
          departmentId: program?.department_id ?? null,
          cohortId: s.cohort_id,
        },
      ])
      setIsCreateOpen(false)
    }).catch(err => {
      alert("Lỗi khi thêm sinh viên: " + (err.message || err))
    })
  }

  // UPDATE
  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editStudent) return
    const fd = new FormData(e.currentTarget)
    const status_vi = fd.get("trangThai") as string
    const status_en = STATUS_EN[status_vi] || "active"
    api.updateStudent(Number(editStudent.id), {
      full_name: fd.get("hoTen") as string,
      gender: fd.get("gioiTinh") as string,
      class_code: fd.get("lop") as string,
      status: status_en,
    }).then((updated) => {
      setStudents(students.map((s) =>
        s.id === editStudent.id
          ? {
              ...s,
              hoTen: updated.full_name,
              gioiTinh: (updated.gender as Student["gioiTinh"]) ?? "Nam",
              lop: updated.class_code ?? "",
              trangThai: STATUS_VI[updated.status] ?? "Đang học",
            }
          : s
      ))
      setEditStudent(null)
    }).catch(err => {
      alert("Lỗi khi cập nhật sinh viên: " + (err.message || err))
    })
  }

  // DELETE
  const handleDelete = () => {
    if (!deleteTarget) return
    api.deleteStudent(Number(deleteTarget.id)).then(() => {
      setStudents(students.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
      setIsDeleteOpen(false)
    }).catch(err => {
      alert("Lỗi khi xóa sinh viên: " + (err.message || err))
    })
  }

  const columns: ColumnDef<StudentRow>[] = [
    {
      accessorKey: "hoTen",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Sinh viên <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[220px]">
          <div className="font-medium">{row.original.hoTen}</div>
          <div className="text-xs text-muted-foreground">{row.original.mssv} · {row.original.gioiTinh}</div>
        </div>
      ),
    },
    {
      accessorKey: "lop",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Lớp / khóa <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.lop || "Chưa có lớp"}</div>
          <div className="text-xs text-muted-foreground">{row.original.khoa || "Chưa có khóa"}</div>
        </div>
      ),
    },
    {
      accessorKey: "khoaQuanLy",
      header: "Khoa / ngành",
      cell: ({ row }) => (
        <div className="max-w-[300px]">
          <div className="truncate font-medium" title={row.original.khoaQuanLy}>{row.original.khoaQuanLy || "Chưa rõ khoa"}</div>
          <div className="truncate text-xs text-muted-foreground" title={row.original.nganh}>{row.original.nganh || "Chưa rõ ngành"}</div>
        </div>
      ),
    },
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
    } as ColumnDef<StudentRow>] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Sinh viên</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Đang tải dữ liệu..." : `${filteredStudents.length} / ${students.length} sinh viên`}
          </p>
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
                    <div className="space-y-2">
                      <Label>Khóa</Label>
                      <Select name="cohort_id" required>
                        <SelectTrigger><SelectValue placeholder="Chọn khóa..." /></SelectTrigger>
                        <SelectContent>
                          {cohorts.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.code} ({c.year_start}{c.year_end ? `-${c.year_end}` : ""})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ngành</Label>
                      <Select name="program_id" required>
                        <SelectTrigger><SelectValue placeholder="Chọn ngành..." /></SelectTrigger>
                        <SelectContent>
                          {programs.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.code} - {p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label htmlFor="lop">Lớp</Label><Input id="lop" name="lop" required /></div>
                  </div>
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

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Tổng</div>
          <div className="mt-1 text-2xl font-semibold">{students.length}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Đang học</div>
          <div className="mt-1 text-2xl font-semibold">{summary.active}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">Lớp hành chính</div>
          <div className="mt-1 text-2xl font-semibold">{summary.classCount}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm text-muted-foreground">GPA dưới 2.0</div>
          <div className="mt-1 text-2xl font-semibold">{summary.lowGpa}</div>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 md:grid-cols-5 md:items-end">
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
          <Label className="text-xs font-semibold">Ngành</Label>
          <Select value={programFilter} onValueChange={(value) => setProgramFilter(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả ngành" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ngành</SelectItem>
              {filteredPrograms.map((program) => (
                <SelectItem key={program.id} value={String(program.id)}>
                  {program.code} - {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Khóa</Label>
          <Select value={cohortFilter} onValueChange={(value) => setCohortFilter(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả khóa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả khóa</SelectItem>
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={String(cohort.id)}>
                  {cohort.code} ({cohort.year_start}{cohort.year_end ? `-${cohort.year_end}` : ""})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Trạng thái</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="Đang học">Đang học</SelectItem>
              <SelectItem value="Đã tốt nghiệp">Đã tốt nghiệp</SelectItem>
              <SelectItem value="Bảo lưu">Bảo lưu</SelectItem>
              <SelectItem value="Thôi học">Thôi học</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDepartmentFilter("all")
            setProgramFilter("all")
            setCohortFilter("all")
            setStatusFilter("all")
          }}
        >
          Xóa lọc
        </Button>
      </div>

      <DataTable columns={columns} data={filteredStudents} searchKey="hoTen" searchPlaceholder="Tìm theo tên sinh viên..." />

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
                  <div className="space-y-2"><Label>Ngành</Label><Input name="nganh" defaultValue={editStudent.nganh} disabled /></div>
                  <div className="space-y-2"><Label>Lớp</Label><Input name="lop" defaultValue={editStudent.lop} required /></div>
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

