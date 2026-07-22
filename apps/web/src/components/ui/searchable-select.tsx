import React, { useState, useRef, useEffect, useMemo } from "react"
import { Search, ChevronDown, Check } from "lucide-react"

export interface Option {
  label: string
  value: string
  group?: string
  style?: React.CSSProperties
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchableSelect({ options, value, onChange, placeholder = "Select...", className = "" }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value])

  const filteredOptions = useMemo(() => {
    if (!search) return options
    const lowerSearch = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(lowerSearch) || o.value.toLowerCase().includes(lowerSearch))
  }, [options, search])

  const groupedOptions = useMemo(() => {
    const groups: Record<string, Option[]> = { _ungrouped: [] }
    for (const opt of filteredOptions) {
      const g = opt.group || "_ungrouped"
      if (!groups[g]) groups[g] = []
      groups[g].push(opt)
    }
    return groups
  }, [filteredOptions])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-2 border rounded-md text-sm bg-background hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => {
          setIsOpen(!isOpen)
          setSearch("")
        }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full min-w-[200px] mt-1 bg-popover text-popover-foreground border rounded-md shadow-md outline-none">
          <div className="flex items-center px-2 py-2 border-b">
            <Search className="w-4 h-4 mr-2 opacity-50" />
            <input
              type="text"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="p-2 text-sm text-center text-muted-foreground">No results found.</p>
            ) : (
              Object.entries(groupedOptions).map(([group, opts]) => {
                if (opts.length === 0) return null
                return (
                  <div key={group} className="mb-1">
                    {group !== "_ungrouped" && (
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group}
                      </div>
                    )}
                    {opts.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground ${
                          value === opt.value ? "bg-accent/50 text-accent-foreground font-medium" : ""
                        }`}
                        onClick={() => {
                          onChange(opt.value)
                          setIsOpen(false)
                        }}
                      >
                        <span className="truncate" style={opt.style}>{opt.label}</span>
                        {value === opt.value && <Check className="w-4 h-4 ml-2 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
