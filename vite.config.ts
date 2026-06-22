import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Local CORS bypass for Notion's unofficial API: the app targets `/notion-api/...`
// and the dev/preview server proxies it to www.notion.so, so the browser never
// makes a cross-origin request. In production the host does this (vercel.json
// rewrites / Netlify _redirects).
const notionProxy = {
  "/notion-api": {
    target: "https://www.notion.so",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/notion-api/, ""),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // notion-client references `global` in the browser; map it to globalThis.
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: { port: Number(process.env.PORT) || 5173, proxy: notionProxy },
  // So `vite preview` (production build) can fetch Notion too — mirrors a
  // Vercel/Netlify deploy locally.
  preview: { proxy: notionProxy },
})
