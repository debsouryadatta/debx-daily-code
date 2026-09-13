import type { AppData, Preferences, SavedPage, SortKey, ViewMode } from "./types"
import { librarySchema } from "./library"

/** One key holds the whole app (pages + preferences) so it can be exported wholesale. */
export const STORAGE_KEY = "debx"
/** Old multi-key layout we migrate away from on first load. */
const LEGACY_PAGES_KEY = "debx.pages"
const LEGACY_SETTINGS_KEY = "debx.settings"

export const DATA_VERSION = 1

const SORT_KEYS: SortKey[] = [
  "manual",
  "createdDesc",
  "createdAsc",
  "titleAsc",
  "titleDesc",
  "updatedDesc",
]
const VIEW_MODES: ViewMode[] = ["list", "grid"]

export const DEFAULT_PREFERENCES: Preferences = {
  sortBy: "createdDesc",
  view: "list",
}

export function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase()
}

// --- validation -------------------------------------------------------------
// Everything that comes back from localStorage or an imported file is untrusted,
// so we re-shape it into known-good values rather than trusting JSON blindly.

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function sanitizePage(input: unknown): SavedPage | null {
  const p = asRecord(input)
  if (!p || typeof p.id !== "string" || typeof p.pageId !== "string") return null
  const createdAt = typeof p.createdAt === "number" ? p.createdAt : Date.now()
  const page: SavedPage = {
    id: p.id,
    pageId: p.pageId,
    title: typeof p.title === "string" && p.title.trim() ? p.title : "Untitled",
    url: typeof p.url === "string" ? p.url : "",
    createdAt,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : createdAt,
  }
  if (p.folderId === null || typeof p.folderId === "string") page.folderId = p.folderId
  if (Array.isArray(p.subpages)) {
    page.subpages = p.subpages
      .map((s) => asRecord(s))
      .filter((s): s is Record<string, unknown> => !!s && typeof s.pageId === "string")
      .map((s) => ({
        pageId: s.pageId as string,
        title: typeof s.title === "string" && s.title.trim() ? s.title : "Untitled",
      }))
  }
  // p.subpages absent → leave it off so the reader self-heals.
  return page
}

export function sanitizePages(input: unknown): SavedPage[] {
  if (!Array.isArray(input)) return []
  const out: SavedPage[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    const page = sanitizePage(raw)
    if (page && !seen.has(page.id)) {
      seen.add(page.id)
      out.push(page)
    }
  }
  return out
}

export function sanitizePreferences(input: unknown): Preferences {
  const p = asRecord(input)
  return {
    sortBy: p && SORT_KEYS.includes(p.sortBy as SortKey) ? (p.sortBy as SortKey) : DEFAULT_PREFERENCES.sortBy,
    view: p && VIEW_MODES.includes(p.view as ViewMode) ? (p.view as ViewMode) : DEFAULT_PREFERENCES.view,
    theme: p && (p.theme === "light" || p.theme === "dark") ? p.theme : "system",
  }
}

function emptyData(): AppData {
  return { version: DATA_VERSION, pages: [], preferences: { ...DEFAULT_PREFERENCES } }
}

// --- load / save ------------------------------------------------------------

function migrateLegacy(): AppData | null {
  try {
    const rawPages = localStorage.getItem(LEGACY_PAGES_KEY)
    if (!rawPages) return null
    // Old `debx.settings` only held a proxy URL, which the app no longer uses.
    return {
      version: DATA_VERSION,
      pages: sanitizePages(JSON.parse(rawPages)),
      preferences: { ...DEFAULT_PREFERENCES },
    }
  } catch {
    return null
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return parseImportData(raw)
    }
  } catch {
    // corrupt JSON → fall through to migration / empty
  }

  const migrated = migrateLegacy()
  if (migrated) {
    saveData(migrated)
    try {
      localStorage.removeItem(LEGACY_PAGES_KEY)
      localStorage.removeItem(LEGACY_SETTINGS_KEY)
    } catch {
      // ignore
    }
    return migrated
  }

  return emptyData()
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota / unavailable storage — nothing useful we can do here
  }
}

/**
 * Parse a user-supplied backup (file or pasted text) into validated AppData.
 * Accepts either a full app object (`{ pages, preferences }`) or a bare pages
 * array. Throws a friendly error when the shape is unrecognizable.
 */
export function parseImportData(raw: string): AppData {
  const parsed: unknown = JSON.parse(raw) // SyntaxError bubbles up to the caller
  if (asRecord(parsed) && "folders" in asRecord(parsed)!) {
    const result = librarySchema.safeParse(parsed)
    if (!result.success) throw new Error("This backup has invalid pages or folders. Check folder references and the five-level limit.")
    return result.data
  }
  const pagesInput = Array.isArray(parsed) ? parsed : asRecord(parsed)?.pages
  if (!Array.isArray(pagesInput)) {
    throw new Error("That doesn't look like a DebX backup (no pages found).")
  }
  return {
    version: DATA_VERSION,
    pages: sanitizePages(pagesInput),
    folders: [],
    preferences: sanitizePreferences(Array.isArray(parsed) ? undefined : asRecord(parsed)?.preferences),
  }
}
