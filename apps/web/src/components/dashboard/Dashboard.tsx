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
      <div className="flex flex-col items-center justify-center p-24 text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to StatLens</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          A free, browser-only statistical software for all your statistics needs. Sign in with Google to create workbooks that sync securely to your own Google Drive.
        </p>
        <Button onClick={signIn} size="lg">Sign In with Google</Button>
      </div>
    )
  }

  return (
    <div className="container p-8 mx-auto max-w-5xl">
      <div className="flex items-center justify-between mb-8">
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
        <div className="text-muted-foreground p-8 text-center">Loading from Drive...</div>
      )}

      {!isLoading && workbooks.length === 0 && (
        <div className="flex flex-col items-center justify-center p-24 border border-dashed rounded-lg bg-card">
          <p className="text-muted-foreground mb-4">No workbooks found in your StatLens Drive folder.</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="secondary">Create your first workbook</Button>
        </div>
      )}

      {!isLoading && workbooks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workbooks.map(wb => (
            <ContextMenu key={wb.id}>
              <ContextMenuTrigger asChild>
                <div 
                  className="border rounded-lg p-6 bg-card hover:border-primary transition-colors cursor-pointer flex flex-col justify-between h-32"
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
