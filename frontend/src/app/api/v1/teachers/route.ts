import { NextResponse } from "next/server"
import { mockTeachers } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(mockTeachers)
}
