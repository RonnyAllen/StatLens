import { ThemeProvider } from "./components/theme-provider"
import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './data/auth'
import { Dashboard } from './components/dashboard/Dashboard'
import { Workspace } from './components/workspace/Workspace'
import { AboutPage } from './pages/AboutPage'
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
        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
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
  const [loadMessage, setLoadMessage] = useState("Initializing...")

  useEffect(() => {
    // Bootstrap Pyodide stats engine on load
    statsEngine.init((p, m) => setLoadMessage(m))
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
      <header className="border-b border-b-blue-500/30 dark:border-b-blue-400/20 px-4 py-2 flex items-center justify-between shrink-0 bg-gradient-to-r from-background via-background to-blue-50/30 dark:to-blue-950/20">
        <Link to="/dashboard" className="flex items-center gap-3 text-lg font-bold hover:opacity-80 transition-opacity">
          <img src={`${import.meta.env.BASE_URL}StatLens.ico`} alt="StatLens Logo" className="w-8 h-8 object-contain rounded-full shadow-sm bg-black" />
          <span className="text-primary text-xl">
            StatLens
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {statsState === "loading" && <span className="text-xs font-medium text-foreground/70 animate-pulse">{loadMessage}</span>}
          {statsState === "ready" && <span className="text-xs font-medium text-green-700 dark:text-green-400">Engine ready</span>}
          {statsState === "error" && <span className="text-xs font-medium text-red-600 dark:text-red-400">Engine error</span>}
          <Link to="/about" className="text-sm font-medium px-3 py-1 rounded-full bg-blue-100/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200/80 dark:hover:bg-blue-800/40 transition-colors">About</Link>
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
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} title="Toggle Theme" className="w-10 h-10">
      {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
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
