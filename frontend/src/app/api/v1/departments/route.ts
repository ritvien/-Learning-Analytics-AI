import { NextResponse } from "next/server"
import { mockDepartments } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(mockDepartments)
}
