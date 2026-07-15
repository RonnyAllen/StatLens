import type { Analysis, Workbook } from "@/types/workbook"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, AlertTriangle, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { TestOptionsDialog } from "./TestOptionsDialog"
import type { TestOptions } from "./TestOptionsDialog"
import { executeTest } from "@/stats/testExecutor2"
import { Loader2 } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AnalysisResultsViewProps {
  analysis: Analysis
  workbook: Workbook
  onUpdateAnalysis: (analysis: Analysis) => void
}

export function AnalysisResultsView({ analysis, workbook, onUpdateAnalysis }: AnalysisResultsViewProps) {
  const [isRecomputing, setIsRecomputing] = useState(false)
  const [progressMsg, setProgressMsg] = useState("")
  const [progressPct, setProgressPct] = useState(0)
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sheet = workbook.sheets.find(s => s.id === analysis.sheetId)
  if (!sheet) {
    return <div className="p-8 text-destructive">Error: Underlying DataSheet not found.</div>
  }

  const { results, report } = analysis

  const handleRecompute = async (options: TestOptions) => {
    setIsOptionsOpen(false)
    setIsRecomputing(true)
    setProgressMsg("Preparing analysis...")
    setProgressPct(0)
    setError(null)
    try {
      const testResult = await executeTest(sheet, options, (p, m) => {
        setProgressPct(p)
        setProgressMsg(m)
      })
      
      const newAnalysis: Analysis = {
        ...analysis,
        options: options,
        results: testResult,
        report: testResult.report_markdown || ""
      }
      
      onUpdateAnalysis(newAnalysis)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setIsRecomputing(false)
    }
  }

  if (isRecomputing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-lg font-medium">{progressMsg}</p>
        <p className="text-sm mt-2 opacity-70">{progressPct}% complete</p>
      </div>
    )

  }

  if (results?.error || error) {
    return (
      <div className="flex-1 p-8">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <h3 className="font-semibold">Analysis Error</h3>
            <p className="text-sm mt-1">{results?.error || error}</p>
          </div>
        </div>
      </div>
    )
  }

  const hasPostHocs = !!results?.post_hocs

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{analysis.testId}</h2>
                <p className="text-sm text-muted-foreground">Data: {sheet.name}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsOptionsOpen(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Test Options
            </Button>
          </div>

          {/* Plain Language Interpretation */}
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Interpretation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report || "No interpretation generated."}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Omnibus Test Results Table */}
            {(results?.statistic != null || results?.p_value != null || results?.degrees_of_freedom != null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Omnibus Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Metric</th>
                          <th className="px-4 py-2 font-medium text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {results?.statistic != null && (
                          <tr className="hover:bg-muted/30">
                            <td className="px-4 py-2">Test Statistic</td>
                            <td className="px-4 py-2 text-right font-medium">{results.statistic?.toFixed(4)}</td>
                          </tr>
                        )}
                        {results?.p_value != null && (
                          <tr className="hover:bg-muted/30">
                            <td className="px-4 py-2">P-value</td>
                            <td className="px-4 py-2 text-right font-medium">{results.p_value?.toExponential(4)}</td>
                          </tr>
                        )}
                        {results?.degrees_of_freedom != null && (
                          <tr className="hover:bg-muted/30">
                            <td className="px-4 py-2">Degrees of Freedom</td>
                            <td className="px-4 py-2 text-right font-medium">{results.degrees_of_freedom}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Effect Sizes */}
            {results?.effect_size && Object.keys(results.effect_size).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Effect Size</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Measure</th>
                          <th className="px-4 py-2 font-medium text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {Object.entries(results.effect_size).map(([key, val]: [string, any]) => (
                          <tr key={key} className="hover:bg-muted/30">
                            <td className="px-4 py-2 capitalize">{key.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-2 text-right">
                              {Array.isArray(val) 
                                ? val.map(v => (typeof v === 'number' ? v.toFixed(4) : String(v))).join(', ') 
                                : (typeof val === 'number' ? val.toFixed(4) : String(val ?? "-"))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Post-Hocs */}
          {hasPostHocs && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Multiple Comparisons</CardTitle>
                <CardDescription>Method: {results.post_hocs.method}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Comparison</th>
                        <th className="px-4 py-2 font-medium text-right">Mean Diff</th>
                        <th className="px-4 py-2 font-medium text-right">Adjusted P Value</th>
                        <th className="px-4 py-2 font-medium text-center">Significant?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.post_hocs.comparisons.map((comp: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{comp.group1} vs {comp.group2}</td>
                          <td className="px-4 py-2 text-right">{comp.mean_diff !== undefined ? comp.mean_diff?.toFixed(4) : "-"}</td>
                          <td className="px-4 py-2 text-right">{comp.p_value < 0.0001 ? "< 0.0001" : comp.p_value?.toFixed(4)}</td>
                          <td className="px-4 py-2 text-center">
                            {comp.significant ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-muted-foreground">No</span>}
                          </td>
                        </tr>
                      ))}
                      {results.post_hocs.comparisons.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                            No comparisons selected or run.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </ScrollArea>

      <TestOptionsDialog 
        open={isOptionsOpen}
        onOpenChange={setIsOptionsOpen}
        sheet={sheet}
        recommendedTestId={analysis.testId}
        assumptions={{ variance: { passed: analysis.options?.postHocTest?.includes("Games-Howell") || analysis.options?.postHocTest?.includes("Welch") ? false : true } }} // Approximation for edit modal if we didn't save assumptions
        onRunTest={handleRecompute}
      />
    </>
  )
}
