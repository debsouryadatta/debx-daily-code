# DebX DailyCode

A clean, no-backend reader for your **published Notion pages** — built to feel like
the "new mode" reader in [code100x/daily-code](https://github.com/code100x/daily-code):
a floating top appbar, full-page Notion rendering, and **Prev / Next** navigation
between every page you add.

You paste links to published Notion pages, they're saved in **localStorage**, and the
app fetches + renders each one on demand with [react-notion-x](https://github.com/NotionX/react-notion-x).
No database, no server of your own.

## Features

- 📄 Add any **published** Notion page by URL (Share → Publish in Notion).
- 🗂️ **Subpages become a reader**: add a parent page and its child pages turn into an
  ordered set you flip through — no clicking out to notion.site.
- ⬅️ ➡️ Prev/Next buttons, a table-of-contents menu, **and** keyboard arrow keys.
- 🖱️ **Drag to reorder**, **sort** (date added / title / last edited), and switch
  **list / grid** view — every preference is remembered.
- ↕️ **Export / import** your whole setup (pages + preferences) as one JSON file to
  move it between browsers or devices.
- 🌗 Light / dark / system theme.
- 💾 Everything lives in a single `localStorage` key — no accounts, no backend.
- 🎨 React + TypeScript + Tailwind v4 + shadcn/ui (Base UI).

## Tech

| | |
|---|---|
| Build | Vite + React 19 + TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (`base-nova` / Base UI), lucide icons |
| Notion | `react-notion-x` + `notion-client` (v7), `notion-utils` |
| Routing | `react-router-dom` |

## Run locally

```bash
npm install
npm run dev
```

Open the dev URL, click **Add page**, paste a published Notion link, and read.
Local dev needs no proxy — Vite proxies Notion's API for you (see `vite.config.ts`).

## How it works

A saved entry is a **collection**: the parent page plus its ordered child pages
(extracted from the parent's recordMap). The reader opens the first child and
Prev/Next moves through them — exactly like daily-code's track → problems. A page
with no children is read as a single page. Internal Notion links that point at a
sibling page navigate in-app; everything else opens on notion.so in a new tab.

1. `parsePageId` (notion-utils) extracts the page id from the pasted URL.
2. `notion-client` fetches the page's `recordMap`. Two non-obvious fixes live in
   [`src/lib/notion.ts`](src/lib/notion.ts):
   - **`mode: "cors"`** — notion-client hardcodes `mode: "no-cors"`, which makes the
     browser strip `Content-Type: application/json` and Notion 400s. We override it.
   - **`value.value` normalization** (ported from daily-code) — Notion now nests blocks
     one level deeper; without flattening + re-fetching missing children, pages render blank.
3. `react-notion-x` renders the normalized `recordMap` (`fullPage`, `disableHeader`),
   wrapped by our floating appbar + Prev/Next toolbar.

## Deploy

The app is 100% static, but Notion's API can't be called directly from a browser
(no CORS). A proxy sits in between — and on Vercel/Netlify the host *is* the proxy.

### Vercel or Netlify (recommended — zero config)

Just deploy `dist/`. The included [`vercel.json`](vercel.json) /
[`public/_redirects`](public/_redirects) proxy `/notion-api/*` to `www.notion.so`,
so the browser only ever calls your own origin (same-origin → no CORS). Nothing to
paste in Settings, no Worker, no serverless function.

```bash
npm run build   # outputs dist/   (Vercel detects Vite automatically)
```

The same files also serve `index.html` for SPA routes like `/read/:id` on refresh.

### Other static hosts (e.g. GitHub Pages)

Hosts that can't proxy need an external CORS proxy. Deploy the included
~30-line Cloudflare Worker:

```bash
npx wrangler deploy worker/notion-proxy.js --name notion-proxy --compatibility-date 2024-01-01
```

Then set `VITE_NOTION_PROXY` to its `https://notion-proxy.<you>.workers.dev` URL
before `npm run build` — requests go to `{VITE_NOTION_PROXY}/api/v3/…`.

## Notes

- Only **publicly published** pages work (no auth token is ever used or needed).
- Internal Notion links open the original page on notion.so.
