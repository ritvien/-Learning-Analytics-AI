"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { api, type ApiUserRole } from "@/lib/api"

const DASHBOARD_ROUTES = [
  "/manager",
  "/manager/analytics",
  "/manager/analytics/departments",
  "/manager/analytics/programs",
  "/manager/analytics/courses",
  "/manager/analytics/sections",
  "/manager/analytics/students",
  "/manager/students",
  "/manager/teachers",
  "/manager/courses",
  "/manager/grades",
  "/manager/departments",
  "/manager/reports",
  "/manager/programs",
  "/manager/users",
  "/chat",
]

function runWhenIdle(callback: () => void) {
  if (typeof window === "undefined") return
  const requestIdle = window.requestIdleCallback
  if (requestIdle) {
    requestIdle(callback, { timeout: 2500 })
    return
  }
  globalThis.setTimeout(callback, 800)
}

function wait(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export function DashboardPreloader({ userRole }: { userRole?: ApiUserRole | null }) {
  const router = useRouter()
  const didRun = React.useRef(false)

  React.useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    runWhenIdle(() => {
      for (const route of DASHBOARD_ROUTES) {
        if (route === "/manager/users" && userRole !== "superadmin" && userRole !== "admin") continue
        router.prefetch(route)
      }

      const tasks: Array<() => Promise<unknown>> = [
        () => api.getTree(),
        () => api.getDashboardOverview(),
        () => api.getDashboardDepartments(),
        async () => {
          const programs = await api.getPrograms({ limit: 100 })
          const firstProgramId = programs[0]?.id
          return firstProgramId ? api.getDashboardProgram(firstProgramId) : undefined
        },
        () => api.getStudents({ limit: 500 }),
        () => api.getPrograms({ limit: 100 }),
        () => api.getDepartments({ limit: 100 }),
        () => api.getTeachers({ limit: 1000 }),
        async () => {
          const courses = await api.getCourses({ limit: 500 })
          void api.getCourseHealthBatch(courses.map((course) => course.id)).catch(() => undefined)
          return courses
        },
        () => api.getSemesters(),
        () => api.getReports({ limit: 80 }),
        () => api.getReportSchedules({ limit: 80 }),
        () => api.getSections({ limit: 5000 }),
        () => api.getStudents({ limit: 1000 }),
        () => api.getCourses({ limit: 1000 }),
        () => api.getEnrollments({ limit: 5000 }),
        () => api.getGradeComponents({ limit: 10000 }),
        () => api.getEnrollments({ limit: 50000 }),
      ]

      if (userRole === "superadmin" || userRole === "admin") {
        tasks.splice(11, 0, () => api.getUsers({ limit: 500 }))
      }

      void (async () => {
        for (const task of tasks) {
          try {
            await task()
          } catch {
            // Background preload must never block the current page.
          }
          await wait(120)
        }
      })()
    })
  }, [router, userRole])

  return null
}
