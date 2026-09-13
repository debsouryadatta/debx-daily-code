import { z } from "zod"
import type { AppData } from "./types"
import { descendantFolderIds, folderStructureError } from "./folders"

const id = z.string().min(1).max(128)
const pageSchema = z.object({
  id,
  folderId: id.nullable().optional(),
  title: z.string().trim().min(1).max(1000),
  url: z.url().max(4096).refine((url) => /^https?:\/\//.test(url)),
  pageId: id,
  subpages: z.array(z.object({ pageId: id, title: z.string().max(1000) }).strict()).max(2000).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().optional(),
}).strict()
const folderSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  parentId: id.nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().optional(),
}).strict()
const preferencesSchema = z.object({
  sortBy: z.enum(["manual", "createdDesc", "createdAsc", "titleAsc", "titleDesc", "updatedDesc"]),
  view: z.enum(["list", "grid"]),
  theme: z.enum(["light", "dark", "system"]).optional(),
}).strict()
export const librarySchema = z.object({
  version: z.literal(1),
  pages: z.array(pageSchema).max(2000).refine((pages) => new Set(pages.map((p) => p.id)).size === pages.length),
  folders: z.array(folderSchema).max(2000).default([]),
  preferences: preferencesSchema,
}).strict().superRefine((data, context) => {
  const error = folderStructureError(data)
  if (error) context.addIssue({ code: "custom", message: error })
})

export const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add"), page: pageSchema }).strict(),
  z.object({ type: z.literal("update"), id, patch: pageSchema.omit({ id: true, createdAt: true }).partial() }).strict(),
  z.object({ type: z.literal("remove"), id }).strict(),
  z.object({ type: z.literal("reorder"), ids: z.array(id).max(2000).refine((ids) => new Set(ids).size === ids.length), folderId: id.nullable().optional() }).strict(),
  z.object({ type: z.literal("createFolder"), folder: folderSchema }).strict(),
  z.object({ type: z.literal("renameFolder"), id, name: z.string().trim().min(1).max(200) }).strict(),
  z.object({ type: z.literal("move"), kind: z.enum(["page", "folder"]), id, parentId: id.nullable() }).strict(),
  z.object({ type: z.literal("deleteFolder"), id, expectedRevision: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal("preferences"), patch: preferencesSchema.partial() }).strict(),
  z.object({ type: z.literal("replace"), data: librarySchema, expectedRevision: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal("merge"), data: librarySchema }).strict(),
])
export type LibraryOperation = z.input<typeof operationSchema>
export interface LibrarySnapshot { data: AppData; revision: number }

export function emptyLibrary(): AppData {
  return { version: 1, pages: [], folders: [], preferences: { sortBy: "createdDesc", view: "list", theme: "system" } }
}

export class LibraryError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function applyOperation(data: AppData, operation: LibraryOperation): AppData {
  const result = applyUnchecked(data, operation)
  const error = folderStructureError(result)
  if (error) throw new LibraryError(error, 400)
  return result
}

function applyUnchecked(data: AppData, operation: LibraryOperation): AppData {
  const folders = data.folders ?? []
  switch (operation.type) {
    case "createFolder":
      if (folders.some(folder => folder.id === operation.folder.id)) throw new LibraryError("This folder already exists.", 409)
      return { ...data, folders: [...folders, operation.folder] }
    case "renameFolder":
      if (!folders.some(folder => folder.id === operation.id)) throw new LibraryError("This folder no longer exists.", 404)
      return { ...data, folders: folders.map(folder => folder.id === operation.id ? { ...folder, name: operation.name, updatedAt: Date.now() } : folder) }
    case "move":
      if (operation.kind === "folder") {
        if (!folders.some(folder => folder.id === operation.id)) throw new LibraryError("This folder no longer exists.", 404)
        return { ...data, folders: folders.map(folder => folder.id === operation.id ? { ...folder, parentId: operation.parentId, updatedAt: Date.now() } : folder) }
      }
      if (!data.pages.some(page => page.id === operation.id)) throw new LibraryError("This page no longer exists.", 404)
      return { ...data, pages: data.pages.map(page => page.id === operation.id ? { ...page, folderId: operation.parentId } : page) }
    case "deleteFolder": {
      if (!folders.some(folder => folder.id === operation.id)) throw new LibraryError("This folder no longer exists.", 404)
      const removed = descendantFolderIds(folders, operation.id)
      return { ...data, folders: folders.filter(folder => !removed.has(folder.id)), pages: data.pages.filter(page => !page.folderId || !removed.has(page.folderId)) }
    }
    case "add":
      if (data.pages.some((p) => p.id === operation.page.id)) return data
      return { ...data, pages: [...data.pages, operation.page] }
    case "update":
      if (!data.pages.some((p) => p.id === operation.id)) throw new LibraryError("This page no longer exists. Refresh your library.", 404)
      return { ...data, pages: data.pages.map((p) => p.id === operation.id ? { ...p, ...operation.patch } : p) }
    case "remove":
      return { ...data, pages: data.pages.filter((p) => p.id !== operation.id) }
    case "reorder": {
      const siblings = data.pages.filter(page => (page.folderId ?? null) === (operation.folderId ?? null))
      const byId = new Map(siblings.map((p) => [p.id, p]))
      const wanted = new Set(operation.ids)
      const ordered = [
        ...operation.ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []),
        ...siblings.filter((p) => !wanted.has(p.id)),
      ]
      let index = 0
      return { ...data, preferences: { ...data.preferences, sortBy: "manual" }, pages: data.pages.map(page => byId.has(page.id) ? ordered[index++] : page) }
    }
    case "preferences": return { ...data, preferences: { ...data.preferences, ...operation.patch } }
    case "replace": return operation.data
    case "merge": {
      const existing = new Set(data.pages.map((p) => p.id))
      const existingFolders = new Set(folders.map(folder => folder.id))
      return { ...data, folders: [...folders, ...(operation.data.folders ?? []).filter(folder => !existingFolders.has(folder.id))], pages: [...data.pages, ...operation.data.pages.filter((p) => !existing.has(p.id))] }
    }
  }
}
