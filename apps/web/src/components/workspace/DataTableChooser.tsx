import { useState } from "react"
import type { TableType } from "@/types/workbook"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DataTableChooserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: TableType, useSampleData: boolean, replicates: number) => void
}

const TABLE_TYPES: { type: TableType; name: string; description: string }[] = [
  { type: "XY", name: "XY", description: "Each point is defined by X and Y coordinates. Used for linear regression, non-linear curve fitting." },
  { type: "Column", name: "Column", description: "Each column defines a group. Used for t-tests, one-way ANOVA." },
  { type: "Grouped", name: "Grouped", description: "Two grouping variables (rows and columns). Used for two-way ANOVA." },
  { type: "Contingency", name: "Contingency", description: "Tables of categorical counts. Used for Chi-square and Fisher's exact tests." },
  { type: "Survival", name: "Survival", description: "Time-to-event data. Used for Kaplan-Meier curves and Log-rank tests." },
  { type: "PartsOfWhole", name: "Parts of whole", description: "Fractions or percentages. Used for pie charts and binomial tests." },
  { type: "MultipleVariables", name: "Multiple variables", description: "Each column is a variable, each row a subject. Used for multiple regression, PCA." },
  { type: "Nested", name: "Nested", description: "Data organized in nested groups (e.g. rats within litters). Used for nested ANOVA." }
]

export function DataTableChooser({ open, onOpenChange, onSelect }: DataTableChooserProps) {
  const [replicates, setReplicates] = useState<Record<string, number>>({ Grouped: 2, Nested: 2, Column: 1, XY: 1 })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-2xl">Create New Data Table</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TABLE_TYPES.map(def => (
              <div key={def.type} className="border rounded-lg p-6 flex flex-col">
                <h3 className="font-bold text-lg mb-2">{def.name}</h3>
                <p className="text-muted-foreground text-base flex-1 mb-6">
                  {def.description}
                </p>
                <div className="mt-auto space-y-4">
                  {(def.type === "Grouped" || def.type === "Nested") && (
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor={`rep-${def.type}`} className="text-xs text-muted-foreground">Replicates (subcolumns)</Label>
                      <Input 
                        id={`rep-${def.type}`}
                        type="number" 
                        min={1} 
                        value={replicates[def.type] || 1} 
                        onChange={(e) => setReplicates(p => ({...p, [def.type]: Math.max(1, parseInt(e.target.value) || 1)}))}
                        className="h-8"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="default" 
                      className="flex-1"
                      onClick={() => onSelect(def.type, false, replicates[def.type] || 1)}
                    >
                      Create Table
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
