import "dotenv/config"
import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const base = process.env.TEST_BASE_URL

test("accounts persist across sessions, isolate users, and preserve concurrent edits", { skip: !base, timeout: 120_000 }, async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  const emails: string[] = []
  const password = randomUUID() + "Aa1!"
  async function request(path: string, method = "GET", body?: unknown, cookie = "", userId = "", origin = base!) {
    const response = await fetch(base + path, { method, headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie, "X-Account-Id": userId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const data = await response.json()
    return { status: response.status, data, cookie: response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") }
  }
  async function signup() {
    const email = `migration-test-${randomUUID()}@example.invalid`
    emails.push(email)
    const result = await request("/api/auth/sign-up/email", "POST", { name: "Integration test", email, password })
    assert.equal(result.status, 200, result.data?.message)
    assert.ok(result.cookie)
    return { ...result, id: result.data.user.id, email }
  }
  const page = (id: string) => ({ id, pageId: id, title: id, url: `https://www.notion.so/${id}`, createdAt: Date.now(), subpages: [] })
  try {
    assert.equal((await request("/api/library")).status, 401)
    assert.equal((await request("/api/notion/loadPageChunk", "POST", {})).status, 401)
    const a = await signup()
    const b = await signup()
    const a2 = await request("/api/auth/sign-in/email", "POST", { email: a.email, password })
    assert.equal(a2.status, 200)
    assert.equal((await request("/api/library", "GET", undefined, a.cookie, a.id)).data.data.pages.length, 0)
    assert.equal((await request("/api/library", "PATCH", { type: "add", page: page("page-a") }, a.cookie, a.id)).status, 200)
    let second = await request("/api/library", "GET", undefined, a2.cookie, a.id)
    assert.equal(second.data.data.pages[0].id, "page-a")
    assert.equal((await request("/api/library", "GET", undefined, b.cookie, b.id)).data.data.pages.length, 0)
    assert.equal((await request("/api/library", "GET", undefined, b.cookie, a.id)).status, 409)
    assert.equal((await request("/api/library", "PATCH", { type: "update", id: "page-a", patch: { title: "stolen" } }, b.cookie, b.id)).status, 404)
    assert.equal((await request("/api/library", "PATCH", { type: "remove", id: "page-a" }, a.cookie, a.id, "https://untrusted.example")).status, 403)
    assert.equal((await request("/api/library", "PATCH", { type: "remove", id: "page-a", userId: b.id }, a.cookie, a.id)).status, 400)
    const parallel = await Promise.all(["page-b", "page-c"].map(id => request("/api/library", "PATCH", { type: "add", page: page(id) }, a2.cookie, a.id)))
    assert.ok(parallel.every(r => r.status === 200))
    second = await request("/api/library", "GET", undefined, a.cookie, a.id)
    assert.equal(second.data.data.pages.length, 3)
    const stale = second.data
    await request("/api/library", "PATCH", { type: "preferences", patch: { view: "grid", theme: "dark" } }, a.cookie, a.id)
    assert.equal((await request("/api/library", "PATCH", { type: "replace", data: stale.data, expectedRevision: stale.revision }, a2.cookie, a.id)).status, 409)
    second = await request("/api/library", "GET", undefined, a2.cookie, a.id)
    assert.equal(second.data.data.preferences.view, "grid")
    assert.equal(second.data.data.preferences.theme, "dark")
    const makeFolder = (id: string, parentId: string | null) => ({ id, name: id, parentId, createdAt: Date.now() })
    for (let i = 1; i <= 5; i++) {
      const created = await request("/api/library", "PATCH", { type: "createFolder", folder: makeFolder(`f${i}`, i === 1 ? null : `f${i - 1}`) }, a.cookie, a.id)
      assert.equal(created.status, 200)
    }
    assert.equal((await request("/api/library", "PATCH", { type: "createFolder", folder: makeFolder("f6", "f5") }, a.cookie, a.id)).status, 400)
    assert.equal((await request("/api/library", "PATCH", { type: "move", kind: "folder", id: "f1", parentId: "f5" }, a.cookie, a.id)).status, 400)
    assert.equal((await request("/api/library", "PATCH", { type: "move", kind: "page", id: "page-a", parentId: "f5" }, a.cookie, a.id)).status, 200)
    second = await request("/api/library", "GET", undefined, a2.cookie, a.id)
    assert.equal(second.data.data.folders.length, 5)
    assert.equal(second.data.data.pages.find((p: { id: string }) => p.id === "page-a").folderId, "f5")
    assert.equal((await request("/api/library", "PATCH", { type: "renameFolder", id: "f1", name: "not mine" }, b.cookie, b.id)).status, 404)
    const beforeDelete = second.data.revision
    await request("/api/library", "PATCH", { type: "add", page: { ...page("concurrent"), folderId: "f5" } }, a2.cookie, a.id)
    assert.equal((await request("/api/library", "PATCH", { type: "deleteFolder", id: "f1", expectedRevision: beforeDelete }, a.cookie, a.id)).status, 409)
    second = await request("/api/library", "GET", undefined, a.cookie, a.id)
    const deleted = await request("/api/library", "PATCH", { type: "deleteFolder", id: "f1", expectedRevision: second.data.revision }, a.cookie, a.id)
    assert.equal(deleted.status, 200)
    assert.equal(deleted.data.data.folders.length, 0)
    assert.deepEqual(deleted.data.data.pages.map((p: { id: string }) => p.id).sort(), ["page-b", "page-c"])
    const credential = await prisma.account.findFirst({ where: { userId: a.id, providerId: "credential" } })
    assert.ok(credential?.password && credential.password !== password)
    assert.equal((await request("/api/auth/sign-out", "POST", {}, a.cookie, a.id)).status, 200)
    assert.equal((await request("/api/library", "GET", undefined, a.cookie, a.id)).status, 401)
    assert.equal((await request("/api/library", "GET", undefined, a2.cookie, a.id)).status, 200)
  } finally {
    // Delete only the disposable accounts generated by this test; relations cascade.
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
    await prisma.$disconnect()
  }
})
