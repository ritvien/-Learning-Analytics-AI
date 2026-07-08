"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import type { Course } from "@/types"
import { api, getCachedCurrentUser, type ApiHealthScore } from "@/lib/api"
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

type CourseWithHealth = Course & { health?: ApiHealthScore }

export default function CoursesPage() {
  const [courses, setCourses] = React.useState<CourseWithHealth[]>([])
  const [isLoadingHealth, setIsLoadingHealth] = React.useState(true)

  React.useEffect(() => {
    Promise.all([
      api.me(),
      api.getCourses({ limit: 500 }),
      api.getPrograms({ limit: 100 }),
      api.getDepartments({ limit: 100 })
    ]).then(([currentUser, apiCourses, programs, departments]) => {
      const progDeptMap = new Map<number, string>()
      const progDeptIdMap = new Map<number, number>()
      programs.forEach(p => {
        const d = departments.find(dept => dept.id === p.department_id)
        if (d) progDeptMap.set(p.id, d.name)
        progDeptIdMap.set(p.id, p.department_id)
      })
      const visibleCourses =
        currentUser?.role === "manager" && currentUser.department_id != null
          ? apiCourses.filter((course) => {
              if (course.department_id === currentUser.department_id) return true
              return course.program_ids.some((programId) => progDeptIdMap.get(programId) === currentUser.department_id)
            })
          : apiCourses

      const mapped: CourseWithHealth[] = visibleCourses.map((c) => {
        const deptName = c.department_id ? departments.find(d => d.id === c.department_id)?.name : null
        return {
          id: String(c.id),
          maHocPhan: c.code,
          tenMonHoc: c.name,
          tinChi: c.credits,
          khoaQuanLy: deptName || "Chưa phân khoa",
          moTa: c.description ?? "",
          trangThai: c.is_active ? "Đang giảng dạy" as const : "Ngừng giảng dạy" as const,
        }
      })
      setCourses(mapped)
      
      // Fetch health scores only for courses visible to the current role.
      api.getCourseHealthBatch(visibleCourses.map(c => c.id))
        .then(healthScores => {
          setCourses(prev => prev.map(course => {
            const h = healthScores.find(hs => String(hs.node_id) === course.id)
            return { ...course, health: h }
          }))
        })
        .finally(() => setIsLoadingHealth(false))
    })
  }, [])
  const [editCourse, setEditCourse] = React.useState<Course | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Course | null>(null)
  const [userRole] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const u = getCachedCurrentUser()
      return u ? u.role : null
    }
    return null
  })

  const hasWriteAccess = userRole === "superadmin" || userRole === "admin" || userRole === "manager"

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    api.createCourse({
      code: fd.get("maHocPhan") as string,
      name: fd.get("tenMonHoc") as string,
      credits: Number(fd.get("tinChi")),
      description: fd.get("moTa") as string || undefined,
      program_ids: [1],
    }).then((c) => {
      setCourses((prev) => [...prev, {
        id: String(c.id), maHocPhan: c.code, tenMonHoc: c.name,
        tinChi: c.credits, khoaQuanLy: "Khoa CNTT",
        moTa: c.description ?? "", trangThai: "Đang giảng dạy",
      }])
      setIsCreateOpen(false)
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editCourse) return
    const fd = new FormData(e.currentTarget)
    const trangThai = fd.get("trangThai") as Course["trangThai"]
    api.updateCourse(Number(editCourse.id), {
      name: fd.get("tenMonHoc") as string,
      credits: Number(fd.get("tinChi")),
      description: fd.get("moTa") as string || undefined,
      is_active: trangThai === "Đang giảng dạy",
    }).then(() => {
      setCourses(courses.map((c) =>
        c.id === editCourse.id
          ? { ...editCourse, tenMonHoc: fd.get("tenMonHoc") as string,
              tinChi: Number(fd.get("tinChi")), moTa: fd.get("moTa") as string, trangThai }
          : c
      ))
      setEditCourse(null)
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    api.deleteCourse(Number(deleteTarget.id)).then(() => {
      setCourses(courses.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
      setIsDeleteOpen(false)
    })
  }

  const columns: ColumnDef<CourseWithHealth>[] = [
    {
      accessorKey: "maHocPhan",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Mã HP <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "tenMonHoc",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Tên môn học <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue("tenMonHoc")}</span>,
    },
    { accessorKey: "tinChi", header: "TC" },
    { accessorKey: "khoaQuanLy", header: "Khoa" },
    {
      accessorKey: "trangThai",
      header: "Trạng thái",
      cell: ({ row }) => {
        const status = row.getValue("trangThai") as string
        return <Badge variant={status === "Đang giảng dạy" ? "default" : "secondary"}>{status}</Badge>
      },
    },
    {
      id: "health",
      header: "Sức khỏe",
      cell: ({ row }) => {
        const h = row.original.health
        if (!h) return <span className="text-muted-foreground text-xs italic">{isLoadingHealth ? "Đang tải..." : "N/A"}</span>
        const color = h.status === "Healthy" ? "bg-emerald-500" : h.status === "Warning" ? "bg-amber-500" : "bg-rose-500"
        const textColor = h.status === "Healthy" ? "text-emerald-700" : h.status === "Warning" ? "text-amber-700" : "text-rose-700"
        const borderColor = h.status === "Healthy" ? "border-emerald-200" : h.status === "Warning" ? "border-amber-200" : "border-rose-200"
        const bgColor = h.status === "Healthy" ? "bg-emerald-50" : h.status === "Warning" ? "bg-amber-50" : "bg-rose-50"
        
        return (
          <Badge variant="outline" className={`gap-1.5 pr-2.5 ${textColor} ${borderColor} ${bgColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
            {h.health_score} - {h.status}
          </Badge>
        )
      }
    },
    ...(hasWriteAccess ? [{
      id: "actions",
      header: "Thao tác",
      cell: ({ row }: { row: { original: CourseWithHealth } }) => {
        const course = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditCourse(course)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteTarget(course); setIsDeleteOpen(true) }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    } as ColumnDef<CourseWithHealth>] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between" data-tour="page-courses-actions">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Môn học</h1>
        </div>
        {hasWriteAccess && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" /> Thêm môn
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Thêm Môn học mới</DialogTitle>
                  <DialogDescription>Nhập thông tin học phần.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Mã HP</Label><Input name="maHocPhan" required /></div>
                    <div className="space-y-2"><Label>Tín chỉ</Label><Input name="tinChi" type="number" min={1} max={10} defaultValue={3} required /></div>
                  </div>
                  <div className="space-y-2"><Label>Tên môn học</Label><Input name="tenMonHoc" required /></div>
                  <div className="space-y-2"><Label>Khoa quản lý</Label><Input name="khoaQuanLy" required /></div>
                  <div className="space-y-2"><Label>Mô tả</Label><Input name="moTa" /></div>
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

      <div data-tour="page-courses-results">
        <DataTable columns={columns} data={courses} searchKey="tenMonHoc" searchPlaceholder="Tìm theo tên môn..." />
      </div>

      {/* EDIT Dialog */}
      <Dialog open={!!editCourse} onOpenChange={(open) => { if (!open) setEditCourse(null) }}>
        <DialogContent className="sm:max-w-[450px]">
          {editCourse && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Sửa môn — {editCourse.maHocPhan}</DialogTitle>
                <DialogDescription>{editCourse.tenMonHoc}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Tên môn học</Label><Input name="tenMonHoc" defaultValue={editCourse.tenMonHoc} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Tín chỉ</Label><Input name="tinChi" type="number" defaultValue={editCourse.tinChi} required /></div>
                  <div className="space-y-2">
                    <Label>Trạng thái</Label>
                    <Select name="trangThai" defaultValue={editCourse.trangThai}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Đang giảng dạy">Đang giảng dạy</SelectItem>
                        <SelectItem value="Ngừng giảng dạy">Ngừng giảng dạy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Khoa quản lý</Label><Input name="khoaQuanLy" defaultValue={editCourse.khoaQuanLy} /></div>
                <div className="space-y-2"><Label>Mô tả</Label><Input name="moTa" defaultValue={editCourse.moTa} /></div>
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
              Bạn có chắc chắn muốn xóa môn <strong>{deleteTarget?.tenMonHoc}</strong> ({deleteTarget?.maHocPhan})?
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

