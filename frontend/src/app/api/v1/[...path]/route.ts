import { type NextRequest, NextResponse } from "next/server"

const BACKEND = "http://127.0.0.1:8000"

const SKIP_REQ = new Set(["host", "connection", "expect", "transfer-encoding"])
const SKIP_RES = new Set(["transfer-encoding", "connection"])

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const url = `${BACKEND}/api/v1/${path.join("/")}${req.nextUrl.search}`

  const headers = new Headers()
  req.headers.forEach((v, k) => {
    if (!SKIP_REQ.has(k)) headers.set(k, v)
  })

  const isBodyMethod = !["GET", "HEAD"].includes(req.method)
  const body = isBodyMethod ? await req.arrayBuffer() : undefined

  const res = await fetch(url, { method: req.method, headers, body })

  const resHeaders = new Headers()
  res.headers.forEach((v, k) => {
    if (!SKIP_RES.has(k)) resHeaders.set(k, v)
  })

  return new NextResponse(res.body, { status: res.status, headers: resHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
