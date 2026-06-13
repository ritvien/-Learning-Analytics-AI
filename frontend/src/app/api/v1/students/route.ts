import { NextResponse } from "next/server"
import { mockStudents } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(mockStudents)
}
