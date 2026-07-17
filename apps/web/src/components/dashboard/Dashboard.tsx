import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/data/auth"
import { DriveAPI } from "@/data/driveApi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export function Dashboard() {
  const navigate = useNavigate()
  const { accessToken, user, isReady, signIn } = useAuth()
  const [workbooks, setWorkbooks] = useState<any[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newWorkbookName, setNewWorkbookName] = useState("Untitled Workbook")
  const [isCreating, setIsCreating] = useState(false)
  
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)

  useEffect(() => {
    if (accessToken) {
      loadDashboard()
    }
  }, [accessToken])

  async function loadDashboard() {
    setIsLoading(true)
    setError(null)
    try {
      const drive = new DriveAPI(accessToken!)
      const fId = await drive.findOrCreateStatLensFolder()
      setFolderId(fId)
      
      const files = await drive.listWorkbooks(fId)
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
      await loadDashboard()
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
      await loadDashboard()
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
      await loadDashboard()
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
      await loadDashboard()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsRenaming(false)
    }
  }

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

  return (
    <div className="container p-4 md:p-6 mx-auto max-w-5xl animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back, {user?.name || "Researcher"}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} disabled={isLoading}>
          New Workbook
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border-destructive border p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-6 bg-card h-32 flex flex-col justify-between">
              <div className="h-6 bg-muted rounded animate-pulse w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && workbooks.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-card animate-in-up">
          <p className="text-muted-foreground mb-4">No workbooks found in your StatLens Drive folder.</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="secondary" className="lift">Create your first workbook</Button>
        </div>
      )}

      {!isLoading && workbooks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workbooks.map((wb, idx) => (
            <ContextMenu key={wb.id}>
              <ContextMenuTrigger asChild>
                <div 
                  className="border rounded-lg p-4 bg-card hover:border-primary transition-colors cursor-pointer flex flex-col justify-between h-28 lift animate-in-up border-l-4 border-l-blue-500/60 dark:border-l-blue-400/50"
                  style={{ animationDelay: `${idx * 30}ms` }}
                  onClick={() => navigate(`/workbook/${wb.id}`)}
                >
                  <h3 className="font-semibold text-lg truncate mb-2">{wb.name.replace('.statlens', '')}</h3>
                  <p className="text-xs text-muted-foreground">
                    Modified: {new Date(wb.modifiedTime).toLocaleDateString()}
                  </p>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={() => {
                  window.open(`/workbook/${wb.id}`, '_blank')
                }}>Open in new tab</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => {
                  setRenameValue(wb.name.replace('.statlens', ''))
                  setRenameTargetId(wb.id)
                }}>Rename</ContextMenuItem>
                <ContextMenuItem onClick={() => handleDuplicate(wb.id, wb.name)}>
                  Duplicate
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem 
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={() => handleDelete(wb.id)}
                >
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
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
