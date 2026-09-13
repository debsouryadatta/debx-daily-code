"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useAccount } from "@/components/auth-gate"
import { authClient } from "./auth-client"
import { Button } from "@/components/ui/button"
import { useTheme } from "./theme"
import type { AppData, Folder, Preferences, SavedPage, SortKey, ViewMode } from "./types"
import { genId, loadData } from "./storage"
import { librarySchema, type LibraryOperation, type LibrarySnapshot } from "./library"
import { extractPageId, extractSubPages, fetchNotionPage, getPageTitle } from "./notion"

type Theme = NonNullable<Preferences["theme"]>
interface PagesContextValue {
  pages: SavedPage[]
  folders: Folder[]
  revision: number
  createFolder: (name: string, parentId: string | null) => Promise<Folder>
  renameFolder: (id: string, name: string) => Promise<void>
  moveItem: (kind: "page" | "folder", id: string, parentId: string | null) => Promise<void>
  deleteFolder: (id: string, expectedRevision: number) => Promise<void>
  preferences: Preferences
  saving: boolean
  error: string | null
  reload: () => Promise<void>
  addPage: (title: string, url: string, folderId?: string | null) => Promise<SavedPage>
  updatePage: (id: string, patch: Partial<SavedPage>) => Promise<void>
  refreshPage: (id: string, title: string, url: string) => Promise<void>
  removePage: (id: string) => Promise<void>
  reorderPages: (ids: string[], folderId?: string | null) => Promise<void>
  getPage: (id: string) => SavedPage | undefined
  setSortBy: (sortBy: SortKey) => Promise<void>
  setView: (view: ViewMode) => Promise<void>
  setThemePreference: (theme: Theme) => Promise<void>
  exportData: () => AppData
  importData: (data: AppData) => Promise<void>
  browserImportAvailable: boolean
  importBrowserData: () => Promise<void>
  dismissBrowserImport: () => void
}
const PagesContext = createContext<PagesContextValue | null>(null)
const message = (error: unknown) => error instanceof Error ? error.message : "Unable to save your changes. Please try again."

