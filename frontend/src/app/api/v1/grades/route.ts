import { NextResponse } from "next/server"
import { mockGrades } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(mockGrades)
}
