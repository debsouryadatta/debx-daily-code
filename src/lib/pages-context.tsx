import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import type { AppData, Preferences, SavedPage, SortKey, ViewMode } from "./types"
import { DATA_VERSION, STORAGE_KEY, genId, loadData, saveData } from "./storage"
import { extractPageId, extractSubPages, fetchNotionPage, getPageTitle } from "./notion"

interface PagesContextValue {
  pages: SavedPage[]
  preferences: Preferences
  /** Fetches the parent page, extracts its subpages, then stores the collection. */
  addPage: (title: string, url: string) => Promise<SavedPage>
  updatePage: (id: string, patch: Partial<SavedPage>) => void
  /** Re-fetches the parent page to refresh its title + subpages (bumps updatedAt). */
  refreshPage: (id: string, title: string, url: string) => Promise<void>
  removePage: (id: string) => void
  /** Set the manual order to this exact id sequence (used by drag-and-drop). */
  reorderPages: (orderedIds: string[]) => void
  getPage: (id: string) => SavedPage | undefined
  setSortBy: (sortBy: SortKey) => void
  setView: (view: ViewMode) => void
  /** Current snapshot of everything persisted, for export. */
  exportData: () => AppData
  /** Replace all pages + preferences from an imported snapshot. */
  importData: (data: AppData) => void
}

const PagesContext = createContext<PagesContextValue | null>(null)

export function PagesProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData())

  // Persist the whole app object on every change (single key).
  useEffect(() => {
    saveData(data)
  }, [data])

  // Keep multiple tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setData(loadData())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setPages = useCallback(
    (updater: (prev: SavedPage[]) => SavedPage[]) => {
      setData((prev) => ({ ...prev, pages: updater(prev.pages) }))
    },
    [],
  )

  const updatePage = useCallback<PagesContextValue["updatePage"]>(
    (id, patch) => {
      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    },
    [setPages],
  )

  const addPage = useCallback<PagesContextValue["addPage"]>(
    async (title, url) => {
      const pageId = extractPageId(url) // throws if invalid -> caller handles
      const recordMap = await fetchNotionPage(pageId) // throws on bad/unpublished page
      const subpages = extractSubPages(recordMap)
      const now = Date.now()
      const page: SavedPage = {
        id: genId(),
        title: title.trim() || getPageTitle(recordMap),
        url: url.trim(),
        pageId,
        subpages,
        createdAt: now,
        updatedAt: now,
      }
      setPages((prev) => [...prev, page])
      return page
    },
    [setPages],
  )

  const refreshPage = useCallback<PagesContextValue["refreshPage"]>(
    async (id, title, url) => {
      const pageId = extractPageId(url)
      const recordMap = await fetchNotionPage(pageId)
      const subpages = extractSubPages(recordMap)
      updatePage(id, {
        title: title.trim() || getPageTitle(recordMap),
        url: url.trim(),
        pageId,
        subpages,
        updatedAt: Date.now(),
      })
    },
    [updatePage],
  )

  const removePage = useCallback<PagesContextValue["removePage"]>(
    (id) => {
      setPages((prev) => prev.filter((p) => p.id !== id))
    },
    [setPages],
  )

  const reorderPages = useCallback<PagesContextValue["reorderPages"]>(
    (orderedIds) => {
      setPages((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]))
        const wanted = new Set(orderedIds)
        const next = orderedIds
          .map((id) => byId.get(id))
          .filter((p): p is SavedPage => Boolean(p))
        // Safety: keep any page the caller didn't mention rather than dropping it.
        for (const p of prev) if (!wanted.has(p.id)) next.push(p)
        return next.length === prev.length ? next : prev
      })
    },
    [setPages],
  )

  const getPage = useCallback<PagesContextValue["getPage"]>(
    (id) => data.pages.find((p) => p.id === id),
    [data.pages],
  )

  const setSortBy = useCallback<PagesContextValue["setSortBy"]>((sortBy) => {
    setData((prev) => ({ ...prev, preferences: { ...prev.preferences, sortBy } }))
  }, [])

  const setView = useCallback<PagesContextValue["setView"]>((view) => {
    setData((prev) => ({ ...prev, preferences: { ...prev.preferences, view } }))
  }, [])

  const exportData = useCallback<PagesContextValue["exportData"]>(() => data, [data])

  const importData = useCallback<PagesContextValue["importData"]>((incoming) => {
    setData({
      version: DATA_VERSION,
      pages: incoming.pages,
      preferences: incoming.preferences,
    })
  }, [])

  const value = useMemo<PagesContextValue>(
    () => ({
      pages: data.pages,
      preferences: data.preferences,
      addPage,
      updatePage,
      refreshPage,
      removePage,
      reorderPages,
      getPage,
      setSortBy,
      setView,
      exportData,
      importData,
    }),
    [
      data.pages,
      data.preferences,
      addPage,
      updatePage,
      refreshPage,
      removePage,
      reorderPages,
      getPage,
      setSortBy,
      setView,
      exportData,
      importData,
    ],
  )

  return <PagesContext.Provider value={value}>{children}</PagesContext.Provider>
}

export function usePages(): PagesContextValue {
  const ctx = useContext(PagesContext)
  if (!ctx) throw new Error("usePages must be used within a PagesProvider")
  return ctx
}
