import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { DataSheet } from "@/types/workbook"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2 } from "lucide-react"

export interface TestOptions {
  testId: string
  postHocFamily: "all_pairwise" | "specific_pairs" | "none"
  postHocTest: string
  specificPairs: Array<[string, string]>
  transformOptions?: any
}

interface TestOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sheet: DataSheet
  recommendedTestId: string
  assumptions: any
  onRunTest: (options: TestOptions) => void
}

export function TestOptionsDialog({ open, onOpenChange, sheet, recommendedTestId, assumptions, onRunTest }: TestOptionsDialogProps) {
  const [postHocFamily, setPostHocFamily] = useState<"all_pairwise" | "specific_pairs">("all_pairwise")
  const [selectedPairs, setSelectedPairs] = useState<Array<[string, string]>>([])

  const [integrateBaseline, setIntegrateBaseline] = useState(0)
  const [differentiateOrder, setDifferentiateOrder] = useState(1)
  const [smoothNeighbors, setSmoothNeighbors] = useState(4)
  const [smoothPoly, setSmoothPoly] = useState(2)
  const [splineMethod, setSplineMethod] = useState<"interpolate" | "smooth">("interpolate")
  const [splineKnots, setSplineKnots] = useState(5)
  const [lowessFrac, setLowessFrac] = useState(0.25)


  const groups = sheet.columnGroups.map(g => g.id)

  // Filter groups to only include those that actually have data
  const validGroups = useMemo(() => {
    if (sheet.type === "Grouped" || sheet.type === "Nested") {
      const replicates = (sheet.config as any)?.config?.replicates || (sheet.config as any)?.config?.subcolumns || 1
      return groups.filter(gId => {
        const groupObj = sheet.columnGroups.find(g => g.id === gId)
        if (!groupObj) return false
        // check if any of the subcolumns have data
        const subCols = []
        if (replicates > 1) {
          for (let r = 1; r <= replicates; r++) subCols.push(`${gId}_${r}`)
        } else {
          subCols.push(gId)
        }
        return subCols.some(colId => 
          sheet.data.some(row => row[colId] !== null && row[colId] !== undefined && row[colId] !== "")
        )
      })
    }
    return groups.filter(gId => 
      sheet.data.some(row => row[gId] !== null && row[gId] !== undefined && row[gId] !== "")
    )
  }, [groups, sheet.data, sheet.type, sheet.columnGroups, sheet.config])

  const isPostHocNeeded = (["Column", "Nested", "Survival"].includes(sheet.type) && validGroups.length > 2) || sheet.type === "Grouped" || recommendedTestId === "Three-way ANOVA"

  const allPossiblePairs = useMemo(() => {
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < validGroups.length; i++) {
      for (let j = i + 1; j < validGroups.length; j++) {
        pairs.push([validGroups[i], validGroups[j]])
      }
    }
    return pairs
  }, [validGroups])

  // Dynamically recommend post-hoc test
  const recommendedPostHoc = useMemo(() => {
    if (!isPostHocNeeded) return "None"
    
    if (recommendedTestId.includes("Survival")) {
      return "Pairwise Logrank with Holm correction"
    }
    
    const isParametric = recommendedTestId.includes("ANOVA")
    const isRobustParametric = recommendedTestId.includes("Welch") || recommendedTestId.includes("Brown-Forsythe")
    const equalVar = isRobustParametric ? false : (assumptions?.variance?.passed ?? true)

    if (!isParametric) {
      return "Dunn's test"
    }

    // Calculate max N per group to differentiate Games-Howell vs Dunnett's T3
    let maxN = 0
    validGroups.forEach(gId => {
      const n = sheet.data.filter(row => row[gId] !== null && row[gId] !== undefined && row[gId] !== "").length
      if (n > maxN) maxN = n
    })

    if (postHocFamily === "all_pairwise") {
      if (equalVar) {
        return "Tukey's HSD"
      } else {
        return maxN < 50 ? "Dunnett's T3 test" : "Games-Howell test"
      }
    } else {
      return equalVar ? "Pairwise t-tests with Holm correction" : "Pairwise Welch t-tests with Holm correction"
    }
  }, [isPostHocNeeded, recommendedTestId, assumptions, postHocFamily, validGroups, sheet.data])

  const togglePair = (pair: [string, string]) => {
    setSelectedPairs(prev => {
      const exists = prev.find(p => p[0] === pair[0] && p[1] === pair[1])
      if (exists) {
        return prev.filter(p => !(p[0] === pair[0] && p[1] === pair[1]))
      } else {
        return [...prev, pair]
      }
    })
  }

  const handleRun = () => {
    onRunTest({
      testId: recommendedTestId,
      postHocFamily: isPostHocNeeded ? postHocFamily : "none",
      postHocTest: isPostHocNeeded ? recommendedPostHoc : "None",
      specificPairs: postHocFamily === "specific_pairs" ? selectedPairs : [],
      transformOptions: {
        integrateBaseline,
        differentiateOrder,
        smoothNeighbors,
        smoothPoly,
        splineMethod,
        splineKnots,
        lowessFrac
      }
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Test Options: {recommendedTestId}</DialogTitle>
          <DialogDescription>
            Configure options for the statistical test before execution.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {sheet.type === "Grouped" && (
            <div className="bg-blue-50/50 p-4 rounded-lg flex gap-3 text-blue-900 border border-blue-200">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Looking for Three-way ANOVA?</h4>
                <p className="text-xs leading-snug opacity-90">
                  To perform a Three-way ANOVA, please use the <strong>MultipleVariables</strong> layout, which supports a dependent variable alongside three distinct categorical factor columns.
                </p>
              </div>
            </div>
          )}
          
          
          {recommendedTestId === "Integrate" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Integration Options</h4>
              <div className="space-y-2">
                <Label>Baseline Value (Y=0 equivalent)</Label>
                <Input type="number" value={integrateBaseline} onChange={e => setIntegrateBaseline(Number(e.target.value))} />
              </div>
            </div>
          )}

          {recommendedTestId === "Differentiate" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Differentiation Options</h4>
              <div className="space-y-2">
                <Label>Derivative Order</Label>
                <RadioGroup value={differentiateOrder.toString()} onValueChange={v => setDifferentiateOrder(Number(v))} className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="order-1" />
                    <Label htmlFor="order-1" className="font-normal">1st Derivative (dy/dx)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id="order-2" />
                    <Label htmlFor="order-2" className="font-normal">2nd Derivative (d²y/dx²)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {recommendedTestId === "Smooth" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Savitzky-Golay Smoothing Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Neighbors (Window)</Label>
                  <Input type="number" value={smoothNeighbors} min={2} max={100} onChange={e => setSmoothNeighbors(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Polynomial Order</Label>
                  <Input type="number" value={smoothPoly} min={1} max={5} onChange={e => setSmoothPoly(Number(e.target.value))} />
                </div>
              </div>
            </div>
          )}

          {recommendedTestId === "Fit Spline" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Spline Options</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <RadioGroup value={splineMethod} onValueChange={(v: any) => setSplineMethod(v)} className="mt-2 flex space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="interpolate" id="sp-interp" />
                      <Label htmlFor="sp-interp" className="font-normal">Interpolating (hits every point)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="smooth" id="sp-smooth" />
                      <Label htmlFor="sp-smooth" className="font-normal">Smoothing (approximates)</Label>
                    </div>
                  </RadioGroup>
                </div>
                {splineMethod === "smooth" && (
                  <div className="space-y-2">
                    <Label>Smoothing Factor (s)</Label>
                    <Input type="number" step="0.1" value={splineKnots} onChange={e => setSplineKnots(Number(e.target.value))} />
                  </div>
                )}
              </div>
            </div>
          )}

          {recommendedTestId === "LOWESS" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">LOWESS Options</h4>
              <div className="space-y-2">
                <Label>Smoothing Window Fraction (0 to 1)</Label>
                <Input type="number" step="0.05" min={0.01} max={1} value={lowessFrac} onChange={e => setLowessFrac(Number(e.target.value))} />
              </div>
            </div>
          )}

          {isPostHocNeeded && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Multiple Comparisons (Post-Hoc)</h4>
                <p className="text-sm text-muted-foreground">
                  Since you have more than 2 groups, if the overall test is significant, which groups do you want to compare?
                </p>
                <RadioGroup 
                  value={postHocFamily} 
                  onValueChange={(val: any) => setPostHocFamily(val)}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all_pairwise" id="all_pairwise" />
                    <Label htmlFor="all_pairwise" className="font-normal">
                      Compare every group with every other group
                    </Label>
                  </div>
                  {recommendedTestId !== "Three-way ANOVA" && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specific_pairs" id="specific_pairs" />
                      <Label htmlFor="specific_pairs" className="font-normal">
                        Compare specific pairs of columns
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {postHocFamily === "specific_pairs" && recommendedTestId !== "Three-way ANOVA" && (
                <div className="pl-6 border-l-2 ml-2 space-y-3">
                  <h5 className="text-sm font-medium">Select Pairs to Compare</h5>
                  <ScrollArea className="h-[120px] rounded-md border p-2">
                    <div className="space-y-2">
                      {allPossiblePairs.map((pair) => {
                        const isChecked = !!selectedPairs.find(p => p[0] === pair[0] && p[1] === pair[1])
                        const group1Name = sheet.columnGroups.find(g => g.id === pair[0])?.name || pair[0]
                        const group2Name = sheet.columnGroups.find(g => g.id === pair[1])?.name || pair[1]
                        return (
                          <div key={`${pair[0]}-${pair[1]}`} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`pair-${pair[0]}-${pair[1]}`} 
                              checked={isChecked}
                              onCheckedChange={() => togglePair(pair)}
                            />
                            <Label htmlFor={`pair-${pair[0]}-${pair[1]}`} className="text-sm font-normal">
                              {group1Name} vs {group2Name}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="bg-muted/50 p-4 rounded-lg flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Recommended Post-Hoc: {recommendedPostHoc}</h4>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Based on your data's variance and normality, StatLens automatically selects the most robust post-hoc correction method for your chosen comparisons.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isPostHocNeeded && (
            <div className="bg-muted/50 p-4 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <p className="text-sm">
                This test does not require multiple comparisons setup. It will run directly.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleRun}
            disabled={postHocFamily === "specific_pairs" && selectedPairs.length === 0}
          >
            Run Analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
