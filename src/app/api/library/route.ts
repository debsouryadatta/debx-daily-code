import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import { applyOperation, emptyLibrary, LibraryError, librarySchema, operationSchema } from "@/lib/library"
import type { Prisma } from "@/generated/prisma/client"
import { isSameOrigin, readLimitedBody } from "@/server/request"

export const runtime = "nodejs"
const noStore = { "Cache-Control": "private, no-store" }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore })

async function getLibrary(userId: string) {
  return prisma.library.upsert({
    where: { userId }, update: {},
    create: { userId, data: emptyLibrary() as unknown as Prisma.InputJsonValue },
  })
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return json({ error: "Please sign in." }, 401)
    if (request.headers.get("x-account-id") !== session.user.id) return json({ error: "Your account changed. Please reload.", code: "ACCOUNT_CHANGED" }, 409)
    const library = await getLibrary(session.user.id)
    return json({ data: librarySchema.parse(library.data), revision: library.revision })
  } catch {
    return json({ error: "Couldn't load your library. Please try again." }, 503)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return json({ error: "Please sign in." }, 401)
    if (request.headers.get("x-account-id") !== session.user.id) return json({ error: "Your account changed. Please reload.", code: "ACCOUNT_CHANGED" }, 409)
    if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403)
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Expected JSON." }, 415)
    const text = await readLimitedBody(request)
    let input: unknown
    try { input = JSON.parse(text) } catch { return json({ error: "Invalid JSON." }, 400) }
    const parsed = operationSchema.safeParse(input)
    if (!parsed.success) return json({ error: "Invalid library data." }, 400)
    const operation = parsed.data
    // Compare-and-swap each edit against the latest account revision. Concurrent
    // devices retry their operation instead of overwriting an entire stale library.
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await getLibrary(session.user.id)
      if ((operation.type === "replace" || operation.type === "deleteFolder") && operation.expectedRevision !== current.revision) {
        return json({ error: "Your library changed. Refresh and confirm this action again." }, 409)
      }
      const data = applyOperation(librarySchema.parse(current.data), operation)
      if (!librarySchema.safeParse(data).success || JSON.stringify(data).length > 2_000_000) {
        return json({ error: "Your library is too large." }, 413)
      }
      const result = await prisma.library.updateMany({
        where: { userId: session.user.id, revision: current.revision },
        data: { data: data as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
      })
      if (result.count) return json({ data, revision: current.revision + 1 })
    }
    return json({ error: "Your library is busy. Please try again." }, 409)
  } catch (error) {
    if (error instanceof RangeError) return json({ error: "Library request is too large." }, 413)
    if (error instanceof LibraryError) return json({ error: error.message }, error.status)
    return json({ error: "Couldn't save your changes. Please try again." }, 503)
  }
}
