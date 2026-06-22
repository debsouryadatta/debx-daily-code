import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePages } from "@/lib/pages-context"
import type { SavedPage } from "@/lib/types"

export function PageDialog({
  open,
  onOpenChange,
  page,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits this page instead of adding a new one. */
  page?: SavedPage
}) {
  const { addPage, refreshPage } = usePages()
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const isEdit = Boolean(page)

  // Prefill / reset whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setTitle(page?.title ?? "")
      setUrl(page?.url ?? "")
      setSubmitting(false)
    }
  }, [open, page])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      toast.error("Paste a published Notion page URL.")
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && page) {
        await refreshPage(page.id, title, url)
        toast.success("Page updated.")
      } else {
        const created = await addPage(title, url)
        const count = created.subpages?.length ?? 0
        toast.success(
          count > 0 ? `Added “${created.title}” (${count} pages).` : `Added “${created.title}”.`,
        )
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load that page.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit page" : "Add a Notion page"}</DialogTitle>
            <DialogDescription>
              Paste the link to a <strong>published</strong> Notion page (Share → Publish).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="Defaults to the Notion page title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">Notion URL</Label>
              <Input
                id="url"
                placeholder="https://your-workspace.notion.site/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={submitting}
              />
              <p className="text-sm text-muted-foreground">
                If the page has subpages, you'll get Prev/Next navigation between them.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Loading…"
                : isEdit
                  ? "Save changes"
                  : "Add page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
