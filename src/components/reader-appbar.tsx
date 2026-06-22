import { Link, useNavigate } from "react-router-dom"
import { Home, List } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import type { SubPage } from "@/lib/types"

const pill = "rounded-lg border bg-background/70 shadow-sm backdrop-blur-lg"

export function ReaderAppbar({
  collectionId,
  collectionTitle,
  items,
  currentIndex,
}: {
  collectionId: string
  collectionTitle: string
  items: SubPage[]
  currentIndex: number
}) {
  const navigate = useNavigate()
  const single = items.length <= 1

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-2 p-4 md:p-6">
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Table-of-contents menu (subpages of this collection) */}
        {!single && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" className={pill} aria-label="All pages" />}
            >
              <List className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-auto">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="truncate">{collectionTitle}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items.map((p, i) => (
                  <DropdownMenuItem
                    key={p.pageId}
                    onClick={() => navigate(`/read/${collectionId}/${i}`)}
                    className={cn(i === currentIndex && "bg-accent font-medium")}
                  >
                    <span className="truncate">{p.title}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Title pill */}
        <div className={cn("flex items-center gap-3 px-3 py-2", pill)}>
          <Link to="/" className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            DX
          </Link>
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <h1 className="flex items-center gap-2 truncate font-medium tracking-tight md:max-w-[42vw] md:text-lg">
            <span className="truncate">{collectionTitle}</span>
            {!single && (
              <span className="shrink-0 text-sm text-muted-foreground">
                {currentIndex + 1} of {items.length}
              </span>
            )}
          </h1>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <ThemeToggle className={pill} />
        <Link
          to="/"
          aria-label="Home"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), pill)}
        >
          <Home className="size-5" />
        </Link>
      </div>
    </div>
  )
}
