import { type NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000"

const SKIP_REQ = new Set(["host", "connection", "expect", "transfer-encoding"])
// Upstream encoding/length are invalid after we buffer/decompress the body.
const SKIP_RES = new Set(["transfer-encoding", "connection", "content-encoding", "content-length"])

export const dynamic = "force-dynamic"
export const maxDuration = 120

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const url = `${BACKEND}/api/v1/${path.join("/")}${req.nextUrl.search}`

  const headers = new Headers()
  req.headers.forEach((v, k) => {
    if (!SKIP_REQ.has(k)) headers.set(k, v)
  })

  const isBodyMethod = !["GET", "HEAD"].includes(req.method)
  const body = isBodyMethod ? await req.arrayBuffer() : undefined

  let res: Response
  try {
    res = await fetch(url, { method: req.method, headers, body })
  } catch {
    return NextResponse.json(
      {
        detail: "Backend proxy target is unavailable",
        backend: BACKEND,
      },
      { status: 502 },
    )
  }

  const resHeaders = new Headers()
  res.headers.forEach((v, k) => {
    if (!SKIP_RES.has(k)) resHeaders.set(k, v)
  })

  if (req.method === "HEAD") {
    await res.arrayBuffer()
    return new NextResponse(null, { status: res.status, headers: resHeaders })
  }

  return new Response(res.body, { status: res.status, headers: resHeaders })
}

export const GET = proxy
export const HEAD = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
