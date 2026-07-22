import os

file_path = 'apps/web/src/components/workspace/TestOptionsDialog.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update TestOptions interface
interface_target = """export interface TestOptions {
  testId: string
  postHocFamily: "all_pairwise" | "specific_pairs" | "control_vs_others" | "none"
  postHocTest: string
  specificPairs: Array<[string, string]>
  /** Column-group id of the control column. Only set when postHocFamily === "control_vs_others". */
  controlGroup?: string
  tails?: "two-sided" | "less" | "greater"
  transformOptions?: any
}"""

interface_replacement = """export interface TestOptions {
  testId: string
  postHocFamily: "all_pairwise" | "specific_pairs" | "control_vs_others" | "none"
  postHocTest: string
  specificPairs: Array<[string, string]>
  /** Column-group id of the control column. Only set when postHocFamily === "control_vs_others". */
  controlGroup?: string
  tails?: "two-sided" | "less" | "greater"
  transformOptions?: any
  // Fraction of Total Options
  fotDivideBy?: "column" | "row" | "grand" | "all"
  fotDisplayAs?: "fractions" | "percentages"
  fotCalculateCI?: boolean
  fotCILevel?: number
  // Chi-Square Goodness of Fit Options
  chiSelectedColumn?: string
  chiExpectedType?: "actual" | "percentages"
  chiExpectedValues?: Record<string, number>
}"""

content = content.replace(interface_target, interface_replacement)

# 2. Add state variables inside TestOptionsDialog
state_target = """  const [threeWayAnova, setThreeWayAnova] = useState(false)
  const [sphericityCorrection, setSphericityCorrection] = useState<"none" | "GG" | "HF">("none")
  const [tails, setTails] = useState<"two-sided" | "less" | "greater">("two-sided")"""

state_replacement = state_target + """
  
  // New States
  const [fotDivideBy, setFotDivideBy] = useState<"column" | "row" | "grand" | "all">("column")
  const [fotDisplayAs, setFotDisplayAs] = useState<"fractions" | "percentages">("fractions")
  const [fotCalculateCI, setFotCalculateCI] = useState<boolean>(true)
  const [fotCILevel, setFotCILevel] = useState<number>(95)

  const [chiSelectedColumn, setChiSelectedColumn] = useState<string>("")
  const [chiExpectedType, setChiExpectedType] = useState<"actual" | "percentages">("actual")
  const [chiExpectedValues, setChiExpectedValues] = useState<Record<string, number>>({})
"""

content = content.replace(state_target, state_replacement)

# 3. Add useEffect to initialize chiSelectedColumn and reset chiExpectedValues when it changes
use_effect_target = """  useEffect(() => {
    setMethodOverride("")
  }, [recommendedTestId])"""

use_effect_replacement = use_effect_target + """

  useEffect(() => {
    if (validGroups.length > 0 && !chiSelectedColumn) {
      setChiSelectedColumn(validGroups[0])
    }
  }, [validGroups, chiSelectedColumn])
  
  // Extract valid rows for the currently selected column
  const chiValidRows = useMemo(() => {
    if (!chiSelectedColumn) return []
    return sheet.data
      .map((row, idx) => {
        const val = row[chiSelectedColumn]
        if (val !== null && val !== undefined && val !== "") {
          return { id: idx, title: row.rowTitle || `Row ${idx + 1}`, observed: parseFloat(val as string) || 0 }
        }
        return null
      })
      .filter(Boolean) as { id: number, title: string, observed: number }[]
  }, [sheet.data, chiSelectedColumn])
"""

content = content.replace(use_effect_target, use_effect_replacement)

# 4. Modify handleRunTest
handle_run_target = """    onRunTest({
      testId: effectiveTestId,
      postHocFamily,
      postHocTest,
      specificPairs: selectedPairs,
      controlGroup,
      tails,
      transformOptions: {
        integrateBaseline,
        differentiateOrder,
        smoothNeighbors,
        smoothPoly,
        splineMethod,
        splineKnots,
        lowessFrac,
      }
    })
    onOpenChange(false)
  }"""

handle_run_replacement = """    onRunTest({
      testId: effectiveTestId,
      postHocFamily,
      postHocTest,
      specificPairs: selectedPairs,
      controlGroup,
      tails,
      transformOptions: {
        integrateBaseline,
        differentiateOrder,
        smoothNeighbors,
        smoothPoly,
        splineMethod,
        splineKnots,
        lowessFrac,
      },
      fotDivideBy,
      fotDisplayAs,
      fotCalculateCI,
      fotCILevel,
      chiSelectedColumn,
      chiExpectedType,
      chiExpectedValues,
    })
    onOpenChange(false)
  }"""

