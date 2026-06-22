/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional production CORS-proxy origin for Notion (e.g. a Cloudflare Worker). */
  readonly VITE_NOTION_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
