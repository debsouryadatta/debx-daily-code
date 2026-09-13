"use client"

import App from "./App"
import { ThemeProvider } from "@/lib/theme"
import { PagesProvider } from "@/lib/pages-context"
import { AuthGate } from "@/components/auth-gate"
import { Toaster } from "@/components/ui/sonner"

export default function ClientApp() {
  return (
    <ThemeProvider>
      <AuthGate>
        <PagesProvider>
          <App />
        </PagesProvider>
      </AuthGate>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  )
}
