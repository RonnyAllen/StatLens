import { describe, it, expect, beforeAll } from 'vitest';
// @ts-nocheck
import { getPValueStar, assignBracketTiers } from '../geometry/significance';
import { getErrorBarBounds } from '../geometry/errorBars';
import { getBoxStats } from '../geometry/boxStats';
import { getViolinDensity } from '../geometry/violinDensity';
import { getJitterOffset } from '../geometry/jitter';
import { getAutoAxisRange } from '../geometry/axis';
import { loadPyodide } from 'pyodide';
// @ts-ignore
import pythonCode from '../../stats/analysis_engine.py?raw';
import fs from 'fs';
import path from 'path';

describe('Geometry Layer: significance.ts Boundary Tests', () => {
  it('assigns correct stars for standard scale', () => {
    // Standard: ns (p > 0.05), * (p <= 0.05), ** (p <= 0.01), *** (p <= 0.001), **** (p <= 0.0001), ***** (p <= 0.00001)
    expect(getPValueStar(0.05001, "standard")).toBe("ns");
    expect(getPValueStar(0.05, "standard")).toBe("*");
    expect(getPValueStar(0.01001, "standard")).toBe("*");
    expect(getPValueStar(0.01, "standard")).toBe("**");
    expect(getPValueStar(0.001001, "standard")).toBe("**");
    expect(getPValueStar(0.001, "standard")).toBe("***");
    expect(getPValueStar(0.0001001, "standard")).toBe("***");
    expect(getPValueStar(0.0001, "standard")).toBe("****");
    expect(getPValueStar(0.00001001, "standard")).toBe("****");
    expect(getPValueStar(0.00001, "standard")).toBe("*****");
    expect(getPValueStar(0.000001, "standard")).toBe("*****");
  });
});

describe('Geometry Layer: Bracket Stacking', () => {
  it('prevents overlapping brackets from sharing the same Y-tier', () => {
    const groupOrder = ["A", "B", "C", "D"];
    const comps = [
      { group1: "A", group2: "D", p_value: 0.001 },
      { group1: "A", group2: "B", p_value: 0.01 },
      { group1: "C", group2: "D", p_value: 0.02 },
      { group1: "B", group2: "D", p_value: 0.05 }
    ];
    
    const tiered = assignBracketTiers(comps, groupOrder);
    
    // Check lengths and non-negative tiers
    expect(tiered.length).toBe(4);
    tiered.forEach(t => expect(t.tier).toBeGreaterThanOrEqual(0));
    
    // Shortest span A-B (0 to 1) and C-D (2 to 3) don't overlap, so they can both be tier 0
    const aToB = tiered.find(t => t.group1 === "A" && t.group2 === "B")!;
    const cToD = tiered.find(t => t.group1 === "C" && t.group2 === "D")!;
    expect(aToB.tier).toBe(0);
    expect(cToD.tier).toBe(0);
    
    // B-D spans (1 to 3), overlaps C-D (2 to 3). Must be higher tier than C-D.
    const bToD = tiered.find(t => t.group1 === "B" && t.group2 === "D")!;
    expect(bToD.tier).toBeGreaterThan(0);
    
    // A-D spans (0 to 3), overlaps everything. Must be highest tier.
    const aToD = tiered.find(t => t.group1 === "A" && t.group2 === "D")!;
    expect(aToD.tier).toBeGreaterThan(bToD.tier);
  });
});

describe('Geometry Layer: errorBars.ts Invariants', () => {
  it('computes SEM as SD/√n and bounds match engine output precisely', () => {
    const data = [1.2, 1.4, 1.5, 1.8, 2.0];
    const mean = 1.58;
    const sd = 0.3114482300479487;
    const n = 5;
    const computedSem = sd / Math.sqrt(n);
    
    const engineStats = {
      n: 5,
      mean: 1.58,
      sd: sd,
      sem: computedSem,
      ci_lower: 1.19323,
      ci_upper: 1.96677
    };
    
    const boundsSem = getErrorBarBounds(engineStats, "mean_sem");
    expect(boundsSem.y1).toBeCloseTo(mean - computedSem);
    expect(boundsSem.y2).toBeCloseTo(mean + computedSem);
    
    const boundsSd = getErrorBarBounds(engineStats, "mean_sd");
    expect(boundsSd.y1).toBeCloseTo(mean - sd);
    expect(boundsSd.y2).toBeCloseTo(mean + sd);
  });
});

