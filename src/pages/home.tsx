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
import { ArrowDownUp, Database, FileText, LayoutGrid, LayoutList, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { PageDialog } from "@/components/page-dialog"
import { DataDialog } from "@/components/data-dialog"
import { SortablePage } from "@/components/sortable-page"
import { usePages } from "@/lib/pages-context"
import { SORT_OPTIONS, sortLabel, sortPages } from "@/lib/sort"
import { cn } from "@/lib/utils"
import type { SavedPage, SortKey, ViewMode } from "@/lib/types"

export function Home() {
  const { pages, preferences, removePage, reorderPages, setSortBy, setView } = usePages()
  const [addOpen, setAddOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [editing, setEditing] = useState<SavedPage | undefined>(undefined)

  const { sortBy, view } = preferences
  const displayed = useMemo(() => sortPages(pages, sortBy), [pages, sortBy])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = displayed.findIndex((p) => p.id === active.id)
    const newIndex = displayed.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const orderedIds = arrayMove(displayed, oldIndex, newIndex).map((p) => p.id)
    reorderPages(orderedIds)
    // Dragging defines a manual order — switch the sort to reflect it.
    if (sortBy !== "manual") {
      setSortBy("manual")
      toast.success("Switched to custom order — drag to rearrange anytime.")
    }
  }

  return (
    <div className="mx-auto min-h-svh w-full max-w-3xl px-5 py-10 md:py-16">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
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

      {/* Toolbar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </p>
        <div className="flex items-center gap-2">
          <SortMenu value={sortBy} onChange={setSortBy} />
          <ViewToggle value={view} onChange={setView} />
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add page</span>
          </Button>
        </div>
      </div>

      {/* List / empty state */}
      {pages.length === 0 ? (
        <Card className="mt-4 flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No pages yet</p>
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
                  />
                ))}
              </ul>
            )}
          </SortableContext>
        </DndContext>
      )}

      <PageDialog open={addOpen} onOpenChange={setAddOpen} />
      <PageDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(undefined)}
        page={editing}
      />
      <DataDialog open={dataOpen} onOpenChange={setDataOpen} />
    </div>
  )

  function handleDelete(page: SavedPage) {
    removePage(page.id)
    toast.success(`Removed “${page.title}”.`)
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
