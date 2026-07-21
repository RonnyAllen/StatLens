import { useState, useEffect, useRef, useCallback } from "react"
import type { MouseEvent } from "react"
import type { Workbook, TableType } from "@/types/workbook"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Table, BarChart2, Activity, ChevronLeft, ChevronRight, CheckSquare, Trash2, Edit2, LineChart, BarChart3, LayoutGrid, Grid3x3, PieChart, Layers, Network, HeartPulse } from "lucide-react"
import { DataTableChooser } from "./DataTableChooser"
import { createNewSheet } from "@/data/sheetFactory"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SidebarProps {
  workbook: Workbook
  onUpdate: (updater: (prev: Workbook) => Workbook) => void
  activeSheetId: string | null
  activeAnalysisId: string | null
  onSelectSheet: (id: string) => void
  onSelectAnalysis: (id: string) => void
  onSelectGraph: (id: string) => void
  onDeleteAnalysis: (id: string) => void
  onDeleteGraph: (id: string) => void
}

export function Sidebar({ workbook, onUpdate, activeSheetId, activeAnalysisId, activeGraphId, onSelectSheet, onSelectAnalysis, onSelectGraph, onDeleteAnalysis, onDeleteGraph }: SidebarProps & { activeGraphId: string | null, onDeleteGraph: (id: string) => void }) {
  const [isChooserOpen, setIsChooserOpen] = useState(false)
  const [isGraphChooserOpen, setIsGraphChooserOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const isResizing = useRef(false)

  const startResizing = useCallback(() => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const stopResizing = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const resize = useCallback((mouseMoveEvent: globalThis.MouseEvent) => {
    if (isResizing.current) {
      const newWidth = mouseMoveEvent.clientX
      if (newWidth >= 200 && newWidth <= 750) {
        setSidebarWidth(newWidth)
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener("mousemove", resize)
    window.addEventListener("mouseup", stopResizing)
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [resize, stopResizing])
  
  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleAddTable = (type: TableType, useSampleData: boolean, replicates: number = 1) => {
    const newSheet = createNewSheet(type, useSampleData, replicates)
    onUpdate((prev) => ({
      ...prev,
      sheets: [...prev.sheets, newSheet]
    }))
    setIsChooserOpen(false)
  }

  const handleRename = (id: string, currentName: string, type: 'sheet' | 'analysis' | 'graph' = 'sheet') => {
    const typeLabel = type === 'sheet' ? 'data table' : type === 'analysis' ? 'results' : 'graph'
    const newName = window.prompt(`Rename ${typeLabel}:`, currentName)
    if (!newName || newName.trim() === "") return
    onUpdate(prev => {
      const next = { ...prev }
      if (type === 'sheet') {
        next.sheets = prev.sheets.map(s => s.id === id ? { ...s, name: newName.trim() } : s)
      } else if (type === 'analysis') {
        next.analyses = prev.analyses.map(a => a.id === id ? { ...a, name: newName.trim() } : a)
      } else if (type === 'graph') {
        next.graphs = prev.graphs.map(g => g.id === id ? { ...g, name: newName.trim() } : g)
      }
      return next
    })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this table?")) return
    onUpdate(prev => ({
      ...prev,
      sheets: prev.sheets.filter(s => s.id !== id),
      analyses: prev.analyses.filter(a => a.sheetId !== id) // Cascading delete
    }))
    if (activeSheetId === id) {
      onSelectSheet("")
    }
  }

  const handleDuplicate = (id: string) => {
    onUpdate(prev => {
      const sheet = prev.sheets.find(s => s.id === id)
      if (!sheet) return prev
      const newSheet = { ...sheet, id: crypto.randomUUID(), name: `Copy of ${sheet.name}` }
      return {
        ...prev,
        sheets: [...prev.sheets, newSheet]
      }
    })
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const allSheetsSelected = workbook.sheets.length > 0 && workbook.sheets.every(s => selectedIds.has(s.id))
  const allAnalysesSelected = workbook.analyses.length > 0 && workbook.analyses.every(a => selectedIds.has(a.id))
  const allGraphsSelected = workbook.graphs.length > 0 && workbook.graphs.every(g => selectedIds.has(g.id))

  const toggleAllSheets = () => {
    if (!isSelectionMode) setIsSelectionMode(true)
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (allSheetsSelected && isSelectionMode) {
        workbook.sheets.forEach(s => newSet.delete(s.id))
      } else {
        workbook.sheets.forEach(s => newSet.add(s.id))
      }
      return newSet
    })
  }

  const toggleAllAnalyses = () => {
    if (!isSelectionMode) setIsSelectionMode(true)
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (allAnalysesSelected && isSelectionMode) {
        workbook.analyses.forEach(a => newSet.delete(a.id))
      } else {
        workbook.analyses.forEach(a => newSet.add(a.id))
      }
      return newSet
    })
  }

  const toggleAllGraphs = () => {
    if (!isSelectionMode) setIsSelectionMode(true)
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (allGraphsSelected && isSelectionMode) {
        workbook.graphs.forEach(g => newSet.delete(g.id))
      } else {
        workbook.graphs.forEach(g => newSet.add(g.id))
      }
      return newSet
    })
  }

  const handleItemClick = (e: MouseEvent, id: string, type: 'sheet' | 'analysis' | 'graph') => {
    if (isSelectionMode || e.ctrlKey || e.metaKey) {
      if (!isSelectionMode) setIsSelectionMode(true)
      toggleSelection(id)
    } else {
      if (type === 'sheet') onSelectSheet(id)
      else if (type === 'analysis') onSelectAnalysis(id)
      else if (type === 'graph') onSelectGraph(id)
    }
  }

  const handleCreateGraph = () => {
    if (workbook.sheets.length === 0) return alert("Please create a Data Table first.")
    
    if (workbook.sheets.length > 1) {
      setIsGraphChooserOpen(true)
    } else {
      executeCreateGraph(workbook.sheets[0].id)
    }
  }

  const executeCreateGraph = (sheetId: string) => {
    const sheet = workbook.sheets.find(s => s.id === sheetId)
    if (!sheet) return
    // Attempt to find an analysis for this sheet
    const analysis = workbook.analyses.find(a => a.sheetId === sheet.id)
    
    const newGraphId = crypto.randomUUID()
    onUpdate(prev => ({
      ...prev,
      graphs: [...prev.graphs, {
        id: newGraphId,
        sheetId: sheet.id,
        analysisId: analysis?.id,
        graphFamily: sheet.type === "Survival" ? "Survival" : "Column",
        chartType: sheet.type === "Survival" ? "km-step" : "bar-error",
        name: `Graph ${prev.graphs.length + 1}`,
        createdAt: new Date().toISOString(),
        config: {
          errorBarType: "mean_sem",
          whiskerMode: "min_max",
          showPoints: true,
          jitterSeed: Math.random(),
          axisMode: "auto",
          palette: "okabe-ito",
          background: "transparent",
          significanceScale: "standard",
          showNsBrackets: true,
          showPostHocCaption: true,
          showXAxisTitle: true,
          showYAxisTitle: true,
          showGrid: true,
          theme: workbook.appTheme as any,
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          pointSize: 4,
          errorBars: "se",
          survivalShowAs: "fractions",
          survivalSymbolsAt: "censored",
          survivalStyle: "staircase-ticks",
          showLegend: false
        }
      }]
    }))
    // Also select the sheet so the graph tab works intuitively
    onSelectSheet(sheet.id)
    onSelectGraph(newGraphId)
    setIsGraphChooserOpen(false)
  }
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} item(s)?`)) return
    
    onUpdate(prev => {
      const remainingSheets = prev.sheets.filter(s => !selectedIds.has(s.id))
      // Filter out analyses that are explicitly selected OR whose parent sheet was deleted
      const remainingAnalyses = prev.analyses.filter(a => 
        !selectedIds.has(a.id) && !selectedIds.has(a.sheetId)
      )
      
      return {
        ...prev,
        sheets: remainingSheets,
        analyses: remainingAnalyses,
        graphs: prev.graphs.filter(g => !selectedIds.has(g.id))
      }
    })
    
    // Clear active selection if they were deleted
    if (activeSheetId && selectedIds.has(activeSheetId)) onSelectSheet("")
    if (activeAnalysisId && selectedIds.has(activeAnalysisId)) onSelectAnalysis("")
    
    setSelectedIds(new Set())
    setIsSelectionMode(false)
  }

  // F2 to rename active element, Delete to delete selected
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        if (isSelectionMode && selectedIds.size === 1) {
           const id = Array.from(selectedIds)[0]
           const sheet = workbook.sheets.find(s => s.id === id)
           if (sheet) return handleRename(sheet.id, sheet.name, 'sheet')
           const analysis = workbook.analyses.find(a => a.id === id)
           if (analysis) return handleRename(analysis.id, analysis.name || "Analysis", 'analysis')
           const graph = workbook.graphs.find(g => g.id === id)
           if (graph) return handleRename(graph.id, graph.name || "Graph", 'graph')
        } else if (!isSelectionMode) {
           if (activeSheetId) {
             const sheet = workbook.sheets.find(s => s.id === activeSheetId)
             if (sheet) handleRename(sheet.id, sheet.name, 'sheet')
           } else if (activeAnalysisId) {
             const analysis = workbook.analyses.find(a => a.id === activeAnalysisId)
             if (analysis) handleRename(analysis.id, analysis.name || "Analysis", 'analysis')
           } else if (activeGraphId) {
             const graph = workbook.graphs.find(g => g.id === activeGraphId)
             if (graph) handleRename(graph.id, graph.name || "Graph", 'graph')
           }
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent deleting if user is typing in an input field
        const activeTag = document.activeElement?.tagName.toLowerCase()
        if (activeTag === 'input' || activeTag === 'textarea') return
        
        if (isSelectionMode && selectedIds.size > 0) {
          handleBulkDelete()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSheetId, workbook.sheets, isSelectionMode, selectedIds, handleBulkDelete])

  return (
    <div 
      className={`border-r bg-card flex flex-col h-full relative group shrink-0`}
      style={{ width: isCollapsed ? 48 : sidebarWidth }}
    >
      {!isCollapsed && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary z-[60] transition-colors"
          onMouseDown={startResizing}
        />
      )}
      <Button 
        variant="outline" 
        size="icon" 
        className={`absolute top-4 h-8 w-8 rounded-full shadow-sm z-50 bg-background flex items-center justify-center transition-all ${isCollapsed ? 'right-2' : '-right-4'}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
      <div className={`flex flex-col h-full overflow-hidden transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Bulk Action Header */}
        <div className="p-2 pb-0 flex items-center justify-between gap-2">
           {isSelectionMode ? (
             <>
               <Button variant="ghost" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="text-muted-foreground shrink-0">
                 Done
               </Button>
               {selectedIds.size > 0 && (
                 <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="shrink-0">
                   <Trash2 className="h-4 w-4 mr-1" /> Delete
                 </Button>
               )}
             </>
           ) : (
             <Button variant="ghost" size="sm" onClick={() => setIsSelectionMode(true)} className="text-muted-foreground shrink-0">
               <CheckSquare className="h-4 w-4 mr-2" /> Select
             </Button>
           )}
        </div>

        <ScrollArea className="flex-1 min-h-0 w-full [&>[data-radix-scroll-area-viewport]>div]:!block">
          <div className="p-4 pt-2 space-y-6 min-w-0 w-full overflow-hidden">
          
          {/* Data Tables Section */}
          <div className="min-w-0 w-full">
            <div className="flex items-center justify-between mb-3 gap-2 min-w-0 w-full">
              <h3 className="flex-1 min-w-0 text-base font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Data Tables
              </h3>
              {workbook.sheets.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-3 text-base shrink-0" onClick={toggleAllSheets}>
                  {(allSheetsSelected && isSelectionMode) ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>
            
            <div className="space-y-1 mb-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setIsChooserOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Data Table
              </Button>
            </div>

            <div className="space-y-1">
              {workbook.sheets.map(sheet => {
                const IconComponent = {
                  "XY": LineChart,
                  "Column": BarChart3,
                  "Grouped": LayoutGrid,
                  "Contingency": Grid3x3,
                  "Survival": HeartPulse,
                  "PartsOfWhole": PieChart,
                  "MultipleVariables": Layers,
                  "Nested": Network
                }[sheet.type] || Table;
                
                return (
                <ContextMenu key={sheet.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={(e) => handleItemClick(e, sheet.id, 'sheet')}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-base rounded-md hover:bg-accent hover:text-accent-foreground text-left transition-all duration-200 hover:translate-x-1 ${activeSheetId === sheet.id && !isSelectionMode ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground'}`}
                    >
                      {isSelectionMode && (
                        <Checkbox 
                          checked={selectedIds.has(sheet.id)} 
                          onCheckedChange={() => toggleSelection(sheet.id)} 
                          className="mr-2"
                        />
                      )}
                      {!isSelectionMode && <IconComponent className={`h-4 w-4 shrink-0 transition-colors ${activeSheetId === sheet.id ? 'text-blue-500' : 'text-muted-foreground/70'}`} />}
                      <span className="truncate">{sheet.name}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleRename(sheet.id, sheet.name)}>
                      <Edit2 className="h-4 w-4 mr-2" /> Rename (F2)
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDuplicate(sheet.id)}>Duplicate</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(sheet.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )})}
              {workbook.sheets.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1 italic">None</p>
              )}
            </div>
          </div>

          {/* Analyses Section */}
          <div className="min-w-0 w-full">
            <div className="flex items-center justify-between mb-3 mt-6 gap-2 min-w-0 w-full">
              <h3 className="flex-1 min-w-0 text-base font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Results
              </h3>
              {workbook.analyses.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-3 text-base shrink-0" onClick={toggleAllAnalyses}>
                  {(allAnalysesSelected && isSelectionMode) ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {workbook.analyses.map(analysis => {
                const sheet = workbook.sheets.find(s => s.id === analysis.sheetId)
                const sheetName = sheet ? sheet.name : "Unknown Table"
                const dateStr = new Date(analysis.createdAt).toLocaleDateString()
                const displayName = `${sheetName}_${analysis.testId}_${dateStr}`
                
                return (
                  <ContextMenu key={analysis.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        onClick={(e) => handleItemClick(e, analysis.id, 'analysis')}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-base rounded-md hover:bg-accent hover:text-accent-foreground text-left ${activeAnalysisId === analysis.id && !isSelectionMode ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground'}`}
                        title={displayName}
                      >
                        {isSelectionMode && (
                          <Checkbox 
                            checked={selectedIds.has(analysis.id)} 
                            onCheckedChange={() => toggleSelection(analysis.id)} 
                            className="mr-2"
                          />
                        )}
                        {!isSelectionMode && <Activity className={`h-4 w-4 shrink-0 ${activeAnalysisId === analysis.id ? 'text-orange-500' : 'text-muted-foreground/70'}`} />}
                        <span className="truncate">{displayName}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleRename(analysis.id, analysis.name || displayName, 'analysis')}>
                      <Edit2 className="h-4 w-4 mr-2" /> Rename (F2)
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => onDeleteAnalysis(analysis.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                )
              })}
              {workbook.analyses.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1 italic">None</p>
              )}
            </div>
          </div>

          {/* Graphs Section */}
          <div className="min-w-0 w-full">
            <div className="flex items-center justify-between mb-3 mt-6 gap-2 min-w-0 w-full">
              <h3 className="flex-1 min-w-0 text-base font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Graphs
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreateGraph} title="New Graph">
                  <Plus className="h-4 w-4" />
                </Button>
                {workbook.graphs.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-8 px-3 text-base shrink-0" onClick={toggleAllGraphs}>
                    {(allGraphsSelected && isSelectionMode) ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {workbook.graphs.map(graph => (
                <ContextMenu key={graph.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={(e) => handleItemClick(e, graph.id, 'graph')}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-base rounded-md hover:bg-accent hover:text-accent-foreground text-left ${activeGraphId === graph.id && !isSelectionMode ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground'}`}
                    >
                      {isSelectionMode && (
                        <Checkbox 
                          checked={selectedIds.has(graph.id)} 
                          onCheckedChange={() => toggleSelection(graph.id)} 
                          className="mr-2"
                        />
                      )}
                      {!isSelectionMode && <BarChart2 className={`h-4 w-4 shrink-0 ${activeGraphId === graph.id ? 'text-green-500' : 'text-muted-foreground/70'}`} />}
                      <span className="truncate">{graph.name || graph.chartType}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleRename(graph.id, graph.name || "Graph", 'graph')}>
                      <Edit2 className="h-4 w-4 mr-2" /> Rename (F2)
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => onDeleteGraph(graph.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              {workbook.graphs.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1 italic">None</p>
              )}
            </div>
          </div>

        </div>
        </ScrollArea>
      </div>
      <DataTableChooser 
        open={isChooserOpen} 
        onOpenChange={setIsChooserOpen} 
        onSelect={handleAddTable} 
      />
      <Dialog open={isGraphChooserOpen} onOpenChange={setIsGraphChooserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Data Table for Graph</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4 max-h-[60vh] overflow-auto">
            {workbook.sheets.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="justify-start w-full text-left"
                onClick={() => executeCreateGraph(s.id)}
              >
                <Table className="h-4 w-4 mr-2" />
                {s.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
