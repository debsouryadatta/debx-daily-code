import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import type { ExtendedRecordMap } from "notion-types"
import { AlertTriangle, ChevronLeft, Loader2 } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ReaderAppbar } from "@/components/reader-appbar"
import { ReaderTools } from "@/components/reader-tools"
import { NotionView } from "@/components/notion-view"
import { ErrorBoundary } from "@/components/error-boundary"
import { usePages } from "@/lib/pages-context"
import { extractSubPages, fetchNotionPage } from "@/lib/notion"
import type { SubPage } from "@/lib/types"

const stripDashes = (id: string) => id.replace(/-/g, "")

export function Reader() {
  const { id, idx } = useParams<{ id: string; idx?: string }>()
  const navigate = useNavigate()
  const { getPage, updatePage } = usePages()

  const collection = id ? getPage(id) : undefined

  // The ordered list of pages we navigate with Prev/Next:
  // the parent's subpages, or the parent itself when it has none.
  const items: SubPage[] = useMemo(() => {
    if (!collection || collection.subpages === undefined) return []
    return collection.subpages.length > 0
      ? collection.subpages
      : [{ pageId: collection.pageId, title: collection.title }]
  }, [collection])

  const index = Math.min(Math.max(parseInt(idx ?? "0", 10) || 0, 0), Math.max(0, items.length - 1))
  const current = items[index]

  const [recordMap, setRecordMap] = useState<ExtendedRecordMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Self-heal legacy/empty entries: scan the parent for subpages once.
  useEffect(() => {
    if (!collection || collection.subpages !== undefined) return
    let cancelled = false
    fetchNotionPage(collection.pageId)
      .then((rm) => {
        if (!cancelled) updatePage(collection.id, { subpages: extractSubPages(rm) })
      })
      .catch(() => {
        if (!cancelled) updatePage(collection.id, { subpages: [] })
      })
    return () => {
      cancelled = true
    }
  }, [collection?.id, collection?.subpages, collection?.pageId, updatePage])

  // Fetch the current page's content.
  useEffect(() => {
    if (!current) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setRecordMap(null)

    fetchNotionPage(current.pageId)
      .then((rm) => {
        if (!cancelled) setRecordMap(rm)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load this page.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [current?.pageId])

  const goPrev = useCallback(() => {
    if (id && index > 0) navigate(`/read/${id}/${index - 1}`)
  }, [id, index, navigate])

  const goNext = useCallback(() => {
    if (id && index < items.length - 1) navigate(`/read/${id}/${index + 1}`)
  }, [id, index, items.length, navigate])

  const goTo = useCallback(
    (i: number) => {
      if (id && i !== index) navigate(`/read/${id}/${i}`)
    },
    [id, index, navigate],
  )

  // Keyboard navigation (matches daily-code's arrow-key nav).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      if (e.key === "ArrowRight") goNext()
      else if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev])

  // Scroll to top on page change.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [current?.pageId])

  // Internal Notion links: navigate in-app when the target is one of our pages,
  // otherwise open the real Notion page in a new tab.
  const mapPageUrl = useCallback(
    (pageId: string) => {
      const target = stripDashes(pageId)
      const i = items.findIndex((it) => stripDashes(it.pageId) === target)
      if (i >= 0) return `/read/${id}/${i}`
      return `https://www.notion.so/${target}`
    },
    [items, id],
  )

  // Invalid id -> back home.
  if (!collection) return <Navigate to="/" replace />

  // Still scanning the parent for subpages.
  if (collection.subpages === undefined || !current) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
        <p className="text-sm">Preparing “{collection.title}”…</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh">
      <ReaderAppbar
        collectionId={collection.id}
        collectionTitle={collection.title}
        items={items}
        currentIndex={index}
      />

      {loading && (
        <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-7 animate-spin" />
          <p className="text-sm">Loading “{current.title}”…</p>
        </div>
      )}

      {error && !loading && (
        <div className="flex min-h-svh items-center justify-center p-6">
          <Card className="max-w-md p-6 text-center">
            <AlertTriangle className="mx-auto size-8 text-destructive" />
            <h2 className="mt-3 font-semibold">Couldn't load this page</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Make sure the page is published to the web and the link is correct.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link to="/" className={buttonVariants({ variant: "outline" })}>
                <ChevronLeft className="size-4" /> Home
              </Link>
              <Button onClick={() => navigate(0)}>Retry</Button>
            </div>
          </Card>
        </div>
      )}

      {recordMap && !loading && !error && (
        <ErrorBoundary
          key={current.pageId}
          fallback={(err, reset) => (
            <div className="flex min-h-svh items-center justify-center p-6">
              <Card className="max-w-md p-6 text-center">
                <AlertTriangle className="mx-auto size-8 text-destructive" />
                <h2 className="mt-3 font-semibold">Couldn't render this page</h2>
                <p className="mt-1 text-sm break-words text-muted-foreground">{err.message}</p>
                <div className="mt-5">
                  <Button onClick={reset}>Retry</Button>
                </div>
              </Card>
            </div>
          )}
        >
          <NotionView recordMap={recordMap} mapPageUrl={mapPageUrl} />
        </ErrorBoundary>
      )}

      <ReaderTools
        onPrev={goPrev}
        onNext={goNext}
        canPrev={index > 0}
        canNext={index < items.length - 1}
        items={items}
        currentIndex={index}
        collectionTitle={collection.title}
        onJump={goTo}
      />
    </div>
  )
}
