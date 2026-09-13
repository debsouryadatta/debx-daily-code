"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { useAccount } from "@/components/auth-gate"
import { Button } from "@/components/ui/button"

export function AccountMenu() {
  const { user } = useAccount()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    if (busy) return
    setBusy(true)
    try {
      const result = await authClient.signOut()
      if (result.error) toast.error(result.error.message || "Unable to sign out. Please try again.")
    } catch {
      toast.error("Unable to reach the server. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden max-w-36 truncate text-xs text-muted-foreground sm:block" title={user.email}>{user.name || user.email}</span>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void signOut()} title={`Sign out of ${user.email}`}>
        <LogOut />{busy ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  )
}
