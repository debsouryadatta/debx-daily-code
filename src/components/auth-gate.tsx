"use client"

import { createContext, Fragment, useContext, useState, type FormEvent, type ReactNode } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"

type AccountUser = { id: string; name: string; email: string }
const AccountContext = createContext<{ user: AccountUser } | null>(null)

export function useAccount() {
  const account = useContext(AccountContext)
  if (!account) throw new Error("useAccount must be used within AuthGate")
  return account
}

function AuthForm() {
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get("email") || "").trim()
    const password = String(data.get("password") || "")
    const name = String(data.get("name") || "").trim()
    if (signup && !name) {
      setError("Enter your name.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const result = signup
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password })
      if (result.error) setError(result.error.message || "Unable to sign in. Please try again.")
    } catch {
      setError("Unable to reach the server. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">DX</div>
          <span className="text-lg font-semibold tracking-tight">DebX DailyCode</span>
        </div>
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to keep your Notion pages with you on every device.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {signup && (
          <div className="space-y-2">
            <Label htmlFor="auth-name">Name</Label>
            <Input id="auth-name" name="name" autoComplete="name" required maxLength={100} disabled={busy} className="h-10" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input id="auth-email" name="email" type="email" autoComplete="email" required disabled={busy} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input id="auth-password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} maxLength={128} disabled={busy} className="h-10" />
          {signup && <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="h-10 w-full">{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</Button>
      </form>
      <Button variant="link" className="mt-4" disabled={busy} onClick={() => { setSignup(!signup); setError("") }}>
        {signup ? "Already have an account? Sign in" : "New here? Create an account"}
      </Button>
    </main>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { data: session, isPending, error, refetch } = authClient.useSession()

  if (isPending) return <div role="status" className="grid min-h-svh place-items-center text-sm text-muted-foreground">Opening your account…</div>
  if (error) return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-5 text-center">
      <p role="alert">We couldn't check your session. Please try again.</p>
      <Button onClick={() => void refetch()}>Try again</Button>
    </main>
  )
  if (!session) return <AuthForm />
  return (
    <AccountContext.Provider value={{ user: session.user }}>
      <Fragment key={session.user.id}>{children}</Fragment>
    </AccountContext.Provider>
  )
}