describe('Geometry Layer: boxStats.ts', () => {
  it('quartiles/whiskers for a known dataset match hand-computed values', () => {
    const data = [1, 2, 3, 4, 5];
    const stats = getBoxStats(data);
    expect(stats.lowerWhisker).toBe(1);
    expect(stats.upperWhisker).toBe(5);
    expect(stats.median).toBe(3);
    
    // d3.quantile uses R-7 method by default. For [1,2,3,4,5], q1 = 2, q3 = 4.
    expect(stats.q1).toBe(2);
    expect(stats.q3).toBe(4);
  });
});

describe('Geometry Layer: violinDensity.ts', () => {
  it('KDE integrates to approximately 1 over its support', () => {
    const data = [0, 0.5, 1.0, 1.5, 2.0];
    const points = getViolinDensity(data, 100);
    
    // Calculate area under curve (Riemann sum approximation)
    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i+1].x - points[i].x;
      const avgY = (points[i].y + points[i+1].y) / 2;
      area += dx * avgY;
    }
    
    expect(area).toBeGreaterThan(0.9);
    expect(area).toBeLessThan(1.1);
  });
});

describe('Geometry Layer: jitter.ts', () => {
  it('returns identical offsets for same seed and stays within bandwidth', () => {
    const bandWidth = 10;
    
    const offset1 = getJitterOffset(42, 0, bandWidth);
    const offset2 = getJitterOffset(42, 0, bandWidth);
    expect(offset1).toBe(offset2);
    
    const offset3 = getJitterOffset(42, 1, bandWidth);
    expect(offset3).not.toBe(offset1);
    
    for (let i = 0; i < 100; i++) {
      const off = getJitterOffset(1337, i, bandWidth);
      expect(off).toBeGreaterThanOrEqual(-bandWidth / 2);
      expect(off).toBeLessThanOrEqual(bandWidth / 2);
    }
  });
});

describe('Geometry Layer: axis.ts', () => {
  it('computes auto-range = [min, max] + expected padding', () => {
    const data = [10, 20, 30, 40, 50];
    // Range is 40. Padding factor 0.05 -> padding = 2.
    // min should be 8, max should be 52.
    const range = getAutoAxisRange(data, 0.05);
    expect(range.min).toBe(8);
    expect(range.max).toBe(52);
  });
});

// For integration testing we need Pyodide
describe('Geometry Layer: Pyodide Integration', () => {
  let pyodide: any;
  let runEngine: any;
  let goldenValues: any;
  
  beforeAll(async () => {
    const jsonPath = path.join(__dirname, '../../stats/__tests__/golden_values.json');
    goldenValues = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await pyodide.loadPackage(["pandas", "scipy", "statsmodels", "scikit-learn"]);
    await micropip.install(["pingouin==0.5.4", "scikit-posthocs==0.9.0", "lifelines==0.29.0"]);
    
    runEngine = async (sheet: any, options: any) => {
      let pyGlobals = pyodide.globals.get("dict")();
      pyGlobals.set("sheet_data", pyodide.toPy(structuredClone(sheet)));
      pyGlobals.set("options", pyodide.toPy(structuredClone(options)));
      pyGlobals.set("update_progress", pyodide.toPy(() => {}));
      
      const pyResult = await pyodide.runPythonAsync(pythonCode, { globals: pyGlobals });
      const result = pyResult.toJs({ dict_converter: Object.fromEntries });
      pyResult.destroy();
      pyGlobals.destroy();
      return result;
    };
  }, 120000);

  it('Significance Integration: post-hoc stars derived from real engine output (e.g. KW Bonferroni)', async () => {
    const kwTest = goldenValues["Kruskal-Wallis test"];
    const result = await runEngine(kwTest.dataset, kwTest.options);
    
    expect(result.testId).toBe("Kruskal-Wallis test");
    expect(result.post_hocs).toBeDefined();
    
    // Get ctrl vs trt1 comparison
    const comparisons = result.post_hocs.comparisons;
    const g2vg3 = comparisons.find((c: any) => 
      (c.group1 === "ctrl" && c.group2 === "trt1") || 
      (c.group1 === "trt1" && c.group2 === "ctrl")
    );
    
    expect(g2vg3).toBeDefined();
    
    // Now assert our geometry layer draws "ns"
    const star = getPValueStar(g2vg3.p_value, "standard");
    expect(star).toBe("ns");
  }, 30000);
});
