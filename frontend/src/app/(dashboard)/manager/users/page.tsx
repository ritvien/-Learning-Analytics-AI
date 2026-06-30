"use client"

import * as React from "react"
import Link from "next/link"
import { GraduationCap, Lock, Pencil, Plus, ShieldCheck, Unlock, Users } from "lucide-react"

import { api, type ApiTeacher, type ApiUser, type ApiUserRole } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const roles: ApiUserRole[] = ["superadmin", "admin", "manager", "lecturer", "viewer"]
const accountManagedRoles: ApiUserRole[] = ["superadmin", "admin", "manager", "viewer"]
const minPasswordLength = 8

const roleLabels: Record<ApiUserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  lecturer: "Lecturer",
  viewer: "Viewer",
}

function canManageUsers(user: ApiUser | null) {
  return user?.role === "superadmin" || user?.role === "admin"
}

function roleDescription(role: ApiUserRole) {
  switch (role) {
    case "superadmin":
    case "admin":
      return "Quản trị tài khoản, phân quyền và toàn quyền CRUD dữ liệu học vụ."
    case "manager":
      return "CRUD dữ liệu học vụ, không quản trị tài khoản."
    case "lecturer":
      return "Tài khoản giảng viên, được cấp từ hồ sơ Teacher."
    case "viewer":
      return "Chỉ xem dữ liệu, không tạo/sửa/xóa."
  }
}

function userErrorMessage(err: unknown, fallback: string) {
  if (!(err instanceof Error)) return fallback
  if (err.message.includes("Create lecturer accounts from the teacher profile")) {
    return "Tài khoản lecturer phải được cấp từ trang Giảng viên."
  }
  if (err.message.includes("Teacher-linked accounts must keep lecturer role")) {
    return "Tài khoản đã liên kết hồ sơ giảng viên phải giữ role Lecturer."
  }
  if (err.message.includes("Assign lecturer role from the teacher profile")) {
    return "Muốn cấp role Lecturer, hãy tạo/cấp tài khoản trong trang Giảng viên."
  }
  if (err.message.includes("Only superadmin can")) {
    return "Chỉ Super Admin được tạo hoặc thay đổi tài khoản Super Admin."
  }
  if (err.message.includes("Email already exists")) {
    return "Email này đã tồn tại."
  }
  if (err.message.includes("Insufficient permissions")) {
    return "Tài khoản hiện tại không có quyền tạo tài khoản. Vui lòng đăng nhập bằng Admin hoặc Super Admin."
  }
  return err.message || fallback
}

