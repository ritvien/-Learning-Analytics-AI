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

function isManagementRole(role?: ApiUserRole | null) {
  return role === "superadmin" || role === "admin" || role === "manager"
}

function isReadRole(role?: ApiUserRole | null) {
  return isManagementRole(role) || role === "lecturer" || role === "viewer"
}

function canPrefetchRoute(route: string, role?: ApiUserRole | null) {
  if (route === "/chat") return true
  if (route === "/manager/users") return role === "superadmin" || role === "admin"
  if (route === "/manager/programs") return isManagementRole(role)
  if (route === "/manager/analytics/departments") return isManagementRole(role) || role === "lecturer"
  if (route === "/manager/analytics/programs") return isManagementRole(role) || role === "lecturer"
  if (route === "/manager/analytics/courses") return isManagementRole(role) || role === "lecturer"
  if (route === "/manager/analytics/sections") return isManagementRole(role) || role === "lecturer"
  if (route === "/manager/analytics/students") return isManagementRole(role) || role === "lecturer"
  if (route.startsWith("/manager/analytics")) return isManagementRole(role)
  if (route === "/manager") return isReadRole(role)
  if (["/manager/teachers", "/manager/departments"].includes(route)) {
    return isManagementRole(role)
  }
  if (["/manager/students", "/manager/courses"].includes(route)) {
    return isReadRole(role)
  }
  if (["/manager/sections", "/manager/grades"].includes(route)) {
    return isReadRole(role)
  }
  if (route === "/manager/reports") return isManagementRole(role) || role === "lecturer"
  return true
}

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
        if (!canPrefetchRoute(route, userRole)) continue
        router.prefetch(route)
      }

      const tasks: Array<() => Promise<unknown>> = [
        () => api.getReports({ limit: 20 }),
        () => api.getReportSchedules({ limit: 20 }),
      ]

      if (isManagementRole(userRole) || userRole === "lecturer" || userRole === "viewer") {
        tasks.push(() => api.getTree())
      }

      if (isManagementRole(userRole)) {
        tasks.push(
          () => api.getDashboardOverview(),
          () => api.getDashboardDepartments(),
          async () => {
            const overview = await api.getDashboardOverview()
            const firstProgramId = overview.programs[0]?.id
            return firstProgramId ? api.getDashboardProgram(firstProgramId) : undefined
          },
          async () => {
            const courses = await api.getDashboardCourses()
            const firstCourseId = courses.course_rows[0]?.id
            return firstCourseId ? api.getDashboardCourse(firstCourseId) : undefined
          },
        )
      }

      // Preloading of raw data is disabled to prevent blank pages and slow responses over Ngrok.
      // Individual pages will load data using pagination or summary metrics.

      if (userRole === "superadmin" || userRole === "admin") {
        tasks.push(() => api.getUsers({ limit: 100 }))
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
