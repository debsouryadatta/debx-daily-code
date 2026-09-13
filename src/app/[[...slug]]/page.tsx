"use client"

import dynamic from "next/dynamic"

// Keep the existing SPA browser-only, including its localStorage providers.
// React Router handles navigation after this entry point has mounted.
const ClientApp = dynamic(() => import("@/client-app"), { ssr: false })

export default function Page() {
  return <ClientApp />
}
