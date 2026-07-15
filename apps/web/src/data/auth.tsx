import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"

interface AuthContextType {
  accessToken: string | null
  isAuthenticated: boolean
  user: any | null
  signIn: () => void
  signOut: () => void
  isReady: boolean
}

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  isAuthenticated: false,
  user: null,
  signIn: () => {},
  signOut: () => {},
  isReady: false,
})

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem("statlens_token"))
  const [user, setUser] = useState<any | null>(() => {
    try {
      const stored = localStorage.getItem("statlens_user")
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [isReady, setIsReady] = useState(false)
  const [tokenClient, setTokenClient] = useState<any>(null)

  useEffect(() => {
    // Load GIS script dynamically
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      const google = (window as any).google
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token)
            localStorage.setItem("statlens_token", tokenResponse.access_token)
            
            // Fetch user info
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            })
            const userData = await res.json()
            setUser(userData)
            localStorage.setItem("statlens_user", JSON.stringify(userData))
          }
        },
      })
      setTokenClient(client)
      setIsReady(true)
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const signIn = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken()
    }
  }

  const signOut = () => {
    if (accessToken) {
      const google = (window as any).google
      google.accounts.oauth2.revoke(accessToken, () => {
        setAccessToken(null)
        setUser(null)
        localStorage.removeItem("statlens_token")
        localStorage.removeItem("statlens_user")
      })
    } else {
      setAccessToken(null)
      setUser(null)
      localStorage.removeItem("statlens_token")
      localStorage.removeItem("statlens_user")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isAuthenticated: !!accessToken,
        user,
        signIn,
        signOut,
        isReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
