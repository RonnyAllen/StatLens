import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/data/auth"
import { DriveAPI } from "@/data/driveApi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, LayoutGrid, List as ListIcon, MessageSquare, Tag, FileSpreadsheet, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { PropertiesPanel, PRESET_COLORS } from "./PropertiesPanel"
import { TagSelectorDialog } from "./TagSelectorDialog"

type SortOption = "modDesc" | "modAsc" | "creDesc" | "creAsc" | "nameAsc" | "nameDesc"
type GroupOption = "none" | "tags"
type ViewMode = "tiles" | "details"

export function Dashboard() {
  const navigate = useNavigate()
  const { accessToken, user, isReady, signIn } = useAuth()
  
  const [workbooks, setWorkbooks] = useState<any[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [viewMode, setViewMode] = useState<'tiles' | 'details'>('details')
  const [sortBy, setSortBy] = useState<SortOption>("modDesc")
  const [groupBy, setGroupBy] = useState<GroupOption>("none")

  // Properties Panel
  const [selectedPropertiesWorkbook, setSelectedPropertiesWorkbook] = useState<any | null>(null)
  const [selectedTagWorkbook, setSelectedTagWorkbook] = useState<any | null>(null)

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newWorkbookName, setNewWorkbookName] = useState("Untitled Workbook")
  const [isCreating, setIsCreating] = useState(false)
  
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  useEffect(() => {
    if (accessToken) {
      loadDashboard(debouncedSearch)
    }
  }, [accessToken, debouncedSearch])

  async function loadDashboard(search: string = "") {
    setIsLoading(true)
    setError(null)
    try {
      const drive = new DriveAPI(accessToken!)
      const fId = await drive.findOrCreateStatLensFolder()
      setFolderId(fId)
      
      const files = await drive.listWorkbooks(fId, search)
      setWorkbooks(files)
    } catch (err: any) {
      if (err.message === "AUTH_REQUIRED") {
        signIn()
      } else {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateWorkbook() {
    if (!folderId || !accessToken || !newWorkbookName.trim()) return
    setIsCreating(true)
    try {
      const drive = new DriveAPI(accessToken)
      const name = newWorkbookName.trim()
      const emptyWorkbook = {
        schemaVersion: "1",
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sheets: [],
        analyses: [],
        graphs: [],
        appTheme: "system"
      }
      
      await drive.createWorkbook(folderId, name, emptyWorkbook)
      setIsDialogOpen(false)
      setNewWorkbookName("Untitled Workbook")
      await loadDashboard(debouncedSearch)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return
    if (!confirm("Are you sure you want to delete this workbook? This cannot be undone.")) return
    
    setIsLoading(true)
    try {
      const drive = new DriveAPI(accessToken)
      await drive.deleteWorkbook(id)
      await loadDashboard(debouncedSearch)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  async function handleDuplicate(id: string, originalName: string) {
    if (!accessToken) return
    setIsLoading(true)
    try {
      const drive = new DriveAPI(accessToken)
      await drive.duplicateWorkbook(id, `Copy of ${originalName.replace('.statlens', '')}`)
      await loadDashboard(debouncedSearch)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  async function handleRename() {
    if (!accessToken || !renameTargetId || !renameValue.trim()) return
    setIsRenaming(true)
    try {
      const drive = new DriveAPI(accessToken)
      await drive.renameWorkbook(renameTargetId, renameValue.trim())
      setRenameTargetId(null)
      await loadDashboard(debouncedSearch)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsRenaming(false)
    }
  }

  // Sorting & Grouping
  const processedWorkbooks = useMemo(() => {
    let result = [...workbooks]
    
    result.sort((a, b) => {
      if (sortBy === "nameAsc") return a.name.localeCompare(b.name)
      if (sortBy === "nameDesc") return b.name.localeCompare(a.name)
      
      const aMod = new Date(a.modifiedTime).getTime()
      const bMod = new Date(b.modifiedTime).getTime()
      if (sortBy === "modDesc") return bMod - aMod
      if (sortBy === "modAsc") return aMod - bMod
      
      const aCre = a.createdTime ? new Date(a.createdTime).getTime() : 0
      const bCre = b.createdTime ? new Date(b.createdTime).getTime() : 0
      if (sortBy === "creDesc") return bCre - aCre
      if (sortBy === "creAsc") return aCre - bCre
      
      return 0
    })

    if (groupBy === "tags") {
      const grouped: Record<string, any[]> = {}
      result.forEach(wb => {
        const tags = (wb.appProperties?.tags || "").split(",").filter(Boolean)
        if (tags.length === 0) {
          if (!grouped["Untagged"]) grouped["Untagged"] = []
          grouped["Untagged"].push(wb)
        } else {
          tags.forEach((tag: string) => {
            if (!grouped[tag]) grouped[tag] = []
            grouped[tag].push(wb)
          })
        }
      })
      return grouped
    }

    return { "All Workbooks": result }
  }, [workbooks, sortBy, groupBy])

  if (!isReady) {
    return <div className="p-8 text-center text-muted-foreground">Loading identity services...</div>
  }

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
        <div className="flex flex-col items-center justify-center gap-4 mb-8">
          <img src={`${import.meta.env.BASE_URL}StatLens.ico`} alt="StatLens Logo" className="w-20 h-20 object-contain rounded-full shadow-lg bg-black" />
          <h1 className="text-5xl font-bold text-primary tracking-tight">StatLens</h1>
        </div>
        <h2 className="text-2xl font-semibold mb-3">Welcome</h2>
        <p className="text-muted-foreground max-w-md mb-8 text-lg">
          A free, browser-only statistical software for all your statistics needs. Sign in with Google to create workbooks that sync securely to your own Google Drive.
        </p>
        <Button onClick={signIn} size="lg" className="flex items-center gap-3 text-lg h-14 px-8 lift">
          <svg className="w-6 h-6" viewBox="0 0 24 24">
             <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
             <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
             <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
             <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign In with Google
        </Button>
      </div>
    )
  }

  const renderWorkbookCard = (wb: any, idx: number) => {
    const tags = (wb.appProperties?.tags || "").split(",").filter(Boolean)
    const hasComment = !!wb.appProperties?.comment
    
    return (
      <ContextMenu key={wb.id}>
        <ContextMenuTrigger asChild>
          <div 
            className={`border rounded-lg p-4 bg-card hover:border-primary transition-colors cursor-pointer flex justify-between lift animate-in-up border-l-4 border-l-blue-500/60 dark:border-l-blue-400/50 ${viewMode === 'tiles' ? 'flex-col h-32' : 'flex-row h-auto items-center gap-4'}`}
            style={{ animationDelay: `${idx * 20}ms` }}
            onClick={() => navigate(`/workbook/${wb.id}`)}
          >
            <div className={`flex ${viewMode === 'tiles' ? 'flex-col gap-2' : 'flex-1 items-center justify-between gap-4'}`}>
              <div className="flex items-center gap-2 min-w-[200px] xl:min-w-[250px]">
                <FileSpreadsheet className="w-5 h-5 text-blue-500 shrink-0" />
                <h3 className="font-semibold text-lg truncate" style={{ maxWidth: viewMode === 'tiles' ? '200px' : '300px'}}>{wb.name.replace('.statlens', '')}</h3>
              </div>
              
              {viewMode === 'details' && (
                <div className="flex-1 flex gap-4 md:gap-12 items-center justify-start xl:justify-between px-4 overflow-hidden">
                  <div className="flex gap-16 shrink-0 text-xs text-muted-foreground font-medium">
                    <p className="w-40 truncate" title={wb.createdTime ? new Date(wb.createdTime).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}>Created: {wb.createdTime ? new Date(wb.createdTime).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</p>
                    <p className="w-40 truncate" title={wb.modifiedTime ? new Date(wb.modifiedTime).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}>Modified: {wb.modifiedTime ? new Date(wb.modifiedTime).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</p>
                  </div>
                  
                  <div className="flex gap-2 flex-1 flex-wrap items-center justify-end overflow-hidden">
                    {tags.map((t: string) => {
                      const color = PRESET_COLORS.find(c => c.name === t)
                      const badgeClass = color ? color.badge : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800"
                      return (
                        <span key={t} title={t} className={`px-2 py-0.5 rounded-sm text-[10px] font-medium border flex items-center gap-1 shadow-sm ${badgeClass}`}>
                          <Tag className="w-3 h-3" /> {t}
                        </span>
                      )
                    })}
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setSelectedTagWorkbook(wb) }}>
                      <Plus className="w-3 h-3 mr-1" /> Add Tag
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className={`flex items-end ${viewMode === 'tiles' ? 'justify-between w-full' : 'gap-2'}`}>
              {viewMode === 'tiles' && (
                <p className="text-[10px] text-muted-foreground">
                  {new Date(wb.modifiedTime).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
              )}
              
              <div className="flex gap-1 shrink-0">
                {viewMode === 'tiles' && tags.length > 0 && (
                   <div className="flex gap-1 items-center mr-2 flex-wrap max-h-12 overflow-hidden">
                     {tags.map((t: string) => {
                       const color = PRESET_COLORS.find(c => c.name === t)
                       const badgeClass = color ? color.badge : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800"
                       return (
                          <span key={t} title={t} className={`px-1.5 py-0.5 rounded-sm text-[8px] font-medium border flex items-center shadow-sm ${badgeClass}`}>
                            {t}
                          </span>
                       )
                     })}
                   </div>
                )}
                {hasComment && (
                  <span className="flex items-center text-amber-500" title="Has comment">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => window.open(`/workbook/${wb.id}`, '_blank')}>Open in new tab</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => {
            setRenameValue(wb.name.replace('.statlens', ''))
            setRenameTargetId(wb.id)
          }}>Rename</ContextMenuItem>
          <ContextMenuItem onClick={() => handleDuplicate(wb.id, wb.name)}>Duplicate</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setSelectedPropertiesWorkbook(wb)}>Properties</ContextMenuItem>
          <ContextMenuItem onClick={() => setSelectedTagWorkbook(wb)}>Modify Tags</ContextMenuItem>
          <ContextMenuItem onClick={() => setSelectedPropertiesWorkbook(wb)}>Modify Comment</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem 
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => handleDelete(wb.id)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <div className="container p-4 md:p-6 mx-auto max-w-7xl animate-fade-in-up">
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground">Welcome back, {user?.name || "Researcher"}</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} disabled={isLoading}>
            New Workbook
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-3 rounded-lg border shadow-sm">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search workbooks & data tables..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="h-10 px-3 py-2 rounded-md border bg-background text-sm min-w-max"
            >
              <option value="modDesc">Last Modified (Newest)</option>
              <option value="modAsc">Last Modified (Oldest)</option>
              <option value="creDesc">Created On (Newest)</option>
              <option value="creAsc">Created On (Oldest)</option>
              <option value="nameAsc">Name (A-Z)</option>
              <option value="nameDesc">Name (Z-A)</option>
            </select>

            <select 
              value={groupBy} 
              onChange={e => setGroupBy(e.target.value as GroupOption)}
              className="h-10 px-3 py-2 rounded-md border bg-background text-sm min-w-max"
            >
              <option value="none">No Grouping</option>
              <option value="tags">Group by Tags</option>
            </select>

            <div className="flex items-center border rounded-md ml-auto md:ml-2 bg-background p-1 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className={`w-8 h-8 rounded-sm ${viewMode === 'tiles' ? 'bg-muted' : ''}`}
                onClick={() => setViewMode("tiles")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`w-8 h-8 rounded-sm ${viewMode === 'details' ? 'bg-muted' : ''}`}
                onClick={() => setViewMode("details")}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border-destructive border p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      )}

      {!isLoading && workbooks.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-card animate-in-up">
          <p className="text-muted-foreground mb-4">No workbooks found in your StatLens Drive folder matching your search.</p>
          {!searchQuery && <Button onClick={() => setIsDialogOpen(true)} variant="secondary" className="lift">Create your first workbook</Button>}
        </div>
      )}

      {!isLoading && workbooks.length > 0 && (
        <div className="space-y-8 pb-12">
          {Object.entries(processedWorkbooks).map(([groupName, items], gIdx) => (
             <div key={groupName} className="space-y-4">
               {groupBy !== "none" && <h3 className="text-lg font-semibold border-b pb-2 text-primary">{groupName}</h3>}
               <div className={viewMode === "tiles" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
                 {items.map((wb, idx) => renderWorkbookCard(wb, gIdx * 10 + idx))}
               </div>
             </div>
          ))}
        </div>
      )}

      {/* Properties Panel */}
      {selectedPropertiesWorkbook && (
        <PropertiesPanel 
          workbook={selectedPropertiesWorkbook} 
          onClose={() => setSelectedPropertiesWorkbook(null)} 
          onUpdate={() => {
            setSelectedPropertiesWorkbook(null)
            loadDashboard(debouncedSearch)
          }} 
        />
      )}

      {/* Tag Selector */}
      {selectedTagWorkbook && (
        <TagSelectorDialog 
          workbook={selectedTagWorkbook} 
          onClose={() => setSelectedTagWorkbook(null)} 
          onUpdate={() => {
            setSelectedTagWorkbook(null)
            loadDashboard(debouncedSearch)
          }} 
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workbook</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newWorkbookName}
              onChange={(e) => setNewWorkbookName(e.target.value)}
              placeholder="Workbook name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateWorkbook()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkbook} disabled={isCreating || !newWorkbookName.trim()}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTargetId} onOpenChange={(open) => !open && setRenameTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Workbook</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Workbook name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRename()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTargetId(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming ? "Renaming..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
