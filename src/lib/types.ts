export interface SubPage {
  /** Notion page id (dashed UUID) of a child page. */
  pageId: string
  title: string
}

export interface SavedPage {
  /** Absent or null means My Library. */
  folderId?: string | null
  /** Internal id used in routes and as a stable key. */
  id: string
  /** User-facing title shown in lists and the appbar (the parent page title). */
  title: string
  /** The raw published Notion URL the user pasted (kept for editing/reference). */
  url: string
  /** Parsed Notion page id (dashed UUID) of the parent page. */
  pageId: string
  /**
   * Ordered child pages of the parent, used for Prev/Next navigation.
   * - `undefined` → not scanned yet (legacy entry); the reader self-heals.
   * - `[]`        → scanned, parent has no child pages (read the parent itself).
   */
  subpages?: SubPage[]
  createdAt: number
  /**
   * Last time the entry was added or edited/refreshed. Powers the "Last edited"
   * sort. Falls back to `createdAt` for legacy entries that predate this field.
   */
  updatedAt?: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
  updatedAt?: number
}

/** How the home list is ordered. `manual` = the user's drag-and-drop order. */
export type SortKey =
  | "manual"
  | "createdDesc"
  | "createdAsc"
  | "titleAsc"
  | "titleDesc"
  | "updatedDesc"

export type ViewMode = "list" | "grid"

/** User-facing display preferences, persisted with the data. */
export interface Preferences {
  sortBy: SortKey
  view: ViewMode
  theme?: "light" | "dark" | "system"
}

/**
 * Portable account library document persisted in PostgreSQL.
 * The same shape supports JSON backups and legacy browser imports.
 */
export interface AppData {
  version: number
  pages: SavedPage[]
  folders?: Folder[]
  preferences: Preferences
}