export function PagesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAccount()
  const { refetch: refetchSession } = authClient.useSession()
  const refreshSession = useRef(refetchSession)
  useEffect(() => { refreshSession.current = refetchSession }, [refetchSession])
  const { setTheme } = useTheme()
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null)
  const latest = useRef<LibrarySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const alive = useRef(false)
  const pending = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const importKey = `debx.browser-import.${user.id}`
  const [browserImportAvailable, setBrowserImportAvailable] = useState(() => {
    try { return !localStorage.getItem(importKey) && loadData().pages.length > 0 } catch { return false }
  })

  const request = useCallback(async (operation?: LibraryOperation): Promise<LibrarySnapshot> => {
    const response = await fetch("/api/library", {
      method: operation ? "PATCH" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Account-Id": user.id },
      ...(operation ? { body: JSON.stringify(operation) } : {}),
    })
    const body = await response.json()
    if (!response.ok) {
      if (response.status === 401 || (response.status === 409 && body.code === "ACCOUNT_CHANGED")) {
        await refreshSession.current()
      }
      throw new Error(body.error || "Unable to reach your library. Please try again.")
    }
    return { ...body, data: librarySchema.parse(body.data) } as LibrarySnapshot
  }, [user.id])

  const accept = useCallback((incoming: LibrarySnapshot) => {
    if (!alive.current) return
    if (!latest.current || incoming.revision >= latest.current.revision) {
      latest.current = incoming
      setSnapshot(incoming)
    }
  }, [])

  const reload = useCallback(async () => {
    if (pending.current) return
    try {
      const incoming = await request()
      if (!pending.current && alive.current) { accept(incoming); setError(null) }
    } catch (err) {
      if (alive.current) setError(message(err))
    }
  }, [request, accept])

  useEffect(() => {
    alive.current = true
    void Promise.resolve().then(() => { if (alive.current) return reload() })
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void reload() }, 15000)
    const focus = () => { void reload() }
    window.addEventListener("focus", focus)
    return () => { alive.current = false; window.clearInterval(timer); window.removeEventListener("focus", focus) }
  }, [reload])

  const accountTheme = snapshot ? snapshot.data.preferences.theme || "system" : null
  useEffect(() => {
    if (accountTheme) setTheme(accountTheme)
  }, [accountTheme, setTheme])

  const enqueue = useCallback(<T,>(job: () => Promise<{ operation: LibraryOperation; result: T }>): Promise<T> => {
    pending.current++
    setSaving(true)
    const next = queue.current.catch(() => {}).then(async () => {
      if (!alive.current) throw new Error("Your account changed. Please try again.")
      const { operation, result } = await job()
      if (!alive.current) throw new Error("Your account changed. Please try again.")
      const incoming = await request(operation)
      if (!alive.current) throw new Error("Your account changed. Please try again.")
      accept(incoming)
      setError(null)
      return result
    }).catch((err: unknown) => {
      if (alive.current) setError(message(err))
      throw err
    }).finally(() => {
      pending.current--
      if (alive.current) setSaving(pending.current > 0)
    })
    queue.current = next
    return next
  }, [request, accept])

  const mutate = useCallback((operation: LibraryOperation) => enqueue(async () => ({ operation, result: undefined })), [enqueue])
  const updatePage = useCallback((id: string, patch: Partial<SavedPage>) => {
    const editable = { ...patch }
    delete editable.id
    delete editable.createdAt
    return mutate({ type: "update", id, patch: editable })
  }, [mutate])
  const addPage = useCallback((title: string, url: string, folderId: string | null = null) => enqueue(async () => {
    const pageId = extractPageId(url)
    const recordMap = await fetchNotionPage(pageId)
    const now = Date.now()
    const page: SavedPage = { id: genId(), folderId, title: title.trim() || getPageTitle(recordMap), url: url.trim(), pageId,
      subpages: extractSubPages(recordMap), createdAt: now, updatedAt: now }
    return { operation: { type: "add", page }, result: page }
  }), [enqueue])
  const refreshPage = useCallback((id: string, title: string, url: string) => enqueue(async () => {
    const pageId = extractPageId(url)
    const recordMap = await fetchNotionPage(pageId)
    return { operation: { type: "update", id, patch: { title: title.trim() || getPageTitle(recordMap), url: url.trim(), pageId,
      subpages: extractSubPages(recordMap), updatedAt: Date.now() } }, result: undefined }
  }), [enqueue])
  const dismissBrowserImport = () => {
    try { localStorage.setItem(importKey, "done") } catch { /* Import still succeeded if storage is unavailable. */ }
    setBrowserImportAvailable(false)
  }
  const importBrowserData = async () => {
    await mutate({ type: "merge", data: librarySchema.parse(loadData()) })
    if (alive.current) dismissBrowserImport()
  }

  if (!snapshot) return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-5 text-center">
      <p role={error ? "alert" : "status"}>{error || "Opening your library…"}</p>
      {error && <Button onClick={() => void reload()}>Try again</Button>}
    </div>
  )

  return <PagesContext.Provider value={{
    pages: snapshot.data.pages, folders: snapshot.data.folders ?? [], revision: snapshot.revision,
    createFolder: (name, parentId) => enqueue(async () => {
      const folder: Folder = { id: genId(), name: name.trim(), parentId, createdAt: Date.now() }
      return { operation: { type: "createFolder", folder }, result: folder }
    }),
    renameFolder: (id, name) => mutate({ type: "renameFolder", id, name }),
    moveItem: (kind, id, parentId) => mutate({ type: "move", kind, id, parentId }),
    deleteFolder: (id, expectedRevision) => mutate({ type: "deleteFolder", id, expectedRevision }),
    preferences: snapshot.data.preferences, saving, error, reload,
    addPage, updatePage, refreshPage,
    removePage: (id) => mutate({ type: "remove", id }),
    reorderPages: (ids, folderId = null) => mutate({ type: "reorder", ids, folderId }),
    getPage: (id) => snapshot.data.pages.find((page) => page.id === id),
    setSortBy: (sortBy) => mutate({ type: "preferences", patch: { sortBy } }),
    setView: (view) => mutate({ type: "preferences", patch: { view } }),
    setThemePreference: (theme) => mutate({ type: "preferences", patch: { theme } }),
    exportData: () => latest.current!.data,
    importData: (data) => mutate({ type: "replace", data: librarySchema.parse(data), expectedRevision: latest.current!.revision }),
    browserImportAvailable, importBrowserData, dismissBrowserImport,
  }}>{children}</PagesContext.Provider>
}

export function useOptionalPages() { return useContext(PagesContext) }
export function usePages(): PagesContextValue {
  const ctx = useOptionalPages()
  if (!ctx) throw new Error("usePages must be used within a PagesProvider")
  return ctx
}
