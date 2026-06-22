import { NotionRenderer } from "react-notion-x"
import { Code } from "react-notion-x/third-party/code"
import { Collection } from "react-notion-x/third-party/collection"
import { Equation } from "react-notion-x/third-party/equation"
import type { ExtendedRecordMap } from "notion-types"
import { Link } from "react-router-dom"

import { useTheme } from "@/lib/theme"

// react-notion-x renders page links with this component. We route in-app links
// (mapped to "/read/...") through react-router, and open everything else (real
// Notion pages, external sites) in a new tab.
function PageLink({ href, ...props }: { href?: string } & Record<string, unknown>) {
  if (href && href.startsWith("/")) {
    return <Link to={href} {...(props as object)} />
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" {...(props as object)} />
}

/**
 * Renders a Notion recordMap exactly like daily-code's "new mode":
 * full page body, no react-notion-x header (our own appbar floats on top),
 * dark mode tied to the app theme, with top/bottom padding to clear the
 * fixed appbar and toolbar.
 */
export function NotionView({
  recordMap,
  mapPageUrl,
}: {
  recordMap: ExtendedRecordMap
  /** Resolve a Notion pageId to an href (in-app route or external URL). */
  mapPageUrl: (pageId: string) => string
}) {
  const { resolvedTheme } = useTheme()

  return (
    <NotionRenderer
      recordMap={recordMap}
      fullPage
      disableHeader
      darkMode={resolvedTheme === "dark"}
      components={{ Code, Collection, Equation, PageLink }}
      mapPageUrl={mapPageUrl}
      className="debx-notion pt-24 pb-32"
    />
  )
}
