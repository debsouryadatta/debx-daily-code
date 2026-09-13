"use client"

import type { ReactNode } from "react"

import "../index.css"

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>DebX DailyCode</title>
        <meta
          name="description"
          content="Read your published Notion pages with Prev/Next navigation."
        />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
