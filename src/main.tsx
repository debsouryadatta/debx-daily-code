import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
// react-notion-x core styles + optional code/equation themes
import "react-notion-x/styles.css"
import "prismjs/themes/prism-tomorrow.css"
import "katex/dist/katex.min.css"
import "./notion-overrides.css"

import App from "./App.tsx"
import { ThemeProvider } from "@/lib/theme"
import { PagesProvider } from "@/lib/pages-context"
import { Toaster } from "@/components/ui/sonner"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <PagesProvider>
        <App />
        <Toaster richColors position="top-center" />
      </PagesProvider>
    </ThemeProvider>
  </StrictMode>,
)