content = content.replace(handle_run_target, handle_run_replacement)

# 5. Insert new UI blocks for Fot and ChiSq in the main form rendering
render_target = """          {/* Transform Data specific options */}"""

render_replacement = """          {/* Fraction of Total options */}
          {effectiveTestId === "Fraction of Total" && (
            <div className="space-y-6 pt-2">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Divide each value by its:</Label>
                <RadioGroup value={fotDivideBy} onValueChange={(v: any) => setFotDivideBy(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="column" id="fot-col" />
                    <Label htmlFor="fot-col" className="font-normal">Column total</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="row" id="fot-row" />
                    <Label htmlFor="fot-row" className="font-normal">Row total</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="grand" id="fot-grand" />
                    <Label htmlFor="fot-grand" className="font-normal">Grand total</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="fot-all" />
                    <Label htmlFor="fot-all" className="font-normal">All the above</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Display results as:</Label>
                <RadioGroup value={fotDisplayAs} onValueChange={(v: any) => setFotDisplayAs(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fractions" id="fot-frac" />
                    <Label htmlFor="fot-frac" className="font-normal">Fractions</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentages" id="fot-pct" />
                    <Label htmlFor="fot-pct" className="font-normal">Percentages</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3 border p-4 rounded-md">
                <Label className="text-base font-semibold">Confidence intervals</Label>
                <div className="flex items-center space-x-3 mt-2">
                  <Checkbox 
                    id="fot-calc-ci" 
                    checked={fotCalculateCI} 
                    onCheckedChange={(c: boolean) => setFotCalculateCI(c)} 
                  />
                  <Label htmlFor="fot-calc-ci" className="font-normal">Calculate</Label>
                  <Input 
                    type="number" 
                    className="w-20 h-8" 
                    value={fotCILevel} 
                    onChange={e => setFotCILevel(Number(e.target.value))} 
                    disabled={!fotCalculateCI}
                    min={1} max={99}
                  />
                  <span className="text-sm text-muted-foreground">% confidence intervals</span>
                </div>
                {fotCalculateCI && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm rounded-md border border-yellow-200 dark:border-yellow-900">
                    Confidence intervals assume binomial data - that each entered value is actual number of objects or events, not normalized in any way.
                    Method: Wilson/Brown.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chi-Square goodness of fit options */}
          {effectiveTestId === "Chi-Square goodness of fit" && (
            <div className="space-y-6 pt-2">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm rounded-md border border-yellow-200 dark:border-yellow-900">
                This analysis expects that each value in the data table is an actual number of events or items, and is not normalized in any way.
              </div>
              
              {validGroups.length > 1 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Data set to analyze:</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={chiSelectedColumn}
                    onChange={(e) => setChiSelectedColumn(e.target.value)}
                  >
                    {validGroups.map(g => (
                      <option key={g} value={g}>{sheet.columnGroups.find(x => x.id === g)?.name || g}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-base font-semibold">Enter expected values as:</Label>
                <RadioGroup value={chiExpectedType} onValueChange={(v: any) => setChiExpectedType(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="actual" id="chi-act" />
                    <Label htmlFor="chi-act" className="font-normal">Actual numbers of objects or events</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentages" id="chi-pct" />
                    <Label htmlFor="chi-pct" className="font-normal">Percentages</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Expected distribution</Label>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Outcome</th>
                        <th className="px-3 py-2 font-medium">Observed #</th>
                        <th className="px-3 py-2 font-medium">Expected {chiExpectedType === "percentages" ? "%" : "#"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chiValidRows.map((row, index) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                          <td className="px-3 py-2 font-medium">{row.title}</td>
                          <td className="px-3 py-2">{row.observed}</td>
                          <td className="px-3 py-1">
                            <Input 
                              type="number" 
                              className="w-24 h-8"
                              value={chiExpectedValues[row.id] ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setChiExpectedValues(prev => ({
                                  ...prev,
                                  [row.id]: val === "" ? undefined : parseFloat(val)
                                } as any))
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Transform Data specific options */}"""

content = content.replace(render_target, render_replacement)

with open(file_path, 'w') as f:
    f.write(content)
print("Patched TestOptionsDialog.tsx successfully!")
