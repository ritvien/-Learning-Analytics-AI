import { notFound } from "next/navigation"

import { StudentAnalyticsDetail } from "./student-analytics-detail"

export default async function StudentAnalyticsPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const parsedId = Number(studentId)
  if (!Number.isInteger(parsedId) || parsedId <= 0) notFound()
  return <StudentAnalyticsDetail studentId={parsedId} />
}
