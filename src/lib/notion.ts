import { NotionAPI } from "notion-client"
import { parsePageId } from "notion-utils"
import type { ExtendedRecordMap } from "notion-types"

import type { SubPage } from "./types"

/**
 * Extract a dashed Notion page id from any published URL (notion.so or
 * *.notion.site, with or without a slug / dashes / query string).
 * Throws a friendly error when no id can be found.
 */
export function extractPageId(input: string): string {
  const id = parsePageId(input, { uuid: true })
  if (!id) {
    throw new Error(
      "Couldn't find a Notion page id in that link. Paste the full published page URL.",
    )
  }
  return id
}

/**
 * Where notion-client should send its POST requests. Always the same-origin
 * `/notion-api/*` path, which is proxied to www.notion.so so the browser never
 * makes a cross-origin request:
 * - Dev / `vite preview`: Vite's server.proxy / preview.proxy (see vite.config).
 * - Prod: the host rewrites it (Vercel `vercel.json`, Netlify `_redirects`).
 */
function getApiBaseUrl(): string {
  return "/notion-api/api/v3"
}

// --- recordMap normalization (ported from code100x/daily-code) -------------
// Notion's API now returns blocks in a nested `value.value` shape. notion-client's
// built-in missing-block traversal can't see past that nesting, so toggle children
// (and other nested descendants) never get fetched, and pages can render blank.
// We disable its traversal, normalize the shape, then manually fetch descendants
// until the tree is complete.

function normalizeRecordMap(recordMap: any) {
  if (!recordMap?.block) return recordMap
  const normalizedBlock: any = {}
  for (const [key, block] of Object.entries(recordMap.block) as any) {
    if (!block?.value) continue
    const value = block.value
    if (!value.type && value.value?.type) {
      normalizedBlock[key] = { ...block, value: value.value }
    } else {
      normalizedBlock[key] = block
    }
  }
  return { ...recordMap, block: normalizedBlock }
}

function collectContentBlockIds(recordMap: any): string[] {
  const blocks = recordMap?.block
  if (!blocks) return []
  const rootId = Object.keys(blocks)[0]
  if (!rootId) return []

  const seen = new Set<string>()
  const walk = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    const value = blocks[id]?.value
    if (!value) return
    if (id !== rootId && (value.type === "page" || value.type === "collection_view_page")) return
    if (Array.isArray(value.content)) {
      for (const childId of value.content) walk(childId)
    }
    const refId = value.format?.transclusion_reference_pointer?.id
    if (refId) walk(refId)
  }
  walk(rootId)
  return Array.from(seen)
}

/**
 * Fetch a published Notion page and return a complete, normalized recordMap
 * ready for react-notion-x.
 */
export async function fetchNotionPage(pageId: string): Promise<ExtendedRecordMap> {
  // notion-client hardcodes `mode: "no-cors"`, which makes the browser strip the
  // `Content-Type: application/json` header (Notion then 400s). The constructor's
  // ofetchOptions are merged after that default, so we override it back to "cors".
  const notion = new NotionAPI({
    apiBaseUrl: getApiBaseUrl(),
    ofetchOptions: { mode: "cors" },
  })

  let recordMap: any = await notion.getPage(pageId, { fetchMissingBlocks: false })
  recordMap = normalizeRecordMap(recordMap)

  for (let i = 0; i < 10; i++) {
    const missing = collectContentBlockIds(recordMap).filter((id) => !recordMap.block[id])
    if (!missing.length) break
    const fetched = await notion.getBlocks(missing).then((r: any) => r.recordMap.block)
    recordMap = normalizeRecordMap({
      ...recordMap,
      block: { ...recordMap.block, ...fetched },
    })
  }

  return recordMap as ExtendedRecordMap
}

function notionTitle(value: any): string {
  const t = value?.properties?.title?.[0]?.[0]
  return typeof t === "string" && t.trim() ? t : "Untitled"
}

/** The parent block of a recordMap is its first block (the page you fetched). */
function rootBlock(recordMap: any) {
  const blocks = recordMap?.block
  if (!blocks) return undefined
  return blocks[Object.keys(blocks)[0]]?.value
}

/** Title of the page a recordMap represents. */
export function getPageTitle(recordMap: any): string {
  return notionTitle(rootBlock(recordMap))
}

/**
 * Ordered list of child pages directly under the page this recordMap represents.
 * Returns [] for a leaf page with no subpages.
 */
export function extractSubPages(recordMap: any): SubPage[] {
  const blocks = recordMap?.block
  const root = rootBlock(recordMap)
  if (!blocks || !Array.isArray(root?.content)) return []

  const subs: SubPage[] = []
  for (const id of root.content) {
    const value = blocks[id]?.value
    if (value?.type === "page") {
      subs.push({ pageId: id, title: notionTitle(value) })
    }
  }
  return subs
}
