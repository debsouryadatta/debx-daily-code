/**
 * Cloudflare Worker — CORS proxy for Notion's unofficial API.
 *
 * Notion's https://www.notion.so/api/v3/* endpoints don't send CORS headers,
 * so a static site can't call them from the browser. This worker forwards the
 * request (method + JSON body) to Notion and adds the CORS headers back.
 *
 * Deploy:
 *   npm i -g wrangler        # or: npx wrangler ...
 *   wrangler deploy worker/notion-proxy.js --name notion-proxy --compatibility-date 2024-01-01
 *
 * Then paste the resulting https://notion-proxy.<you>.workers.dev URL into the
 * app's Settings dialog (or set VITE_NOTION_PROXY at build time).
 *
 * Tip: replace "*" below with your site's origin to stop others using your quota.
 */
const ALLOW_ORIGIN = "*"

function corsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") || "Content-Type",
  }
}

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req) })
    }

    const url = new URL(req.url)
    // url.pathname is "/api/v3/<endpoint>" — forward it verbatim to Notion.
    const target = "https://www.notion.so" + url.pathname + url.search

    const upstream = await fetch(target, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    })

    const res = new Response(upstream.body, upstream)
    const cors = corsHeaders(req)
    Object.keys(cors).forEach((k) => res.headers.set(k, cors[k]))
    return res
  },
}
