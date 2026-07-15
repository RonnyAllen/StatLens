import { useAuth } from "@/data/auth"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

export function TopBar() {
  const { user, signIn, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="font-bold text-lg tracking-tight hover:text-primary/80 transition-colors cursor-pointer">StatLens</Link>
        </div>
        
        <div className="flex items-center gap-4 px-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? "Light Mode" : "Dark Mode"}
          </Button>
          
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user.name}</span>
              <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
            </div>
          ) : (
            <Button size="sm" onClick={signIn}>Sign In</Button>
          )}
        </div>
      </div>
    </header>
  )
}
