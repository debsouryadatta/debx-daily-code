import { Link } from "react-router-dom"
import { ArrowUp, ChevronLeft, ChevronRight, Home, List } from "lucide-react"

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
import { cn } from "@/lib/utils"
import type { SubPage } from "@/lib/types"

export function ReaderTools({
  onPrev,
  onNext,
  canPrev,
  canNext,
  items,
  currentIndex,
  collectionTitle,
  onJump,
}: {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  items: SubPage[]
  currentIndex: number
  collectionTitle: string
  onJump: (index: number) => void
}) {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" })
  const multi = items.length > 1

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 md:p-6">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-background/70 p-1.5 shadow-lg backdrop-blur-lg">
        <Link to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}>
          <Home className="size-4" />
          <span className="hidden md:inline">Home</span>
        </Link>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <Button variant="secondary" size="sm" className="gap-1" disabled={!canPrev} onClick={onPrev}>
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <Button variant="secondary" size="sm" className="gap-1" disabled={!canNext} onClick={onNext}>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </Button>

        {multi && (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-6" />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" className="gap-2" aria-label="Jump to page" />}
              >
                <List className="size-4" />
                <span className="hidden md:inline">Jump To</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="center"
                sideOffset={8}
                className="max-h-[60vh] w-72 overflow-auto"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{collectionTitle}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {items.map((p, i) => (
                    <DropdownMenuItem
                      key={p.pageId}
                      onClick={() => onJump(i)}
                      className={cn(i === currentIndex && "bg-accent font-medium")}
                    >
                      <span className="truncate">{p.title}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <Button variant="ghost" size="sm" className="gap-2" onClick={scrollToTop}>
          <ArrowUp className="size-4" />
          <span className="hidden md:inline">Top</span>
        </Button>
      </div>
    </div>
  )
}
