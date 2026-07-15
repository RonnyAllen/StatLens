import { ThemeProvider } from "./components/theme-provider"
import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './data/auth'
import { Dashboard } from './components/dashboard/Dashboard'
import { Workspace } from './components/workspace/Workspace'
import { Button } from './components/ui/button'
import { useTheme } from './components/theme-provider'
import { statsEngine } from './stats/engine'
import { Sun, Moon } from 'lucide-react'

// A wrapper to protect routes that require auth
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken, isReady } = useAuth()
  if (!isReady) return null // wait for auth init
  if (!accessToken) return <Navigate to="/" replace />
  return <>{children}</>
}

// A wrapper to skip dashboard if not authed
function RootRedirect() {
  const { accessToken, isReady } = useAuth()
  if (!isReady) return null
  if (accessToken) return <Navigate to="/dashboard" replace />
  return <Dashboard /> // Render dashboard which shows "Sign In" when not authed
}

function ProfileMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
        title="Account options"
      >
        {user.name?.charAt(0).toUpperCase() || "U"}
      </button>
      
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-md shadow-lg z-50 p-1 flex flex-col gap-1">
          <div className="px-3 py-2 text-sm border-b border-border mb-1">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <button 
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-destructive/10 text-destructive rounded-sm transition-colors cursor-pointer font-medium"
          >
            Log out from Google
          </button>
        </div>
      )}
    </div>
  )
}

function AppContent() {
  const [statsState, setStatsState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    // Bootstrap Pyodide stats engine on load
    statsEngine.init()
      .then(() => {
        setStatsState("ready")
      })
      .catch((err: any) => {
        console.error("Failed to initialize stats engine", err)
        setStatsState("error")
      })
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <header className="border-b px-6 py-3 flex items-center justify-between shrink-0">
        <Link to="/dashboard" className="flex items-center gap-3 text-xl font-bold hover:opacity-80 transition-opacity">
          <img src={`${import.meta.env.BASE_URL}StatLens.ico`} alt="StatLens Logo" className="w-8 h-8 object-contain rounded-full shadow-sm bg-black" />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            StatLens
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {statsState === "loading" && <span className="text-xs text-muted-foreground animate-pulse">Loading engine...</span>}
          {statsState === "ready" && <span className="text-xs text-green-600 dark:text-green-400">Engine ready</span>}
          {statsState === "error" && <span className="text-xs text-destructive">Engine error</span>}
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          } />
          <Route path="/workbook/:id" element={
            <RequireAuth>
              <Workspace />
            </RequireAuth>
          } />
        </Routes>
      </main>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} title="Toggle Theme">
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="statlens-ui-theme">
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
