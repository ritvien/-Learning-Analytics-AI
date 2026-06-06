"use client"

import * as React from "react"
import type { Department, Major } from "@/types"
import { mockDepartments } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Building2 } from "lucide-react"

export default function DepartmentsPage() {
  const [departments, setDepartments] = React.useState<Department[]>(mockDepartments)
  const [expandedDepts, setExpandedDepts] = React.useState<Set<string>>(new Set(["dept-1"]))
  const [isCreateDeptOpen, setIsCreateDeptOpen] = React.useState(false)
  const [isCreateMajorOpen, setIsCreateMajorOpen] = React.useState(false)
  const [createMajorParent, setCreateMajorParent] = React.useState<string | null>(null)
  const [editDept, setEditDept] = React.useState<Department | null>(null)
  const [editMajor, setEditMajor] = React.useState<Major | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // CREATE Department
  const handleCreateDept = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      tenKhoa: fd.get("tenKhoa") as string,
      moTa: fd.get("moTa") as string,
      nganhs: [],
    }
    setDepartments([...departments, newDept])
    setIsCreateDeptOpen(false)
  }

  // CREATE Major
  const handleCreateMajor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!createMajorParent) return
    const fd = new FormData(e.currentTarget)
    const newMajor: Major = {
      id: `major-${Date.now()}`,
      tenNganh: fd.get("tenNganh") as string,
      khoaId: createMajorParent,
      moTa: fd.get("moTa") as string,
    }
    setDepartments(departments.map((d) =>
      d.id === createMajorParent ? { ...d, nganhs: [...d.nganhs, newMajor] } : d
    ))
    setIsCreateMajorOpen(false)
    setCreateMajorParent(null)
  }

  // UPDATE Department
  const handleUpdateDept = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editDept) return
    const fd = new FormData(e.currentTarget)
    setDepartments(departments.map((d) =>
      d.id === editDept.id
        ? { ...d, tenKhoa: fd.get("tenKhoa") as string, moTa: fd.get("moTa") as string }
        : d
    ))
    setEditDept(null)
  }

  // DELETE Department
  const deleteDept = (id: string) => {
    setDepartments(departments.filter((d) => d.id !== id))
  }

  // DELETE Major
  const deleteMajor = (deptId: string, majorId: string) => {
    setDepartments(departments.map((d) =>
      d.id === deptId ? { ...d, nganhs: d.nganhs.filter((m) => m.id !== majorId) } : d
    ))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Khoa & Ngành</h1>
          <p className="text-muted-foreground">Tổ chức cấu trúc Khoa - Ngành đào tạo.</p>
        </div>
        <Dialog open={isCreateDeptOpen} onOpenChange={setIsCreateDeptOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Thêm Khoa
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <form onSubmit={handleCreateDept}>
              <DialogHeader>
                <DialogTitle>Thêm Khoa mới</DialogTitle>
                <DialogDescription>Nhập tên và mô tả.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Tên Khoa</Label><Input name="tenKhoa" required /></div>
                <div className="space-y-2"><Label>Mô tả</Label><Input name="moTa" /></div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Tạo mới</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {departments.map((dept) => (
          <Card key={dept.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(dept.id)}>
                  {expandedDepts.has(dept.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{dept.tenKhoa}</CardTitle>
                  <Badge variant="secondary" className="ml-2">{dept.nganhs.length} ngành</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => { setCreateMajorParent(dept.id); setIsCreateMajorOpen(true) }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditDept(dept)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteDept(dept.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {dept.moTa && <p className="text-sm text-muted-foreground ml-11">{dept.moTa}</p>}
            </CardHeader>
            {expandedDepts.has(dept.id) && dept.nganhs.length > 0 && (
              <CardContent className="pt-0">
                <div className="ml-11 space-y-2">
                  {dept.nganhs.map((major) => (
                    <div key={major.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <span className="font-medium">{major.tenNganh}</span>
                        {major.moTa && <p className="text-xs text-muted-foreground">{major.moTa}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => setEditMajor(major)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => deleteMajor(dept.id, major.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Create Major Dialog */}
      <Dialog open={isCreateMajorOpen} onOpenChange={setIsCreateMajorOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleCreateMajor}>
            <DialogHeader>
              <DialogTitle>Thêm Ngành</DialogTitle>
              <DialogDescription>Thêm ngành đào tạo mới.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Tên Ngành</Label><Input name="tenNganh" required /></div>
              <div className="space-y-2"><Label>Mô tả</Label><Input name="moTa" /></div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
              <Button type="submit">Tạo mới</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dept Dialog */}
      <Dialog open={!!editDept} onOpenChange={(open) => { if (!open) setEditDept(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          {editDept && (
            <form onSubmit={handleUpdateDept}>
              <DialogHeader>
                <DialogTitle>Sửa Khoa</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Tên Khoa</Label><Input name="tenKhoa" defaultValue={editDept.tenKhoa} required /></div>
                <div className="space-y-2"><Label>Mô tả</Label><Input name="moTa" defaultValue={editDept.moTa} /></div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Lưu</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Major Dialog */}
      <Dialog open={!!editMajor} onOpenChange={(open) => { if (!open) setEditMajor(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          {editMajor && (
            <form onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              setDepartments(departments.map((d) => ({
                ...d,
                nganhs: d.nganhs.map((m) =>
                  m.id === editMajor.id
                    ? { ...m, tenNganh: fd.get("tenNganh") as string, moTa: fd.get("moTa") as string }
                    : m
                ),
              })))
              setEditMajor(null)
            }}>
              <DialogHeader>
                <DialogTitle>Sửa Ngành</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Tên Ngành</Label><Input name="tenNganh" defaultValue={editMajor.tenNganh} required /></div>
                <div className="space-y-2"><Label>Mô tả</Label><Input name="moTa" defaultValue={editMajor.moTa} /></div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Lưu</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

