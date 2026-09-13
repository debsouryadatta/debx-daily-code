import { Link, useParams } from "react-router-dom"
import { useMemo, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { ArrowDownUp, Database, FileText, Folder as FolderIcon, FolderPlus, MoreVertical, LayoutGrid, LayoutList, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AccountMenu } from "@/components/account-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { PageDialog } from "@/components/page-dialog"
import { DataDialog } from "@/components/data-dialog"
import { FolderDialog, MoveDialog, type MoveTarget } from "@/components/folder-dialogs"
import { folderPath, folderDeletionCounts, MAX_FOLDER_DEPTH } from "@/lib/folders"
import { SortablePage } from "@/components/sortable-page"
import { usePages } from "@/lib/pages-context"
import { SORT_OPTIONS, sortLabel, sortPages } from "@/lib/sort"
import { cn } from "@/lib/utils"
import type { Folder, SavedPage, SortKey, ViewMode } from "@/lib/types"

export function Home() {
  const { pages, folders, revision, deleteFolder, preferences, removePage, reorderPages, setSortBy, setView, saving, error, reload, browserImportAvailable, importBrowserData, dismissBrowserImport } = usePages()
  const { folderId: routeFolderId } = useParams()
  const folderId = routeFolderId ?? null
  const missing = folderId !== null && !folders.some((folder) => folder.id === folderId)
  const path = missing ? [] : folderPath(folders, folderId)
  const childFolders = folders.filter((folder) => folder.parentId === folderId).sort((a, b) => a.name.localeCompare(b.name))
  const [folderDialog, setFolderDialog] = useState<Folder | "new" | null>(null)
  const [moving, setMoving] = useState<MoveTarget | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [editing, setEditing] = useState<SavedPage | undefined>(undefined)

  const { sortBy, view } = preferences
  const displayed = useMemo(() => sortPages(pages.filter((page) => (page.folderId ?? null) === folderId), sortBy), [pages, sortBy, folderId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = displayed.findIndex((p) => p.id === active.id)
    const newIndex = displayed.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const orderedIds = arrayMove(displayed, oldIndex, newIndex).map((p) => p.id)
    try {
      await reorderPages(orderedIds, folderId)
      if (sortBy !== "manual") toast.success("Switched to custom order. Drag to rearrange anytime.")
    } catch (err) { reportError(err) }
  }

  return (
    <div className="mx-auto min-h-svh w-full max-w-3xl px-5 py-10 md:py-16">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
            DX
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">DebX DailyCode</h1>
            <p className="text-sm text-muted-foreground">
              Your published Notion pages, as a clean reader.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AccountMenu />
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            aria-label="Backup & restore"
            onClick={() => setDataOpen(true)}
          >
            <Database className="size-4" />
          </Button>
        </div>
      </header>

      <div className="mt-4 text-xs text-muted-foreground" role="status">
        {saving ? "Saving to your account…" : error ? (
          <span className="text-destructive">{error} <Button variant="link" size="sm" onClick={() => void reload()}>Refresh</Button></span>
        ) : "Saved to your account"}
      </div>
      {browserImportAvailable && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <p className="w-full text-sm">This browser has pages from before you signed in.</p>
          <Button disabled={saving} onClick={() => void importBrowserData().then(() => toast.success("Browser pages added to your account.")).catch(reportError)}>Import browser pages into my account</Button>
          <Button variant="ghost" disabled={saving} onClick={dismissBrowserImport}>Dismiss</Button>
        </div>
      )}
      <nav aria-label="Library breadcrumb" className="mt-7 flex flex-wrap items-center gap-2 text-sm">
        <Link to="/" className="font-medium hover:underline">My Library</Link>
        {path.map((folder) => <span key={folder.id} className="flex items-center gap-2"> / <Link to={`/folders/${folder.id}`} className="hover:underline">{folder.name}</Link></span>)}
      </nav>
      {missing ? <div className="mt-6 rounded-lg border p-6"><p>This folder was deleted or is unavailable.</p><Link to="/" className="mt-2 inline-block underline">Back to My Library</Link></div> : <>
      {/* Toolbar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {childFolders.length} {childFolders.length === 1 ? "folder" : "folders"} · {displayed.length} {displayed.length === 1 ? "page" : "pages"}
        </p>
        <div className="flex items-center gap-2">
          <SortMenu value={sortBy} onChange={(value) => void setSortBy(value).catch(reportError)} />
          <ViewToggle value={view} onChange={(value) => void setView(value).catch(reportError)} />
          <Button variant="outline" disabled={path.length >= MAX_FOLDER_DEPTH} title={path.length >= MAX_FOLDER_DEPTH ? "Maximum folder depth reached" : "New folder"} onClick={() => setFolderDialog("new")} className="gap-2"><FolderPlus className="size-4" /><span className="hidden sm:inline">New folder</span></Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add page</span>
          </Button>
        </div>
      </div>

      {childFolders.length > 0 && <div className={cn("mt-4", view === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "space-y-2.5")}>
        {childFolders.map((folder) => <Card key={folder.id} className="flex flex-row items-center gap-3 p-4 hover:border-primary/40">
          <Link to={`/folders/${folder.id}`} className="flex min-w-0 flex-1 items-center gap-3"><FolderIcon className="size-6 shrink-0 text-muted-foreground" /><span className="truncate font-medium">{folder.name}</span></Link>
          <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${folder.name}`} />}><MoreVertical className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFolderDialog(folder)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMoving({ kind: "folder", id: folder.id, name: folder.name, parentId: folder.parentId })}>Move to…</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => void handleDeleteFolder(folder)}>Delete</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
        </Card>)}
      </div>}
      {/* List / empty state */}
      {displayed.length === 0 && childFolders.length === 0 ? (
        <Card className="mt-4 flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">This folder is empty</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Publish a Notion page (Share → Publish), then add its link. It'll show up
              here with Prev/Next navigation between every page you add.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="mt-1 gap-2">
            <Plus className="size-4" /> Add your first page
          </Button>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={view === "list" ? [restrictToVerticalAxis, restrictToParentElement] : undefined}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayed.map((p) => p.id)}
            strategy={view === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
          >
            {view === "grid" ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {displayed.map((page, i) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    position={i + 1}
                    view="grid"
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onMove={(page) => setMoving({ kind: "page", id: page.id, name: page.title, parentId: page.folderId ?? null })}
                  />
                ))}
              </div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {displayed.map((page, i) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    position={i + 1}
                    view="list"
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onMove={(page) => setMoving({ kind: "page", id: page.id, name: page.title, parentId: page.folderId ?? null })}
                  />
                ))}
              </ul>
            )}
          </SortableContext>
        </DndContext>
      )}

      </>}
      <PageDialog open={addOpen} onOpenChange={setAddOpen} folderId={folderId} />
      {folderDialog && <FolderDialog folder={folderDialog === "new" ? undefined : folderDialog} parentId={folderId} onClose={() => setFolderDialog(null)} />}
      {moving && <MoveDialog target={moving} onClose={() => setMoving(null)} />}
      <PageDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(undefined)}
        page={editing}
      />
      <DataDialog open={dataOpen} onOpenChange={setDataOpen} />
    </div>
  )

  async function handleDeleteFolder(folder: Folder) {
    const expectedRevision = revision
    const counts = folderDeletionCounts({ version: 1, pages, folders, preferences }, folder.id)
    if (!window.confirm(`Delete “${folder.name}” and everything inside it? This will delete ${counts.folders} contained folders and ${counts.pages} pages.`)) return
    try { await deleteFolder(folder.id, expectedRevision); toast.success("Folder deleted.") }
    catch (err) { reportError(err) }
  }

  async function handleDelete(page: SavedPage) {
    try { await removePage(page.id); toast.success(`Removed “${page.title}”.`) }
    catch (err) { reportError(err) }
  }
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" aria-label="Sort" />}>
        <ArrowDownUp className="size-4" />
        <span className="hidden max-w-[10rem] truncate sm:inline">{sortLabel(value)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Sort by</div>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as SortKey)}>
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.key} value={o.key}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const item = (mode: ViewMode, label: string, icon: React.ReactNode) => (
    <Button
      variant={value === mode ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={value === mode}
      onClick={() => onChange(mode)}
      className={cn(value !== mode && "text-muted-foreground")}
    >
      {icon}
    </Button>
  )
  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-background p-0.5">
      {item("list", "List view", <LayoutList className="size-4" />)}
      {item("grid", "Grid view", <LayoutGrid className="size-4" />)}
    </div>
  )
}

function reportError(error: unknown) { toast.error(error instanceof Error ? error.message : "Couldn't save your changes.") }
