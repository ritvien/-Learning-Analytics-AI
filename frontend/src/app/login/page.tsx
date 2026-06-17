"use client"

import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex aspect-square size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Đăng nhập hệ thống
          </CardTitle>
          <CardDescription>
            Nhập email hoặc MSSV để tiếp tục
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email / MSSV</Label>
            <Input id="email" placeholder="Ví dụ: 22810340001" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mật khẩu</Label>
              <a href="#" className="text-sm font-medium text-primary hover:underline">
                Quên mật khẩu?
              </a>
            </div>
            <Input id="password" type="password" required />
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/manager" className={buttonVariants({ className: "w-full" })}>
            Đăng nhập
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
