"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function ForbiddenPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md border-destructive/20 shadow-lg backdrop-blur-sm bg-card/90">
        <CardHeader className="space-y-2 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex aspect-square size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive animate-bounce">
              <ShieldAlert className="size-10" />
            </div>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-destructive">
            403 - KHÔNG CÓ QUYỀN TRUY CẬP
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground mt-2">
            Tài khoản của bạn không được phân quyền để xem trang này.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground px-6 py-2">
          Vui lòng liên hệ với Quản trị hệ thống (Super Admin / Admin) nếu bạn tin rằng đây là một sự nhầm lẫn hoặc cần nâng cấp quyền truy cập của mình.
        </CardContent>
        <CardFooter className="flex justify-center pt-4">
          <Button onClick={() => router.replace("/manager")} className="w-full sm:w-auto px-8 py-2 font-medium">
            Quay lại Trang chủ
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
