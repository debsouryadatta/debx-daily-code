import { useState } from "react"
import { Folder as FolderIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePages } from "@/lib/pages-context"
import { canMoveFolder, folderPath } from "@/lib/folders"
import type { Folder } from "@/lib/types"

export type MoveTarget = { kind: "page" | "folder"; id: string; name: string; parentId: string | null }

export function FolderDialog({ folder, parentId, onClose }: { folder?: Folder; parentId: string | null; onClose: () => void }) {
  const { createFolder, renameFolder } = usePages()
  const [name, setName] = useState(folder?.name ?? "")
  const [busy, setBusy] = useState(false)
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}><DialogContent>
    <form onSubmit={async (event) => {
      event.preventDefault()
      if (!name.trim()) return
      setBusy(true)
      try {
        if (folder) await renameFolder(folder.id, name.trim())
        else await createFolder(name.trim(), parentId)
        toast.success(folder ? "Folder renamed." : "Folder created.")
        onClose()
      } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save folder.") }
      finally { setBusy(false) }
    }}>
      <DialogHeader><DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle><DialogDescription>Keep related pages together.</DialogDescription></DialogHeader>
      <div className="grid gap-2 py-4"><Label htmlFor="folder-name">Folder name</Label><Input id="folder-name" autoFocus value={name} maxLength={200} disabled={busy} onChange={(event) => setName(event.target.value)} /></div>
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : folder ? "Save" : "Create folder"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}

export function MoveDialog({ target, onClose }: { target: MoveTarget; onClose: () => void }) {
  const { folders, moveItem } = usePages()
  const [destination, setDestination] = useState<string | null>(target.parentId)
  const [busy, setBusy] = useState(false)
  const exists = destination === null || folders.some((folder) => folder.id === destination)
  const path = exists ? folderPath(folders, destination) : []
  const valid = (id: string | null) => target.kind === "page" || canMoveFolder(folders, target.id, id)
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}><DialogContent>
    <DialogHeader><DialogTitle>Move “{target.name}”</DialogTitle><DialogDescription>Select a destination folder. Folders can be nested up to five levels.</DialogDescription></DialogHeader>
    <nav aria-label="Destination" className="flex flex-wrap items-center gap-1 text-sm">
      <Button variant="link" disabled={busy} onClick={() => setDestination(null)}>My Library</Button>
      {path.map((folder) => <span className="flex items-center" key={folder.id}> / <Button variant="link" disabled={busy} onClick={() => setDestination(folder.id)}>{folder.name}</Button></span>)}
    </nav>
    <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
      {folders.filter((folder) => folder.parentId === destination).sort((a, b) => a.name.localeCompare(b.name)).map((folder) => <Button key={folder.id} variant="ghost" className="w-full justify-start" disabled={busy || !valid(folder.id)} onClick={() => setDestination(folder.id)}><FolderIcon className="size-4" /><span className="truncate">{folder.name}</span></Button>)}
      {!folders.some((folder) => folder.parentId === destination) && <p className="p-3 text-sm text-muted-foreground">No subfolders here.</p>}
    </div>
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !exists || !valid(destination) || destination === target.parentId} onClick={async () => {
      setBusy(true)
      try { await moveItem(target.kind, target.id, destination); toast.success("Moved successfully."); onClose() }
      catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't move item.") }
      finally { setBusy(false) }
    }}>{busy ? "Moving…" : "Move here"}</Button></DialogFooter>
  </DialogContent></Dialog>
}
