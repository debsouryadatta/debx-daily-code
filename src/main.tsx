import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

// index.css also pulls in react-notion-x / prism / katex styles and the Notion overrides.
import "./index.css"

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
