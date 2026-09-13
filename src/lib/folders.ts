import type { AppData, Folder } from "./types"

export const MAX_FOLDER_DEPTH = 5

export function folderPath(folders: Folder[], folderId: string | null): Folder[] {
  const byId = new Map(folders.map(folder => [folder.id, folder]))
  return pathFromMap(byId, folderId)
}

function pathFromMap(byId: Map<string, Folder>, folderId: string | null): Folder[] {
  const path: Folder[] = []
  const seen = new Set<string>()
  let current = folderId
  while (current !== null) {
    if (seen.has(current)) throw new Error("A folder cannot contain itself.")
    seen.add(current)
    const folder = byId.get(current)
    if (!folder) throw new Error("The destination folder no longer exists.")
    path.unshift(folder)
    current = folder.parentId
  }
  return path
}

export function descendantFolderIds(folders: Folder[], id: string): Set<string> {
  const result = new Set([id])
  const pending = [id]
  while (pending.length) {
    const parentId = pending.pop()!
    for (const folder of folders) {
      if (folder.parentId === parentId && !result.has(folder.id)) {
        result.add(folder.id)
        pending.push(folder.id)
      }
    }
  }
  return result
}

export function folderDeletionCounts(data: AppData, id: string) {
  const ids = descendantFolderIds(data.folders ?? [], id)
  return { folders: ids.size - 1, pages: data.pages.filter(page => page.folderId && ids.has(page.folderId)).length }
}

export function folderStructureError(data: AppData): string | null {
  const folders = data.folders ?? []
  const byId = new Map(folders.map(folder => [folder.id, folder]))
  if (byId.size !== folders.length) return "Folder IDs must be unique."
  try {
    for (const folder of folders) {
      if (pathFromMap(byId, folder.id).length > MAX_FOLDER_DEPTH) return "Folders can be nested up to five levels."
    }
    for (const page of data.pages) {
      if (page.folderId && !byId.has(page.folderId)) return "The destination folder no longer exists."
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid folder structure."
  }
  return null
}

export function canMoveFolder(folders: Folder[], id: string, parentId: string | null): boolean {
  if (!folders.some(folder => folder.id === id)) return false
  const moved = folders.map(folder => folder.id === id ? { ...folder, parentId } : folder)
  return folderStructureError({ version: 1, pages: [], folders: moved, preferences: { sortBy: "manual", view: "list" } }) === null
}
