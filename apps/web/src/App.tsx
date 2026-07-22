import { ThemeProvider } from "./components/theme-provider"
import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './data/auth'
import { Dashboard } from './components/dashboard/Dashboard'
import { Workspace } from './components/workspace/Workspace'
import { AboutPage } from './pages/AboutPage'
import { ProfilePage } from './pages/ProfilePage'
import { Button } from './components/ui/button'
import { useTheme } from './components/theme-provider'
import { statsEngine } from './stats/engine'
import { DriveAPI } from './data/driveApi'
import { Sun, Moon, Bug } from 'lucide-react'
import { FontProvider, useFont } from "./components/font-provider"
import { SearchableSelect, type Option } from "./components/ui/searchable-select"
import { Footer } from "./components/layout/Footer"
import { Toaster } from 'sonner'

const UI_FONT_OPTIONS: Option[] = [
  { label: "Inter", value: "Inter", group: "Sans-Serif", style: { fontFamily: "Inter" } },
  { label: "Roboto", value: "Roboto", group: "Sans-Serif", style: { fontFamily: "Roboto" } },
  { label: "Lato", value: "Lato", group: "Sans-Serif", style: { fontFamily: "Lato" } },
  { label: "Open Sans", value: "Open Sans", group: "Sans-Serif", style: { fontFamily: "Open Sans" } },
  { label: "Source Sans 3", value: "Source Sans 3", group: "Sans-Serif", style: { fontFamily: "Source Sans 3" } },
  { label: "Nunito Sans", value: "Nunito Sans", group: "Sans-Serif", style: { fontFamily: "Nunito Sans" } },
  { label: "Montserrat", value: "Montserrat", group: "Sans-Serif", style: { fontFamily: "Montserrat" } },
  { label: "Arial (Arimo)", value: "Arimo", group: "Sans-Serif", style: { fontFamily: "Arimo" } },
  { label: "IBM Plex Sans", value: "IBM Plex Sans", group: "Sans-Serif", style: { fontFamily: "IBM Plex Sans" } },
  { label: "Merriweather", value: "Merriweather", group: "Serif", style: { fontFamily: "Merriweather" } },
  { label: "Roboto Slab", value: "Roboto Slab", group: "Serif", style: { fontFamily: "Roboto Slab" } },
  { label: "IBM Plex Serif", value: "IBM Plex Serif", group: "Serif", style: { fontFamily: "IBM Plex Serif" } },
]

function GlobalFontSelector() {
  const { font, setFont } = useFont()
  return (
    <div className="w-48 ml-4 hidden sm:block">
      <SearchableSelect 
        options={UI_FONT_OPTIONS}
        value={font}
        onChange={setFont}
        placeholder="UI Font..."
      />
    </div>
  )
}

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

function ProfileMenu({ customImage }: { customImage?: string }) {
  const navigate = useNavigate()
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
        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring overflow-hidden"
        title="Account options"
      >
        {customImage ? (
           <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
        ) : user.picture ? (
           <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
        ) : (
           user.name?.charAt(0).toUpperCase() || "U"
        )}
      </button>
      
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-md shadow-lg z-50 p-1 flex flex-col gap-1">
          <button
            onClick={() => { setOpen(false); navigate("/profile"); }}
            className="w-full text-left px-3 py-2 text-sm border-b border-border mb-1 hover:bg-muted transition-colors cursor-pointer"
          >
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </button>
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

function hexToHSL(hex: string, isDark: boolean = false) {
  let r = 0, g = 0, b = 0;
  if (hex.length == 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length == 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  if (isDark) {
    l = 1 - l;
  }
  return `${(h * 360).toFixed(0)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

function AppContent() {
  const { accessToken } = useAuth()
  const { theme } = useTheme()
  const [statsState, setStatsState] = useState<"loading" | "ready" | "error">("loading")
  const [loadMessage, setLoadMessage] = useState("Initializing...")
  const [userProfile, setUserProfile] = useState<any>(null)

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  useEffect(() => {
    const fetchProfile = () => {
      if (accessToken) {
        const drive = new DriveAPI(accessToken)
        drive.findOrCreateStatLensFolder().then(fId => {
          drive.getProfile(fId).then(async profile => {
            if (profile?.imageId) {
              try {
                const imgUrl = await drive.getProfileImage(profile.imageId)
                profile.profileImageUrl = imgUrl
              } catch(e) {}
            }
            setUserProfile(profile)
            if (profile?.accentColor) {
               document.documentElement.style.setProperty('--primary', hexToHSL(profile.accentColor, isDark))
            }
          }).catch(() => {})
        }).catch(() => {})
      }
    }
    
    fetchProfile()
    window.addEventListener('statlens-profile-updated', fetchProfile)
    return () => window.removeEventListener('statlens-profile-updated', fetchProfile)
  }, [accessToken])

  // Re-run color calculation when theme changes
  useEffect(() => {
    if (userProfile?.accentColor) {
      document.documentElement.style.setProperty('--primary', hexToHSL(userProfile.accentColor, isDark))
    }
  }, [isDark, userProfile])

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
    <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300 overflow-hidden">
      <header className="border-b border-b-blue-500/30 dark:border-b-blue-400/20 px-4 py-2 flex items-center justify-between shrink-0 bg-gradient-to-r from-background via-background to-blue-50/30 dark:to-blue-950/20 z-50">
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="flex items-center gap-3 text-lg font-bold hover:opacity-80 transition-opacity">
            <img src={`${import.meta.env.BASE_URL}StatLens.ico`} alt="StatLens Logo" className="w-8 h-8 object-contain rounded-full shadow-sm bg-black" />
            <span className="text-primary text-xl hidden sm:inline">
              StatLens
            </span>
          </Link>
          <GlobalFontSelector />
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {statsState === "loading" && <span className="text-xs font-medium text-foreground/70 animate-pulse hidden md:inline">{loadMessage}</span>}
          {statsState === "ready" && <span className="text-xs font-medium text-green-700 dark:text-green-400 hidden md:inline">Engine ready</span>}
          {statsState === "error" && <span className="text-xs font-medium text-red-600 dark:text-red-400 hidden md:inline">Engine error</span>}
          
          <Button variant="outline" size="sm" asChild className="hidden sm:flex gap-2">
            <a href="https://github.com/ronnyallen/statlens/issues" target="_blank" rel="noopener noreferrer">
              <Bug className="w-4 h-4" />
              Report Issue
            </a>
          </Button>

          <Link to="/about" className="text-sm font-medium px-3 py-1.5 rounded-full bg-blue-100/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200/80 dark:hover:bg-blue-800/40 transition-colors">About</Link>
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col relative">
        <div className="flex-1 shrink-0 flex flex-col">
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dashboard" element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            } />
            <Route path="/profile" element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            } />
            <Route path="/workbook/:id" element={
              <RequireAuth>
                <Workspace />
              </RequireAuth>
            } />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </div>
        <Footer />
      </main>
      <Toaster richColors position="bottom-right" />
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
      <FontProvider>
        <AuthProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AppContent />
          </BrowserRouter>
        </AuthProvider>
      </FontProvider>
    </ThemeProvider>
  )
}

export default App
