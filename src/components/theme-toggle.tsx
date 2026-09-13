import { Monitor, Moon, Sun } from "lucide-react"
import { toast } from "sonner"
import { useOptionalPages } from "@/lib/pages-context"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/lib/theme"

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const pages = useOptionalPages()
  const changeTheme = (next: "light" | "dark" | "system") => {
    if (pages) void pages.setThemePreference(next).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't save theme."))
    else setTheme(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" aria-label="Toggle theme" className={className} />}
      >
        <Sun className="size-4 scale-100 dark:scale-0" />
        <Moon className="absolute size-4 scale-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem checked={theme === "light"} onCheckedChange={() => changeTheme("light")}>
          <Sun className="mr-2 size-4" /> Light
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={theme === "dark"} onCheckedChange={() => changeTheme("dark")}>
          <Moon className="mr-2 size-4" /> Dark
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={theme === "system"} onCheckedChange={() => changeTheme("system")}>
          <Monitor className="mr-2 size-4" /> System
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
