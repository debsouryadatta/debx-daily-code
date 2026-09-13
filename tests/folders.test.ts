import assert from "node:assert/strict"
import test from "node:test"
import { applyOperation, emptyLibrary, librarySchema } from "../src/lib/library"
import { canMoveFolder, folderDeletionCounts, folderPath } from "../src/lib/folders"
import { parseImportData } from "../src/lib/storage"
import type { AppData, Folder } from "../src/lib/types"

const folder = (id: string, parentId: string | null = null): Folder => ({ id, name: id, parentId, createdAt: 1 })
const page = (id: string, folderId: string | null = null) => ({ id, pageId: id, title: id, url: `https://www.notion.so/${id}`, createdAt: 1, folderId })
const tree = (): AppData => ({ ...emptyLibrary(), folders: [folder("a"), folder("b", "a"), folder("c", "b")], pages: [page("root"), page("inside", "b"), page("deep", "c")] })

test("legacy libraries and backups place existing pages at root", () => {
  const old = { version: 1, pages: [page("old")], preferences: { sortBy: "manual", view: "list" } }
  assert.deepEqual(librarySchema.parse(old).folders, [])
  assert.deepEqual(parseImportData(JSON.stringify(old)).folders, [])
})

test("folder and page siblings survive backup round-trip", () => {
  const data = tree()
  assert.deepEqual(parseImportData(JSON.stringify(data)), data)
  assert.deepEqual(folderPath(data.folders!, "c").map(f => f.id), ["a", "b", "c"])
})

test("five folder levels allow pages, but a sixth folder is rejected", () => {
  let data = emptyLibrary()
  for (let i = 1; i <= 5; i++) data = applyOperation(data, { type: "createFolder", folder: folder(`f${i}`, i === 1 ? null : `f${i - 1}`) })
  data = applyOperation(data, { type: "add", page: page("leaf", "f5") })
  assert.equal(data.pages.length, 1)
  assert.throws(() => applyOperation(data, { type: "createFolder", folder: folder("f6", "f5") }), /five levels/)
})

test("moves reject cycles and validate depth of the entire moved tree", () => {
  const data = tree()
  assert.throws(() => applyOperation(data, { type: "move", kind: "folder", id: "a", parentId: "c" }), /itself/)
  assert.equal(canMoveFolder(data.folders!, "a", "a"), false)
  const extended = { ...data, folders: [...data.folders!, folder("x"), folder("y", "x"), folder("z", "y")] }
  assert.equal(canMoveFolder(extended.folders, "a", "z"), false)
  assert.throws(() => applyOperation(extended, { type: "move", kind: "folder", id: "a", parentId: "z" }), /five levels/)
  assert.equal(canMoveFolder(extended.folders, "c", "z"), true)
})

test("moving a folder preserves descendants and page reader IDs", () => {
  const data = applyOperation(tree(), { type: "move", kind: "folder", id: "b", parentId: null })
  assert.equal(data.folders!.find(f => f.id === "c")!.parentId, "b")
  assert.equal(data.pages.find(p => p.id === "deep")!.folderId, "c")
  const moved = applyOperation(data, { type: "move", kind: "page", id: "inside", parentId: null })
  assert.equal(moved.pages.find(p => p.id === "inside")!.folderId, null)
})

test("missing destinations and orphaned or cyclic backup entries are rejected", () => {
  assert.throws(() => applyOperation(tree(), { type: "move", kind: "page", id: "inside", parentId: "missing" }), /no longer exists/)
  assert.equal(librarySchema.safeParse({ ...tree(), folders: [folder("a", "a")] }).success, false)
  assert.throws(() => parseImportData(JSON.stringify({ ...tree(), folders: [] })), /invalid pages or folders/)
})

test("recursive deletion counts and removes only the selected subtree", () => {
  assert.deepEqual(folderDeletionCounts(tree(), "b"), { folders: 1, pages: 2 })
  const result = applyOperation(tree(), { type: "deleteFolder", id: "b", expectedRevision: 0 })
  assert.deepEqual(result.folders!.map(f => f.id), ["a"])
  assert.deepEqual(result.pages.map(p => p.id), ["root"])
})

test("reordering pages stays within the current folder", () => {
  const data = { ...tree(), pages: [page("r1"), page("p1", "b"), page("r2"), page("p2", "b")] }
  const result = applyOperation(data, { type: "reorder", ids: ["p2", "r2", "p1"], folderId: "b" })
  assert.deepEqual(result.pages.map(p => p.id), ["r1", "p2", "r2", "p1"])
})