export default function UsersPage() {
  const [currentUser, setCurrentUser] = React.useState<ApiUser | null>(null)
  const [users, setUsers] = React.useState<ApiUser[]>([])
  const [teachers, setTeachers] = React.useState<ApiTeacher[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [createError, setCreateError] = React.useState("")
  const [passwordError, setPasswordError] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [editUser, setEditUser] = React.useState<ApiUser | null>(null)

  const refreshUsers = React.useCallback(async () => {
    setError("")
    const [me, list, teacherList] = await Promise.all([
      api.me(),
      api.getUsers({ limit: 500 }),
      api.getTeachers({ limit: 1000 }),
    ])
    setCurrentUser(me)
    setUsers(list)
    setTeachers(teacherList)
  }, [])

  React.useEffect(() => {
    setTimeout(() => {
      refreshUsers()
        .catch(() => setError("Bạn không có quyền quản trị tài khoản."))
        .finally(() => setIsLoading(false))
    }, 0)
  }, [refreshUsers])

  const teacherByUserId = React.useMemo(() => {
    const map = new Map<string, ApiTeacher>()
    for (const teacher of teachers) {
      if (teacher.user_id) map.set(teacher.user_id, teacher)
    }
    return map
  }, [teachers])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password.length < minPasswordLength) {
      setPasswordError(`Mật khẩu phải có ít nhất ${minPasswordLength} ký tự.`)
      return
    }
    setPasswordError("")
    setCreateError("")
    try {
      await api.createUser({
        email: String(form.get("email") ?? ""),
        password,
        full_name: String(form.get("full_name") ?? ""),
        role: String(form.get("role") ?? "viewer") as ApiUserRole,
      })
      setIsCreateOpen(false)
      await refreshUsers()
    } catch (err) {
      setCreateError(userErrorMessage(err, "Không tạo được tài khoản."))
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editUser) return
    const linkedTeacher = teacherByUserId.get(editUser.id)
    const form = new FormData(event.currentTarget)
    try {
      await api.updateUser(editUser.id, {
        full_name: String(form.get("full_name") ?? ""),
        role: linkedTeacher ? "lecturer" : String(form.get("role") ?? editUser.role) as ApiUserRole,
        is_active: String(form.get("is_active") ?? "true") === "true",
      })
      setEditUser(null)
      await refreshUsers()
    } catch (err) {
      setError(userErrorMessage(err, "Không cập nhật được tài khoản."))
    }
  }

  async function toggleActive(user: ApiUser) {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active })
      await refreshUsers()
    } catch (err) {
      setError(userErrorMessage(err, "Không đổi được trạng thái tài khoản."))
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Đang tải tài khoản...</div>
  }

  if (!canManageUsers(currentUser)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" />
            Không có quyền truy cập
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Chỉ admin và superadmin được cấp tài khoản, đổi role, khóa hoặc mở tài khoản.
        </CardContent>
      </Card>
    )
  }

  const counts = roles.map((role) => ({
    role,
    count: users.filter((user) => user.role === role).length,
  }))
  const linkedLecturerCount = users.filter((user) => teacherByUserId.has(user.id)).length
  const unlinkedLecturerCount = users.filter((user) => user.role === "lecturer" && !teacherByUserId.has(user.id)).length
  const assignableRoles = currentUser?.role === "superadmin"
    ? accountManagedRoles
    : accountManagedRoles.filter((role) => role !== "superadmin")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tài khoản & phân quyền</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý tài khoản hệ thống. Tài khoản Lecturer được cấp từ hồ sơ giảng viên để giữ liên kết lớp học phần.
          </p>
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) {
              setCreateError("")
              setPasswordError("")
            }
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo tài khoản
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Tạo tài khoản mới</DialogTitle>
                <DialogDescription>
                  Role Lecturer không tạo ở đây; hãy dùng trang Giảng viên để cấp tài khoản gắn với hồ sơ giảng viên.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Họ tên</Label>
                  <Input id="full_name" name="full_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby="create-password-help"
                    onChange={() => { if (passwordError) setPasswordError("") }}
                  />
                  <p
                    id="create-password-help"
                    className={passwordError ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}
                    role={passwordError ? "alert" : undefined}
                  >
                    {passwordError || `Tối thiểu ${minPasswordLength} ký tự.`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select name="role" defaultValue="viewer">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {createError ? <p className="pb-4 text-sm font-medium text-destructive" role="alert">{createError}</p> : null}
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                <Button type="submit">Tạo</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-5">
        {counts.map((item) => (
          <Card key={item.role}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{roleLabels[item.role]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.count}</div>
              <p className="mt-1 text-xs text-muted-foreground">{roleDescription(item.role)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Lecturer thuộc trang Giảng viên</div>
              <p className="text-sm text-muted-foreground">
                {linkedLecturerCount} tài khoản lecturer đã liên kết hồ sơ giảng viên
                {unlinkedLecturerCount > 0 ? `, ${unlinkedLecturerCount} lecturer chưa liên kết cần rà soát.` : "."}
              </p>
            </div>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/manager/teachers" />}>
            Mở trang Giảng viên
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Danh sách tài khoản
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Người dùng</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Nguồn quản lý</th>
                <th className="px-4 py-3 font-medium">Quyền</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => {
                const linkedTeacher = teacherByUserId.get(user.id)
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === "viewer" || user.role === "lecturer" ? "secondary" : "default"}>
                        {roleLabels[user.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {linkedTeacher ? (
                        <div>
                          <Badge variant="outline">Hồ sơ giảng viên</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">{linkedTeacher.full_name}</div>
                        </div>
                      ) : user.role === "lecturer" ? (
                        <Badge variant="destructive">Lecturer chưa liên kết</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tài khoản hệ thống</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{roleDescription(user.role)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? "secondary" : "destructive"}>
                        {user.is_active ? "Đang hoạt động" : "Đã khóa"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditUser(user)}
                          disabled={user.role === "superadmin" && currentUser?.role !== "superadmin"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleActive(user)}
                          disabled={
                            user.id === currentUser?.id
                            || (user.role === "superadmin" && currentUser?.role !== "superadmin")
                          }
                        >
                          {user.is_active ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent>
          {editUser ? (
            <form onSubmit={handleUpdate}>
              {(() => {
                const linkedTeacher = teacherByUserId.get(editUser.id)
                const editableRoleDefault = accountManagedRoles.includes(editUser.role) ? editUser.role : "viewer"
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle>Sửa tài khoản</DialogTitle>
                      <DialogDescription>{editUser.email}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {linkedTeacher ? (
                        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          Tài khoản này thuộc hồ sơ giảng viên {linkedTeacher.full_name}; role luôn là Lecturer.
                        </div>
                      ) : editUser.role === "lecturer" ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          Lecturer này chưa liên kết hồ sơ giảng viên. Hãy chuyển sang role hệ thống hoặc cấp lại từ trang Giảng viên.
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <Label>Họ tên</Label>
                        <Input name="full_name" defaultValue={editUser.full_name} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        {linkedTeacher ? (
                          <>
                            <Input value={roleLabels.lecturer} disabled />
                            <input type="hidden" name="role" value="lecturer" />
                          </>
                        ) : (
                          <Select name="role" defaultValue={editableRoleDefault}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map((role) => (
                                <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Trạng thái</Label>
                        <Select name="is_active" defaultValue={String(editUser.is_active)} disabled={editUser.id === currentUser?.id}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Đang hoạt động</SelectItem>
                            <SelectItem value="false">Đã khóa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Hủy</DialogClose>
                      <Button type="submit">Lưu</Button>
                    </DialogFooter>
                  </>
                )
              })()}
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
