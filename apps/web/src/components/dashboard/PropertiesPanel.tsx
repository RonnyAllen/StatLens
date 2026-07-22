import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Loader2 } from "lucide-react"
import { DriveAPI } from "@/data/driveApi"
import { useAuth } from "@/data/auth"
import { toast } from "sonner"

export const PRESET_COLORS = [
  { name: "Red", class: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  { name: "Orange", class: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" },
  { name: "Amber", class: "bg-amber-600", badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  { name: "Yellow", class: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800" },
  { name: "Lime", class: "bg-lime-400", badge: "bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-800" },
  { name: "Green", class: "bg-green-600", badge: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" },
  { name: "Emerald", class: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  { name: "Teal", class: "bg-teal-600", badge: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800" },
  { name: "Cyan", class: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800" },
  { name: "Sky", class: "bg-sky-400", badge: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800" },
  { name: "Blue", class: "bg-blue-600", badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { name: "Indigo", class: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800" },
  { name: "Violet", class: "bg-violet-600", badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
  { name: "Fuchsia", class: "bg-fuchsia-400", badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800" },
  { name: "Pink", class: "bg-pink-600", badge: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800" },
  { name: "Slate", class: "bg-slate-500", badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800" }
]

interface PropertiesPanelProps {
  workbook: any
  onClose: () => void
  onUpdate: () => void
}

export function PropertiesPanel({ workbook, onClose, onUpdate }: PropertiesPanelProps) {
  const { accessToken } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState(workbook.name.replace('.statlens', ''))
  const [comment, setComment] = useState(workbook.appProperties?.comment || "")
  const [tags, setTags] = useState<string[]>((workbook.appProperties?.tags || "").split(",").filter(Boolean).filter((t: string) => PRESET_COLORS.some(c => c.name === t)))

  useEffect(() => {
    setName(workbook.name.replace('.statlens', ''))
    setComment(workbook.appProperties?.comment || "")
    setTags((workbook.appProperties?.tags || "").split(",").filter(Boolean).filter((t: string) => PRESET_COLORS.some(c => c.name === t)))
  }, [workbook])



  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(x => x !== t))
  }

  const handleSave = async () => {
    if (!accessToken) return
    setIsSaving(true)
    try {
      const drive = new DriveAPI(accessToken)
      
      const p1 = drive.updateWorkbookMetadata(workbook.id, {
        comment: comment || null,
        tags: tags.length > 0 ? tags.join(",") : null
      })
      
      const p2 = name.trim() && name.trim() !== workbook.name.replace('.statlens', '') 
        ? drive.renameWorkbook(workbook.id, name.trim()) 
        : Promise.resolve()
        
      await Promise.all([p1, p2])
      toast.success("Properties saved successfully")
      onUpdate()
    } catch (e) {
      console.error(e)
      toast.error("Failed to update properties")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-card border-l shadow-xl flex flex-col z-50 animate-in slide-in-from-right">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">Properties</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Created On</Label>
          <p className="text-sm">{workbook.createdTime ? new Date(workbook.createdTime).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : "Unknown"}</p>
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Last Modified</Label>
          <p className="text-sm">{workbook.modifiedTime ? new Date(workbook.modifiedTime).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : "Unknown"}</p>
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="grid grid-cols-8 gap-2 mb-2">
            {PRESET_COLORS.map(c => {
              const isSelected = tags.includes(c.name)
              return (
                <button
                  key={c.name}
                  title={c.name}
                  onClick={() => isSelected ? handleRemoveTag(c.name) : setTags([...tags, c.name])}
                  className={`w-6 h-6 rounded-full ${c.class} ${isSelected ? 'ring-2 ring-offset-2 ring-primary' : 'opacity-50 hover:opacity-100'} transition-all`}
                />
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Comment</Label>
          <textarea 
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={comment} 
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)} 
            placeholder="Add a comment about this workbook..."
            rows={4}
          />
        </div>
      </div>

      <div className="p-4 border-t bg-muted/20">
        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Properties
        </Button>
      </div>
    </div>
  )
}
