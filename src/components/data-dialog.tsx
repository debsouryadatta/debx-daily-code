import { useRef, useState } from "react"
import { Copy, Download, Upload } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { usePages } from "@/lib/pages-context"
import { parseImportData } from "@/lib/storage"

function backupFilename(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `debx-dailycode-backup-${stamp}.json`
}

export function DataDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { exportData, importData } = usePages()
  const fileRef = useRef<HTMLInputElement>(null)
  const [paste, setPaste] = useState("")

  const snapshot = () => JSON.stringify(exportData(), null, 2)

  const handleDownload = () => {
    const blob = new Blob([snapshot()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = backupFilename()
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success("Backup downloaded.")
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snapshot())
      toast.success("Backup JSON copied to clipboard.")
    } catch {
      toast.error("Couldn't access the clipboard.")
    }
  }

  const applyImport = (text: string) => {
    if (!text.trim()) {
      toast.error("Nothing to import — choose a file or paste your backup JSON.")
      return
    }
    let data
    try {
      data = parseImportData(text)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't parse that backup.")
      return
    }
    const n = data.pages.length
    const ok = window.confirm(
      `Import ${n} page${n === 1 ? "" : "s"}? This replaces the pages and preferences currently stored in this browser.`,
    )
    if (!ok) return
    importData(data)
    setPaste("")
    toast.success(`Imported ${n} page${n === 1 ? "" : "s"}.`)
    onOpenChange(false)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-picking the same file later
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => applyImport(String(reader.result ?? ""))
    reader.onerror = () => toast.error("Couldn't read that file.")
    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Backup &amp; restore</DialogTitle>
          <DialogDescription>
            Everything DebX stores — your saved pages and view preferences — lives in a
            single browser key. Export it to move your setup to another browser or device,
            then import it there.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Export */}
          <div className="grid gap-2">
            <Label>Export</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={handleDownload}>
                <Download className="size-4" /> Download .json
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleCopy}>
                <Copy className="size-4" /> Copy JSON
              </Button>
            </div>
          </div>

          {/* Import */}
          <div className="grid gap-2">
            <Label htmlFor="import-paste">Import</Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={handleFile}
            />
            <Button variant="outline" className="w-fit gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Choose backup file…
            </Button>
            <textarea
              id="import-paste"
              placeholder="…or paste backup JSON here"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              spellCheck={false}
              className="h-24 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-sm text-muted-foreground">
              Importing replaces the pages and preferences in this browser.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => applyImport(paste)} disabled={!paste.trim()}>
            Import pasted JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
