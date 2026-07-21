import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "@/data/auth"
import { DriveAPI } from "@/data/driveApi"
import type { Workbook, DataSheet } from "@/types/workbook"
import { Sidebar } from "./Sidebar"
import { AGGridWrapper } from "./AGGridWrapper"
import { AnalyzePanel } from "./AnalyzePanel"
import { AnalysisResultsView } from "./AnalysisResultsView"
import { GraphSettingsPanel } from "./GraphSettingsPanel"
import { GraphEngine } from "@/charts/GraphEngine"
import type { Analysis, Graph } from "@/types/workbook"
import { ChevronRight, ChevronLeft } from "lucide-react"

export function Workspace() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  
  const [workbook, setWorkbook] = useState<Workbook | null>(null)
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null)
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null)
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"data" | "analyze" | "results" | "graph">("data")
  const [isGraphSettingsOpen, setIsGraphSettingsOpen] = useState(true)
  
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "saving" | "error">("idle")
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const workbookRef = useRef<Workbook | null>(null)
  useEffect(() => {
    workbookRef.current = workbook
  }, [workbook])

  const [isRefreshingAnalyses, setIsRefreshingAnalyses] = useState(false)
  const refreshTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!accessToken || !id) return
    loadWorkbook(accessToken, id)
  }, [accessToken, id])

  async function loadWorkbook(token: string, fileId: string) {
    setIsLoading(true)
    setError(null)
    try {
      const drive = new DriveAPI(token)
      const data = await drive.readWorkbook(fileId)
      setWorkbook(data as Workbook)
      if (data.sheets && data.sheets.length > 0) {
        setActiveSheetId(data.sheets[0].id)
      }
    } catch (err: any) {
      console.error(err)
      if (err.message === "AUTH_REQUIRED") {
        // signIn()
      } else {
        setError("Failed to load workbook")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced save hook logic
  const scheduleSave = useCallback((newWorkbook: Workbook) => {
    if (!accessToken || !id) return
    setSaveStatus("saving")
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const drive = new DriveAPI(accessToken)
        await drive.updateWorkbook(id, newWorkbook)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 3000)
      } catch (err) {
        console.error("Failed to auto-save", err)
        setSaveStatus("error")
      }
    }, 2000)
  }, [accessToken, id])

  // Call this whenever a sheet/analysis/graph changes
  const updateWorkbook = useCallback((updater: (prev: Workbook) => Workbook) => {
    setWorkbook((prev) => {
      if (!prev) return prev
      const updated = updater(prev)
      
      // Auto-select first sheet if newly added
      if (prev.sheets.length === 0 && updated.sheets.length > 0) {
        setActiveSheetId(updated.sheets[0].id)
      }

      scheduleSave(updated)
      return updated
    })
  }, [scheduleSave])

  const scheduleAnalysisRefresh = useCallback((sheetId: string, updatedSheet: DataSheet) => {
    if (refreshTimeoutRef.current[sheetId]) {
      clearTimeout(refreshTimeoutRef.current[sheetId])
    }
    
    refreshTimeoutRef.current[sheetId] = setTimeout(async () => {
      const currentWorkbook = workbookRef.current
      if (!currentWorkbook) return
      
      const dependentAnalyses = currentWorkbook.analyses.filter(a => a.sheetId === sheetId)
      if (dependentAnalyses.length === 0) return
      
      setIsRefreshingAnalyses(true)
      
      try {
        const { executeTest } = await import("@/stats/testExecutor2")
        const updatedAnalyses = [...currentWorkbook.analyses]
        let changed = false
        
        for (const analysis of dependentAnalyses) {
          try {
            const result = await executeTest(updatedSheet, analysis.options as any)
            const idx = updatedAnalyses.findIndex(a => a.id === analysis.id)
            if (idx !== -1) {
              updatedAnalyses[idx] = {
                ...updatedAnalyses[idx],
                results: result,
                report: result.report_markdown || ""
              }
              changed = true
            }
          } catch (err) {
            console.error("Failed to auto-refresh analysis", analysis.id, err)
          }
        }
        
        if (changed) {
          setWorkbook(prev => {
            if (!prev) return prev
            const newAnalyses = prev.analyses.map(prevA => {
              const updatedA = updatedAnalyses.find(ua => ua.id === prevA.id)
              return updatedA || prevA
            })
            const newWb = { ...prev, analyses: newAnalyses }
            scheduleSave(newWb)
            return newWb
          })
        }
      } finally {
        setIsRefreshingAnalyses(false)
      }
    }, 3000)
  }, [scheduleSave])

  const handleUpdateSheet = useCallback((updater: (prevSheet: DataSheet) => DataSheet) => {
    if (!activeSheetId) return
    
    updateWorkbook(prevWb => {
      const sheetIndex = prevWb.sheets.findIndex(s => s.id === activeSheetId)
      if (sheetIndex === -1) return prevWb
      
      const newSheets = [...prevWb.sheets]
      newSheets[sheetIndex] = updater(newSheets[sheetIndex])
      
      scheduleAnalysisRefresh(activeSheetId, newSheets[sheetIndex])
      
      return { ...prevWb, sheets: newSheets }
    })
  }, [activeSheetId, updateWorkbook, scheduleAnalysisRefresh])

  const handleTestComplete = useCallback((analysis: Analysis) => {
    updateWorkbook(prevWb => {
      // Remove any existing analysis with same ID just in case
      const existingIdx = prevWb.analyses.findIndex(a => a.id === analysis.id)
      const newAnalyses = [...prevWb.analyses]
      if (existingIdx >= 0) {
        newAnalyses[existingIdx] = analysis
      } else {
        newAnalyses.push(analysis)
      }
      return { ...prevWb, analyses: newAnalyses }
    })
    
    setActiveAnalysisId(analysis.id)
    setViewMode("results")
  }, [updateWorkbook])

  const handleDeleteAnalysis = useCallback((id: string) => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) return
    updateWorkbook(prev => ({
      ...prev,
      analyses: prev.analyses.filter(a => a.id !== id)
    }))
    if (activeAnalysisId === id) {
      setActiveAnalysisId(null)
      setViewMode("data")
    }
  }, [activeAnalysisId, updateWorkbook])

  const handleDeleteGraph = useCallback((id: string) => {
    if (!window.confirm("Are you sure you want to delete this graph?")) return
    updateWorkbook(prev => ({
      ...prev,
      graphs: prev.graphs.filter(g => g.id !== id)
    }))
    if (activeGraphId === id) {
      setActiveGraphId(null)
      setViewMode("data")
    }
  }, [activeGraphId, updateWorkbook])

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading workbook...</div>
  }

  if (error || !workbook) {
    return <div className="flex-1 flex items-center justify-center text-destructive">{error}</div>
  }
  const activeSheet = workbook.sheets.find(s => s.id === activeSheetId)

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <Sidebar 
        workbook={workbook} 
        activeSheetId={activeSheetId}
        activeAnalysisId={activeAnalysisId}
        activeGraphId={activeGraphId}
        onSelectSheet={(id) => {
          setActiveSheetId(id)
          setViewMode("data")
        }}
        onSelectAnalysis={(id) => {
          const a = workbook.analyses.find(x => x.id === id)
          if (a) setActiveSheetId(a.sheetId)
          setActiveAnalysisId(id)
          setViewMode("results")
        }}
        onSelectGraph={(id) => {
          const g = workbook.graphs.find(x => x.id === id)
          if (g) setActiveSheetId(g.sheetId)
          setActiveGraphId(id)
          setViewMode("graph")
        }}
        onDeleteAnalysis={handleDeleteAnalysis}
        onDeleteGraph={handleDeleteGraph}
        onUpdate={updateWorkbook} 
      />
      
      <div className="flex-1 flex flex-col bg-muted/20 relative">
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {isRefreshingAnalyses && <span className="text-sm text-blue-600 dark:text-blue-400 animate-pulse mr-2">Refreshing results...</span>}
          {saveStatus === "saving" && <span className="text-sm text-muted-foreground animate-pulse">Saving...</span>}
          {saveStatus === "saved" && <span className="text-sm text-green-600 dark:text-green-400">Saved to Drive</span>}
          {saveStatus === "error" && <span className="text-sm text-destructive">Error saving</span>}
        </div>
        
        {/* Workspace Main Area */}
        <div className="flex-1 flex flex-col p-4 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold truncate pr-4">{activeSheet ? activeSheet.name : workbook.name}</h2>
            {activeSheet && (
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                <button
                  className={`px-3 py-1.5 text-base font-medium rounded-md transition-colors ${viewMode === "data" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
                  onClick={() => setViewMode("data")}
                >
                  Data
                </button>
                <button
                  className={`px-3 py-1.5 text-base font-medium rounded-md transition-colors ${viewMode === "analyze" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
                  onClick={() => setViewMode("analyze")}
                >
                  Analyze
                </button>
                <button
                  className={`px-3 py-1.5 text-base font-medium rounded-md transition-colors ${viewMode === "graph" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
                  onClick={() => {
                    setViewMode("graph")
                    if (!activeGraphId || workbook.graphs.find(g => g.id === activeGraphId)?.sheetId !== activeSheet.id) {
                      const firstGraph = workbook.graphs.find(g => g.sheetId === activeSheet.id)
                      if (firstGraph) {
                        setActiveGraphId(firstGraph.id)
                      } else {
                        setActiveGraphId(null)
                      }
                    }
                  }}
                >
                  Graph
                </button>
              </div>
            )}
          </div>
          
          {workbook.sheets.length === 0 ? (
            <div className="text-center p-12 border border-dashed rounded-lg bg-card mt-8">
              <h3 className="text-lg font-semibold mb-2">No Data Tables</h3>
              <p className="text-muted-foreground">Click "New Table" in the sidebar to get started.</p>
            </div>
          ) : activeSheet ? (
            <div className="flex-1 bg-card border rounded-lg overflow-hidden flex flex-col">
              <div className="flex-1 flex flex-col relative h-full">
                <div className={`flex-1 flex flex-col relative h-full ${viewMode === "data" ? "" : "hidden"}`}>
                  {activeSheet && (
                    <AGGridWrapper 
                      sheet={activeSheet} 
                      onUpdate={handleUpdateSheet} 
                    />
                  )}
                </div>
                <div className={`flex-1 flex flex-col relative h-full ${viewMode === "analyze" ? "" : "hidden"}`}>
                  {activeSheet && (
                    <AnalyzePanel 
                      sheet={activeSheet} 
                      onTestComplete={handleTestComplete}
                      isActive={viewMode === "analyze"}
                    />
                  )}
                </div>
                <div className={`flex-1 flex flex-col relative h-full ${viewMode === "results" ? "" : "hidden"}`}>
                  {activeAnalysisId && (
                    <AnalysisResultsView 
                      analysis={workbook.analyses.find(a => a.id === activeAnalysisId)!}
                      workbook={workbook}
                      onUpdateAnalysis={(analysis) => {
                        updateWorkbook(prev => {
                          const newAnalyses = prev.analyses.map(a => a.id === analysis.id ? analysis : a)
                          return { ...prev, analyses: newAnalyses }
                        })
                      }}
                    />
                  )}
                </div>
                <div className={`flex-1 flex flex-col relative h-full ${viewMode === "graph" ? "" : "hidden"}`}>
                  {activeGraphId && workbook.graphs.find(g => g.id === activeGraphId) ? (
                    <div className="flex-1 flex overflow-hidden">
                      <div className="flex-1 p-4 overflow-auto min-w-0 dark:[&_svg]:invert-[0.85] dark:[&_svg]:hue-rotate-180 transition-all duration-300">
                        <GraphEngine 
                          graph={workbook.graphs.find(g => g.id === activeGraphId)!}
                          sheet={workbook.sheets.find(s => s.id === workbook.graphs.find(g => g.id === activeGraphId)?.sheetId)!}
                          analysisResults={workbook.analyses.find(a => a.id === workbook.graphs.find(g => g.id === activeGraphId)?.analysisId)?.results}
                        />
                      </div>
                      
                      <div 
                        className={`relative border-l transition-all duration-300 ease-in-out ${isGraphSettingsOpen ? 'w-full md:w-72' : 'w-0'}`}
                      >
                        <button
                          className={`absolute top-4 h-8 w-8 rounded-full shadow-sm z-50 bg-background flex items-center justify-center border transition-all ${isGraphSettingsOpen ? '-left-4' : '-left-10'}`}
                          onClick={() => setIsGraphSettingsOpen(!isGraphSettingsOpen)}
                        >
                          {isGraphSettingsOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                        
                        <div className={`h-full w-full overflow-y-auto p-4 transition-opacity duration-300 ${isGraphSettingsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                          <GraphSettingsPanel 
                            graph={workbook.graphs.find(g => g.id === activeGraphId)!}
                            analyses={workbook.analyses.filter(a => a.sheetId === activeSheet.id)}
                            onChangeConfig={(config) => {
                              updateWorkbook(prev => {
                                const newGraphs = prev.graphs.map(g => g.id === activeGraphId ? { ...g, config: { ...g.config, ...config } } : g)
                                return { ...prev, graphs: newGraphs }
                              })
                            }}
                            onChangeChartType={(chartType) => {
                              updateWorkbook(prev => {
                                const newGraphs = prev.graphs.map(g => g.id === activeGraphId ? { ...g, chartType } : g)
                                return { ...prev, graphs: newGraphs }
                              })
                            }}
                            onChangeAnalysis={(analysisId) => {
                              updateWorkbook(prev => {
                                const newGraphs = prev.graphs.map(g => g.id === activeGraphId ? { ...g, analysisId } : g)
                                return { ...prev, graphs: newGraphs }
                              })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <p className="text-muted-foreground">No graph exists for this sheet.</p>
                      <button 
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm"
                        onClick={() => {
                          const newGraph: Graph = {
                            id: crypto.randomUUID(),
                            sheetId: activeSheet.id,
                            graphFamily: "Column",
                            chartType: "bar-error",
                            name: `${activeSheet.name} Graph`,
                            createdAt: new Date().toISOString(),
                            config: {
                              errorBarType: "mean_sem",
                              whiskerMode: "min_max",
                              showPoints: true,
                              jitterSeed: 42,
                              axisMode: "auto",
                              palette: "okabe-ito",
                              background: "transparent",
                              significanceScale: "standard",
                              showNsBrackets: true,
                              showPostHocCaption: true,
                              showXAxisTitle: true,
                              showYAxisTitle: true,
                              showGrid: true,
                              theme: "system",
                              fontFamily: "Arial, sans-serif",
                              fontSize: 14,
                              pointSize: 4,
                              errorBars: "se",
                              survivalShowAs: "fractions",
                              survivalSymbolsAt: "censored",
                              survivalStyle: "staircase-ticks",
                              showLegend: false
                            }
                          }
                          updateWorkbook(prev => ({ ...prev, graphs: [...prev.graphs, newGraph] }))
                          setActiveGraphId(newGraph.id)
                        }}
                      >
                        Create Graph
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-12 text-muted-foreground">Select a sheet to edit.</div>
          )}
        </div>
      </div>
    </div>
  )
}
