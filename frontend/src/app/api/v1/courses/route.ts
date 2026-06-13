import { NextResponse } from "next/server"
import { mockCourses } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(mockCourses)
}
