"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const form = new FormData(event.currentTarget)
    try {
      await api.login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      })
      router.replace("/manager")
    } catch {
      setError("Email hoặc mật khẩu không đúng.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-2 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex aspect-square size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="size-6" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Đăng nhập hệ thống
            </CardTitle>
            <CardDescription>Nhập email tài khoản để tiếp tục</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="admin@example.com" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mật khẩu</Label>
                <a href="#" className="text-sm font-medium text-primary hover:underline">
                  Quên mật khẩu?
                </a>
              </div>
              <Input id="password" name="password" type="password" required />
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
