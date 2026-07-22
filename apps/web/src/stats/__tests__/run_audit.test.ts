import { describe, it, expect, beforeAll } from 'vitest';
// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { loadPyodide } from 'pyodide';
// @ts-ignore
import pythonCode from '../analysis_engine.py?raw';

let pyodide: any;

// Load golden values synchronously at top level for dynamic test generation
const jsonPath = path.join(__dirname, 'golden_values.json');
const goldenValues = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : {};

beforeAll(async () => {
    // Initialize pyodide for Node
    pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    
    // Install the same packages as the real app
    console.log("Loading core pyodide packages...");
    await pyodide.loadPackage(["pandas", "scipy", "statsmodels", "scikit-learn"]);
    console.log("Installing pure python packages via micropip...");
    await micropip.install([
        "pingouin",
        "scikit-posthocs",
        "lifelines"
    ]);
    console.log("Packages installed.");
}, 120000); // 2 minutes timeout for installation

// The test imports the raw production file directly (`../analysis_engine.py?raw`)
// so we are guaranteed to be testing the actual code used by the app.

// Helper to run the engine simulating exact WebWorker serialization
async function runEngine(sheet: any, options: any) {
    // 1. Simulate the exact postMessage serialization (structuredClone)
    const clonedSheet = structuredClone(sheet);
    const clonedOptions = structuredClone(options);
    
    // 2. Expose data to global scope exactly like pyodide.worker2.ts does
    let pyGlobals = pyodide.globals.get("dict")();
    pyGlobals.set("sheet_data", pyodide.toPy(clonedSheet));
    pyGlobals.set("options", pyodide.toPy(clonedOptions));
    pyGlobals.set("update_progress", pyodide.toPy((p: number, m: string) => {}));
    
    // Execute the main script
    const pyResult = await pyodide.runPythonAsync(pythonCode + "\nrun()", { globals: pyGlobals });
    const result = pyResult.toJs({ dict_converter: Object.fromEntries });
    
    pyResult.destroy();
    pyGlobals.destroy();
    
    return result;
}

describe('StatLens Blind Accuracy Audit', () => {
    // Generate tests dynamically
    for (const [testName, testCase] of Object.entries(goldenValues)) {
        if (!testCase) continue;
        
        it(`${testName} matches Oracle`, async () => {
            const result = await runEngine((testCase as any).dataset, (testCase as any).options);
            
            expect(result.error).toBeUndefined();
            expect(result.report_markdown).toBeDefined();
            
            const expected = (testCase as any).expected;
            const tol = parseFloat((testCase as any).tolerance);
            
            // Dump the result so we can see all exact outputs
            console.log(`FULL RESULT [${testName}]:`, JSON.stringify(result, null, 2));
            
            if (expected.statistic !== undefined && expected.statistic !== null) {
                expect(result.statistic).toBeDefined();
                expect(Math.abs(result.statistic - expected.statistic)).toBeLessThanOrEqual(tol);
            }
            if (expected.p_value !== undefined && expected.p_value !== null) {
                expect(result.p_value).toBeDefined();
                expect(Math.abs(result.p_value - expected.p_value)).toBeLessThanOrEqual(tol);
            }
            if (expected.effect_size) {
                for (const [k, v] of Object.entries(expected.effect_size)) {
                    expect(result.effect_size[k]).toBeDefined();
                    expect(Math.abs((result.effect_size[k] as number) - (v as number))).toBeLessThanOrEqual(tol);
                }
            }
            if (expected.post_hocs) {
                expect(result.post_hocs).toBeDefined();
                expect(result.post_hocs.comparisons).toBeDefined();
                for (const [pair_key, expected_p] of Object.entries(expected.post_hocs)) {
                    const [g1, g2] = pair_key.split(' vs ');
                    const match = result.post_hocs.comparisons.find((c: any) => 
                        (c.group1 === g1 && c.group2 === g2) || (c.group1 === g2 && c.group2 === g1)
                    );
                    expect(match).toBeDefined();
                    if (expected_p === "AWAITING EXTERNAL VERIFICATION") {
                        console.log(`Skipping verification for ${pair_key} due to no independent oracle`);
                    } else {
                        if (Math.abs(match.p_value - (expected_p as number)) > 0.001) {
                            console.log(`Mismatch in post_hocs for ${pair_key}: expected ${expected_p}, got ${match.p_value}`);
                        }
                        expect(Math.abs(match.p_value - (expected_p as number))).toBeLessThanOrEqual(0.001);
                    }
                }
            }
            if (expected.results) {
                expect(result.results).toBeDefined();
                const expected_res = expected.results[0];
                const actual_res = result.results[0];
                for (const [k, v] of Object.entries(expected_res)) {
                    expect(actual_res[k]).toBeDefined();
                    expect(Math.abs(actual_res[k] - (v as number))).toBeLessThanOrEqual(tol);
                }
            }
            if (expected.degrees_of_freedom !== undefined) {
                expect(result.degrees_of_freedom).toBeDefined();
                // Compare as string since it could be "18" or "2, 18"
                expect(String(result.degrees_of_freedom)).toBe(String(expected.degrees_of_freedom));
            }
            if (expected.confidence_intervals) {
                expect(result.confidence_intervals).toBeDefined();
                expect(result.confidence_intervals.length).toBe(2);
                expect(Math.abs(result.confidence_intervals[0] - expected.confidence_intervals[0])).toBeLessThanOrEqual(tol);
                expect(Math.abs(result.confidence_intervals[1] - expected.confidence_intervals[1])).toBeLessThanOrEqual(tol);
            }
            if (expected.report_contains) {
                expect(result.report_markdown).toBeDefined();
                for (const text of expected.report_contains) {
                    if (!result.report_markdown.includes(text)) {
                        console.log(`Expected report to contain "${text}", but it did not.\nReport:\n${result.report_markdown}`);
                    }
                    expect(result.report_markdown).toContain(text);
                }
            }
            if (result.report_markdown) {
                expect(result.report_markdown.includes('\\n')).toBe(false);
            }

        }, 120000);
    }

    it('Pyodide probe', async () => {
        const pyCode = `
from scipy.stats import studentized_range, tukey_hsd
import numpy as np

print("studentized_range.sf(4.0, 3, 8) =", float(studentized_range.sf(4.0, 3, 8)))

try:
    from statsmodels.stats.libqsturng import psturng
    print("psturng(4.0, 3, 8) =", float(psturng(4.0, 3, 8)))
except Exception as e:
    print("psturng error:", e)

th = tukey_hsd([1.2,1.4,2.1],[0.8,1.1,1.7,1.9,2.0],[3.1,3.2,3.3])
print("tukey p G1vG2, G1vG3, G2vG3 =", th.pvalue[0,1], th.pvalue[0,2], th.pvalue[1,2])
`;
        await pyodide.runPythonAsync(pyCode);
    });
    
    it('Contingency tables with decimal values return validation error', async () => {
        const sheet = {
            id: 'mock_sheet',
            name: 'Contingency Test',
            type: 'Contingency',
            columnGroups: [
                { id: 'c1', name: 'Group 1' },
                { id: 'c2', name: 'Group 2' }
            ],
            data: [
                { rowTitle: 'Outcome A', c1: 10.5, c2: 20 },
                { rowTitle: 'Outcome B', c1: 15, c2: 25 }
            ]
        };
        const options = { testId: 'Chi-Square test' };
        const result = await runEngine(sheet, options);
        expect(result.error).toBe('Contingency values must be non-negative integers (counts)');
        expect(result.statistic).toBeUndefined();
    });
});
