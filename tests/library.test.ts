import assert from "node:assert/strict"
import test from "node:test"
import { applyOperation, emptyLibrary, librarySchema, operationSchema } from "../src/lib/library"

const page = (id: string) => ({ id, pageId: id, title: id, url: `https://www.notion.so/${id}`, createdAt: 1, subpages: [] })

test("reordering preserves concurrently added pages and selects manual order", () => {
  const data = { ...emptyLibrary(), pages: [page("a"), page("b"), page("c")] }
  const next = applyOperation(data, { type: "reorder", ids: ["b", "a"] })
  assert.deepEqual(next.pages.map(p => p.id), ["b", "a", "c"])
  assert.equal(next.preferences.sortBy, "manual")
})

test("browser import merges without replacing existing account pages or preferences", () => {
  const data = { ...emptyLibrary(), pages: [page("a")] }
  const incoming = { ...emptyLibrary(), pages: [{ ...page("a"), title: "old browser title" }, page("b")] }
  const next = applyOperation(data, { type: "merge", data: incoming })
  assert.equal(next.pages[0].title, "a")
  assert.deepEqual(next.pages.map(p => p.id), ["a", "b"])
  assert.deepEqual(next.preferences, data.preferences)
})

test("deleted pages cannot be resurrected by a stale update", () => {
  assert.throws(() => applyOperation(emptyLibrary(), { type: "update", id: "gone", patch: { title: "edited" } }), /no longer exists/)
})

test("API validation rejects identity injection, duplicate IDs and non-web URLs", () => {
  assert.equal(operationSchema.safeParse({ type: "remove", id: "a", userId: "someone-else" }).success, false)
  assert.equal(operationSchema.safeParse({ type: "update", id: "a", patch: { id: "b" } }).success, false)
  assert.equal(operationSchema.safeParse({ type: "add", page: { ...page("a"), url: "javascript:alert(1)" } }).success, false)
  assert.equal(librarySchema.safeParse({ ...emptyLibrary(), pages: [page("a"), page("a")] }).success, false)
})
