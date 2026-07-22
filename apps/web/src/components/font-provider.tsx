import React, { createContext, useContext, useEffect, useState } from "react"

interface FontProviderProps {
  children: React.ReactNode
  defaultFont?: string
  storageKey?: string
}

interface FontProviderState {
  font: string
  setFont: (font: string) => void
}

const initialState: FontProviderState = {
  font: "Merriweather",
  setFont: () => null,
}

const FontProviderContext = createContext<FontProviderState>(initialState)

export function FontProvider({
  children,
  defaultFont = "Merriweather",
  storageKey = "statlens-ui-font",
  ...props
}: FontProviderProps) {
  const [font, setFont] = useState<string>(
    () => (localStorage.getItem(storageKey) as string) || defaultFont
  )

  useEffect(() => {
    const root = window.document.documentElement
    // Fallback to serif if Merriweather or another serif is chosen, else sans-serif
    const isSerif = font === "Merriweather" || font.includes("Serif") || font.includes("Slab")
    root.style.setProperty("--font-ui", `"${font}", ${isSerif ? "serif" : "sans-serif"}`)
    
    // Also apply it to AG Grid CSS variables so data tables match
    root.style.setProperty("--ag-font-family", `"${font}", ${isSerif ? "serif" : "sans-serif"}`)
    
    localStorage.setItem(storageKey, font)
  }, [font, storageKey])

  return (
    <FontProviderContext.Provider {...props} value={{ font, setFont }}>
      {children}
    </FontProviderContext.Provider>
  )
}

export const useFont = () => {
  const context = useContext(FontProviderContext)
  if (context === undefined)
    throw new Error("useFont must be used within a FontProvider")
  return context
}
