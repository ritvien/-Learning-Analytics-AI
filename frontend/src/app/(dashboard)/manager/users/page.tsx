"use client"

import * as React from "react"
import { Lock, Pencil, Plus, ShieldCheck, Unlock, Users } from "lucide-react"

import { api, type ApiUser, type ApiUserRole } from "@/lib/api"
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
    case "viewer":
      return "Chỉ xem dữ liệu, không tạo/sửa/xóa."
  }
}

export default function UsersPage() {
  const [currentUser, setCurrentUser] = React.useState<ApiUser | null>(null)
  const [users, setUsers] = React.useState<ApiUser[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [editUser, setEditUser] = React.useState<ApiUser | null>(null)

  const refreshUsers = React.useCallback(async () => {
    setError("")
    const [me, list] = await Promise.all([api.me(), api.getUsers({ limit: 500 })])
    setCurrentUser(me)
    setUsers(list)
  }, [])

  React.useEffect(() => {
    refreshUsers()
      .catch(() => setError("Bạn không có quyền quản trị tài khoản."))
      .finally(() => setIsLoading(false))
  }, [refreshUsers])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await api.createUser({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      full_name: String(form.get("full_name") ?? ""),
      role: String(form.get("role") ?? "viewer") as ApiUserRole,
    })
    setIsCreateOpen(false)
    await refreshUsers()
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editUser) return
    const form = new FormData(event.currentTarget)
    await api.updateUser(editUser.id, {
      full_name: String(form.get("full_name") ?? ""),
      role: String(form.get("role") ?? editUser.role) as ApiUserRole,
      is_active: String(form.get("is_active") ?? "true") === "true",
    })
    setEditUser(null)
    await refreshUsers()
  }

  async function toggleActive(user: ApiUser) {
    await api.updateUser(user.id, { is_active: !user.is_active })
    await refreshUsers()
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tài khoản & phân quyền</h1>
          <p className="text-sm text-muted-foreground">Cấp tài khoản, đổi role, khóa hoặc mở quyền truy cập.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo tài khoản
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Tạo tài khoản mới</DialogTitle>
                <DialogDescription>Chọn role đúng với phạm vi thao tác của người dùng.</DialogDescription>
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
                  <Input id="password" name="password" type="password" minLength={8} required />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select name="role" defaultValue="viewer">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Danh sách tài khoản
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Người dùng</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Quyền</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
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
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditUser(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleActive(user)}
                        disabled={user.id === currentUser?.id}
                      >
                        {user.is_active ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent>
          {editUser ? (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Sửa tài khoản</DialogTitle>
                <DialogDescription>{editUser.email}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Họ tên</Label>
                  <Input name="full_name" defaultValue={editUser.full_name} required />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select name="role" defaultValue={editUser.role}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
