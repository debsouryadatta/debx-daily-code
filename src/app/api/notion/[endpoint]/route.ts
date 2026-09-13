import { auth } from "@/server/auth"
import { isSameOrigin, readLimitedBody } from "@/server/request"

export const runtime = "nodejs"
const endpoints = new Set(["loadPageChunk", "queryCollection", "getRecordValues", "syncRecordValuesMain", "getSignedFileUrls"])
const noStore = { "Cache-Control": "private, no-store" }

export async function POST(request: Request, context: { params: Promise<{ endpoint: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return Response.json({ error: "Please sign in." }, { status: 401, headers: noStore })
    if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403, headers: noStore })
    const { endpoint } = await context.params
    if (!endpoints.has(endpoint)) return Response.json({ error: "Unknown Notion endpoint." }, { status: 404, headers: noStore })
    const body = await readLimitedBody(request)
    try { JSON.parse(body) } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: noStore }) }
    const upstream = await fetch(`https://www.notion.so/api/v3/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    if (!upstream.ok) return Response.json({ error: "Notion couldn't load this published page. Please try again." }, { status: 502, headers: noStore })
    return new Response(upstream.body, { headers: { ...noStore, "Content-Type": "application/json" } })
  } catch (error) {
    return Response.json({ error: error instanceof RangeError ? "Request is too large." : "Couldn't reach Notion. Please try again." }, { status: error instanceof RangeError ? 413 : 502, headers: noStore })
  }
}
