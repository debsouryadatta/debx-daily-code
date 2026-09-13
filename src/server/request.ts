import "server-only"

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(process.env.BETTER_AUTH_URL!).origin
}

export async function readLimitedBody(request: Request, limit = 2_000_000) {
  if (!request.body) return ""
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new RangeError("Request is too large.")
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf8")
}
