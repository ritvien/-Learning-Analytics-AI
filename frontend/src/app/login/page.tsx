"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap, Loader2, AlertCircle } from "lucide-react"
import { api } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await api.login(email.trim(), password)

      // Store token in localStorage
      localStorage.setItem("access_token", result.access_token)
      localStorage.setItem("token_type", result.token_type)

      // Redirect to dashboard
      router.push("/manager")
    } catch (err: any) {
      // Check for common error cases
      if (err.message?.includes("401")) {
        setError("Email hoặc mật khẩu không chính xác.")
      } else if (err.message?.includes("422")) {
        setError("Vui lòng nhập đầy đủ thông tin đăng nhập.")
      } else if (err.message?.includes("fetch") || err.message?.includes("Failed")) {
        // Auth backend not available, allow bypass for development
        console.warn("Auth backend not available, bypassing login for dev mode.")
        localStorage.setItem("access_token", "dev-bypass-token")
        localStorage.setItem("token_type", "bearer")
        router.push("/manager")
      } else {
        setError(`Lỗi hệ thống: ${err.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

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
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email / MSSV</Label>
              <Input
                id="email"
                placeholder="Ví dụ: admin@epu.edu.vn"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mật khẩu</Label>
                <a href="#" className="text-sm font-medium text-primary hover:underline">
                  Quên mật khẩu?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
