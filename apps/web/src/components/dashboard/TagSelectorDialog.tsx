import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PRESET_COLORS } from "./PropertiesPanel"
import { DriveAPI } from "@/data/driveApi"
import { useAuth } from "@/data/auth"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface TagSelectorDialogProps {
  workbook: any
  onClose: () => void
  onUpdate: () => void
}

export function TagSelectorDialog({ workbook, onClose, onUpdate }: TagSelectorDialogProps) {
  const { accessToken } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [tags, setTags] = useState<string[]>((workbook.appProperties?.tags || "").split(",").filter(Boolean).filter((t: string) => PRESET_COLORS.some(c => c.name === t)))

  useEffect(() => {
    setTags((workbook.appProperties?.tags || "").split(",").filter(Boolean).filter((t: string) => PRESET_COLORS.some(c => c.name === t)))
  }, [workbook])

  const handleSave = async () => {
    if (!accessToken) return
    setIsSaving(true)
    try {
      const drive = new DriveAPI(accessToken)
      await drive.updateWorkbookMetadata(workbook.id, {
        tags: tags.length > 0 ? tags.join(",") : null
      })
      toast.success("Tags updated")
      onUpdate()
    } catch (e) {
      console.error(e)
      toast.error("Failed to update tags")
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTag = (tagName: string) => {
    if (tags.includes(tagName)) {
      setTags(tags.filter(t => t !== tagName))
    } else {
      setTags([...tags, tagName])
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Tags</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
            {PRESET_COLORS.map(c => {
              const isSelected = tags.includes(c.name)
              return (
                <button
                  key={c.name}
                  title={c.name}
                  onClick={() => toggleTag(c.name)}
                  className={`w-8 h-8 rounded-full mx-auto ${c.class} ${isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-50 hover:opacity-100'} transition-all`}
                />
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
