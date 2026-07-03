import { notFound } from "next/navigation"

import { SectionAnalyticsDetail } from "./section-analytics-detail"

export default async function SectionAnalyticsPage({
  params,
}: {
  params: Promise<{ sectionId: string }>
}) {
  const { sectionId } = await params
  const parsedId = Number(sectionId)
  if (!Number.isInteger(parsedId) || parsedId <= 0) notFound()
  return <SectionAnalyticsDetail sectionId={parsedId} />
}
