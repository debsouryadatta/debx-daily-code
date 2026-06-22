import type { SavedPage, SortKey } from "./types"

/** Menu metadata for the sort control (order = menu order). */
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "manual", label: "Custom order" },
  { key: "createdDesc", label: "Date added · newest" },
  { key: "createdAsc", label: "Date added · oldest" },
  { key: "titleAsc", label: "Title · A–Z" },
  { key: "titleDesc", label: "Title · Z–A" },
  { key: "updatedDesc", label: "Last edited · newest" },
]

export function sortLabel(key: SortKey): string {
  return SORT_OPTIONS.find((o) => o.key === key)?.label ?? "Sort"
}

const byTitle = (a: SavedPage, b: SavedPage) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })

const edited = (p: SavedPage) => p.updatedAt ?? p.createdAt

/**
 * Returns a sorted copy for display. `manual` returns the array untouched so the
 * stored order (set by drag-and-drop) is the source of truth.
 */
export function sortPages(pages: SavedPage[], sortBy: SortKey): SavedPage[] {
  if (sortBy === "manual") return pages
  const arr = [...pages]
  switch (sortBy) {
    case "createdDesc":
      return arr.sort((a, b) => b.createdAt - a.createdAt)
    case "createdAsc":
      return arr.sort((a, b) => a.createdAt - b.createdAt)
    case "titleAsc":
      return arr.sort(byTitle)
    case "titleDesc":
      return arr.sort((a, b) => byTitle(b, a))
    case "updatedDesc":
      return arr.sort((a, b) => edited(b) - edited(a))
    default:
      return arr
  }
}
