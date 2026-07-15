import { useEffect, useState } from "react"
import { statsEngine } from "@/stats/engine"
import type { DataSheet } from "@/types/workbook"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, Activity } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TestOptionsDialog } from "./TestOptionsDialog"
import type { TestOptions } from "./TestOptionsDialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { executeTest } from "@/stats/testExecutor2"
import type { Analysis } from "@/types/workbook"

interface AnalyzePanelProps {
  sheet: DataSheet
  onTestComplete: (analysis: Analysis) => void
  isActive?: boolean
}

export function AnalyzePanel({ sheet, onTestComplete, isActive = true }: AnalyzePanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  const [selectedTestId, setSelectedTestId] = useState<string>("")
  
  // Test Options Dialog State
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)

  useEffect(() => {
    if (!isActive) return

    let isMounted = true
    setLoading(true)
    setError(null)
    
    // Debounced analysis to prevent excessive engine calls
    const timeout = setTimeout(async () => {
      try {
        const res = await statsEngine.analyzeSheet(sheet)
        if (isMounted) {
          if (res.error) {
            setError(res.error)
          } else {
            setResults(res)
            if (res.recommendation?.testId) {
              setSelectedTestId(res.recommendation.testId)
            }
          }
          setLoading(false)
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || String(err))
          setLoading(false)
        }
      }
    }, 800)

    return () => {
      isMounted = false
      clearTimeout(timeout)
    }
  }, [sheet, isActive])

  const handleRunTest = async (options: TestOptions) => {
    setIsOptionsOpen(false)
    setLoading(true)
    try {
      const testResult = await executeTest(sheet, options)
      
      const analysis: Analysis = {
        id: crypto.randomUUID(),
        sheetId: sheet.id,
        testId: selectedTestId,
        options: options,
        results: testResult,
        report: testResult.report_markdown || "",
        createdAt: new Date().toISOString()
      }
      
      onTestComplete(analysis)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Running statistical analysis engine...</p>
        <p className="text-sm opacity-70">Calculating descriptives and checking assumptions.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-8">
        <Alert variant="destructive">
          <AlertTitle>Analysis Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!results) {
    return <div className="p-8">No results available.</div>
  }

  const { descriptives, assumptions, recommendation } = results

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 border-b pb-4">
            <Activity className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">Analysis: {sheet.name}</h2>
          </div>

          {/* Test Selection Card */}
          {recommendation && recommendation.testId !== "None" && (
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    Select a Statistical Test
                  </div>
                  <Button onClick={() => setIsOptionsOpen(true)} size="sm" disabled={!selectedTestId}>
                    Configure & Run
                  </Button>
                </CardTitle>
                <CardDescription className="text-sm">
                  StatLens has automatically diagnosed your data and recommended the most mathematically robust test below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={selectedTestId} 
                  onValueChange={setSelectedTestId}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border-2 border-primary/40 bg-primary/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <RadioGroupItem value={recommendation.testId} id={`test-${recommendation.testId}`} className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`test-${recommendation.testId}`} className="text-base font-semibold flex items-center gap-2 cursor-pointer">
                        {recommendation.testId}
                        <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/30 shadow-[0_0_8px_rgba(var(--primary),0.3)]">
                          Recommended
                        </span>
                      </Label>
                      <p className="text-sm text-muted-foreground">{recommendation.rationale}</p>
                    </div>
                  </div>

                  {recommendation.alternatives && recommendation.alternatives.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">Alternative Tests</h4>
                      {recommendation.alternatives.map((alt: string) => {
                        const isDisabled = alt.includes("(Not implemented yet)");
                        return (
                          <div key={alt} className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${isDisabled ? 'opacity-50' : 'hover:bg-muted/50'}`}>
                            <RadioGroupItem value={alt} id={`test-${alt}`} disabled={isDisabled} />
                            <Label htmlFor={`test-${alt}`} className={`text-sm font-medium flex-1 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              {alt}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Assumptions */}
          {assumptions && Object.keys(assumptions).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assumption Checks</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {assumptions.normality && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    {assumptions.normality.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-semibold text-sm">Normality (Shapiro-Wilk)</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assumptions.normality.passed 
                          ? "The data appears to be normally distributed." 
                          : "One or more groups failed the normality test (p < 0.05)."}
                      </p>
                    </div>
                  </div>
                )}
                {assumptions.variance && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    {assumptions.variance.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-semibold text-sm">Equal Variances (Levene's)</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assumptions.variance.passed 
                          ? "The groups have roughly equal variances." 
                          : "The groups have significantly different variances (p < 0.05)."}
                      </p>
                    </div>
                  </div>
                )}
                {assumptions.outliers && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    {assumptions.outliers.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-semibold text-sm">Outliers (Tukey's Fences)</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assumptions.outliers.passed 
                          ? "No extreme outliers were detected." 
                          : "Some groups contain extreme outliers that may skew results."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Descriptives Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descriptive Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(descriptives).length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough data to calculate descriptives.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Group</th>
                        <th className="px-4 py-2 font-medium text-right">N</th>
                        <th className="px-4 py-2 font-medium text-right">Mean</th>
                        <th className="px-4 py-2 font-medium text-right">Std Dev</th>
                        <th className="px-4 py-2 font-medium text-right">SEM</th>
                        <th className="px-4 py-2 font-medium text-right">Min</th>
                        <th className="px-4 py-2 font-medium text-right">Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(descriptives).map(([col, stats]: [string, any]) => {
                        const baseId = col.includes('_') ? col.split('_')[0] : col
                        const groupName = sheet.columnGroups.find(g => g.id === baseId)?.name 
                        const suffix = col.includes('_') ? ` (${col.split('_')[1]})` : ''
                        const colName = groupName ? `${groupName}${suffix}` : col
                        return (
                          <tr key={col} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2 font-medium">{colName}</td>
                            <td className="px-4 py-2 text-right">{stats.n}</td>
                            <td className="px-4 py-2 text-right">{stats.mean?.toFixed(4) ?? "-"}</td>
                            <td className="px-4 py-2 text-right">{stats.sd?.toFixed(4) ?? "-"}</td>
                            <td className="px-4 py-2 text-right">{stats.sem?.toFixed(4) ?? "-"}</td>
                            <td className="px-4 py-2 text-right">{stats.min?.toFixed(4) ?? "-"}</td>
                            <td className="px-4 py-2 text-right">{stats.max?.toFixed(4) ?? "-"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {recommendation && selectedTestId && (
        <TestOptionsDialog 
          open={isOptionsOpen}
          onOpenChange={setIsOptionsOpen}
          sheet={sheet}
          recommendedTestId={selectedTestId}
          assumptions={assumptions}
          onRunTest={handleRunTest}
        />
      )}
    </>
  )
}
