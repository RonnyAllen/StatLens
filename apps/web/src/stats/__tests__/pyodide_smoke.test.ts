import { describe, it, expect } from "vitest"
import { loadPyodide } from "pyodide"

// Phase 0 acceptance: "the Pyodide worker loads and the smoke t-test returns a value
// matching SciPy (unit-tested)". This exercises the real Pyodide runtime + scipy package
// load directly (not the Worker message-passing wrapper, which vitest's Node environment
// can't host) — that's the part of the acceptance criterion that can actually break silently.
describe("Pyodide bootstrap smoke test", () => {
  it("loads numpy/scipy in Pyodide and matches a plain-SciPy reference exactly", async () => {
    const pyodide = await loadPyodide()
    await pyodide.loadPackage(["numpy", "scipy"])

    const result = await pyodide.runPythonAsync(`
from scipy import stats
r = stats.ttest_ind([1, 2, 3], [4, 5, 6])
{"statistic": r.statistic, "pvalue": r.pvalue}
    `)
    const { statistic, pvalue } = result.toJs({ dict_converter: Object.fromEntries }) as {
      statistic: number
      pvalue: number
    }

    // Reference computed independently on CPython/SciPy (not inside Pyodide):
    //   scipy.stats.ttest_ind([1,2,3],[4,5,6]) -> statistic=-3.6742346141747673, pvalue=0.021311641128756713
    console.log(`Pyodide computed statistic=${statistic}, pvalue=${pvalue}`)
    expect(statistic).toBeCloseTo(-3.6742346141747673, 6)
    expect(pvalue).toBeCloseTo(0.021311641128756713, 6)
  }, 60_000) // first-run WASM boot + package fetch can take 10-30s — do not lower this
})
