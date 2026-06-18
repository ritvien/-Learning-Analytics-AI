/**
 * Next.js Route Handler — SSE streaming proxy for the chat endpoint.
 *
 * Unlike rewrites() which buffers the full response, Route Handlers
 * support the Web Streams API and can forward SSE chunks in real-time.
 *
 * POST /api/v1/chat/stream → proxied to FastAPI backend
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000"

// Prevent Next.js from caching/buffering this route
export const dynamic = "force-dynamic"
export const maxDuration = 120 // agent queries can take up to 2 min

export async function POST(request: Request) {
  const body = await request.text()

  const authHeader = request.headers.get("authorization")

  const backendRes = await fetch(`${BACKEND_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body,
  })

  if (!backendRes.ok) {
    return new Response(await backendRes.text(), {
      status: backendRes.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Forward the SSE stream directly using Web Streams API
  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
