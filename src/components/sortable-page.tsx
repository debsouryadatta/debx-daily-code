import { Link } from "react-router-dom"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowRight, GripVertical, MoreVertical, Pencil, Trash2 } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { SavedPage, ViewMode } from "@/lib/types"

export function SortablePage({
  page,
  position,
  view,
  onEdit,
  onDelete,
}: {
  page: SavedPage
  /** 1-based position shown in list view. */
  position: number
  view: ViewMode
  onEdit: (page: SavedPage) => void
  onDelete: (page: SavedPage) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  const subCount = page.subpages?.length ?? 0

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  )

  const badge = subCount > 0 && (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {subCount} pages
    </span>
  )

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" />}>
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(page)}>
          <Pencil className="mr-2 size-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(page)}>
          <Trash2 className="mr-2 size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (view === "grid") {
    return (
      <div ref={setNodeRef} style={style}>
        <Card
          className={cn(
            "group flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40",
            isDragging && "shadow-xl",
          )}
        >
          <div className="flex items-center justify-between">
            {handle}
            {menu}
          </div>
          <Link to={`/read/${page.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-medium">{page.title}</span>
              {badge}
            </span>
            <span className="truncate text-xs text-muted-foreground">{page.url}</span>
          </Link>
          <Link
            to={`/read/${page.id}`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1 self-start")}
          >
            Read <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <li ref={setNodeRef} style={style}>
      <Card
        className={cn(
          "group flex flex-row items-center gap-3 p-3 transition-colors hover:border-primary/40",
          isDragging && "shadow-xl",
        )}
      >
        {handle}
        <span className="w-5 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
          {position}
        </span>

        <Link to={`/read/${page.id}`} className="min-w-0 flex-1 overflow-hidden">
          <p className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-medium">{page.title}</span>
            {badge}
          </p>
          <p className="truncate text-xs text-muted-foreground">{page.url}</p>
        </Link>

        <Link
          to={`/read/${page.id}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0 gap-1")}
        >
          Read <ArrowRight className="size-3.5" />
        </Link>

        {menu}
      </Card>
    </li>
  )
}
