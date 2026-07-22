import { describe, it, expect, beforeAll } from 'vitest';
import { loadPyodide } from 'pyodide';
// @ts-ignore
import pythonCode from '../analysis_engine.py?raw';

let pyodide: any;

beforeAll(async () => {
    pyodide = await loadPyodide();
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    
    await pyodide.loadPackage(["pandas", "scipy", "statsmodels", "scikit-learn"]);
    await micropip.install([
        "pingouin",
        "scikit-posthocs",
        "lifelines"
    ]);
}, 120000);

async function runEngine(sheet: any, options: any) {
    const clonedSheet = structuredClone(sheet);
    const clonedOptions = structuredClone(options);
    
    let pyGlobals = pyodide.globals.get("dict")();
    pyGlobals.set("sheet_data", pyodide.toPy(clonedSheet));
    pyGlobals.set("options", pyodide.toPy(clonedOptions));
    pyGlobals.set("update_progress", pyodide.toPy((p: number, m: string) => {}));
    
    const pyResult = await pyodide.runPythonAsync(pythonCode + "\nrun()", { globals: pyGlobals });
    const result = pyResult.toJs({ dict_converter: Object.fromEntries });
    
    return result;
}

describe('Niche Statistical Tests', () => {

    describe("Fisher's Exact Test", () => {
        it('calculates Monte Carlo approximate p-value for 2x3 table', async () => {
            const sheet = {
                type: 'Contingency',
                columnGroups: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' }],
                data: [
                    { rowTitle: 'Group 1', A: 5, B: 0, C: 1 },
                    { rowTitle: 'Group 2', A: 0, B: 6, C: 2 }
                ]
            };
            const options = { testId: "Fisher's Exact Test" };
            const result = await runEngine(sheet, options);
            expect(result.error).toBeUndefined();
            expect(result.p_value).toBeDefined();
            expect(result.p_value).toBeDefined();
            expect(result.p_value).toBeLessThan(0.05);
            expect(result.report_markdown).toContain('Fisher-Freeman-Halton');
        }, 30000);

        it('edge case: rejects 0x0 or empty table', async () => {
            const sheet = {
                type: 'Contingency',
                columnGroups: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }],
                data: [
                    { rowTitle: 'Group 1', A: null, B: null },
                    { rowTitle: 'Group 2', A: null, B: null }
                ]
            };
            const options = { testId: "Fisher's Exact Test" };
            const result = await runEngine(sheet, options);
            expect(result.error).toContain('Insufficient data');
        }, 15000);
    });

    describe('Cochran-Armitage Trend Test', () => {
        it('calculates Z-statistic for trend across ordinal groups (2xC)', async () => {
            const sheet = {
                type: 'Contingency',
                columnGroups: [{ id: 'Dose 1', name: 'Dose 1' }, { id: 'Dose 2', name: 'Dose 2' }, { id: 'Dose 3', name: 'Dose 3' }],
                data: [
                    { rowTitle: 'Success', 'Dose 1': 2, 'Dose 2': 15, 'Dose 3': 28 },
                    { rowTitle: 'Failure', 'Dose 1': 28, 'Dose 2': 15, 'Dose 3': 2 }
                ]
            };
            const options = { testId: 'Cochran-Armitage Trend Test' };
            const result = await runEngine(sheet, options);
            expect(result.error).toBeUndefined();
            expect(result.statistic).toBeDefined();
            expect(result.p_value).toBeDefined();
            expect(result.p_value).toBeLessThan(0.001);
            expect(result.report_markdown).toContain('Cochran-Armitage Trend Test');
        });

        it('edge case: rejects tables without a binary dimension', async () => {
            const sheet = {
                type: 'Contingency',
                columnGroups: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' }],
                data: [
                    { rowTitle: 'X', A: 1, B: 2, C: 3 },
                    { rowTitle: 'Y', A: 4, B: 5, C: 6 },
                    { rowTitle: 'Z', A: 7, B: 8, C: 9 }
                ]
            };
            const options = { testId: 'Cochran-Armitage Trend Test' };
            const result = await runEngine(sheet, options);
            expect(result.error).toContain('requires one dimension to be binary');
        });
    });

    describe('Log-rank Trend Test', () => {
        it('computes trend test for survival data with 3 ordinal groups', async () => {
            const sheet = {
                type: 'Survival',
                columnGroups: [{ id: 'Low', name: 'Low' }, { id: 'Medium', name: 'Medium' }, { id: 'High', name: 'High' }],
                data: [
                    { rowTitle: 10, Low: 1, Medium: null, High: null },
                    { rowTitle: 20, Low: 1, Medium: null, High: null },
                    { rowTitle: 5,  Low: null, Medium: 1, High: null },
                    { rowTitle: 15, Low: null, Medium: 1, High: null },
                    { rowTitle: 2,  Low: null, Medium: null, High: 1 },
                    { rowTitle: 4,  Low: null, Medium: null, High: 1 },
                ]
            };
            const options = { testId: 'Log-rank Trend Test' };
            const result = await runEngine(sheet, options);
            expect(result.error).toBeUndefined();
            expect(result.statistic).toBeDefined();
            expect(result.p_value).toBeDefined();
            expect(result.report_markdown).toContain('Log-rank Trend Test');
        });
        
        it('edge case: fails cleanly with < 3 groups', async () => {
            const sheet = {
                type: 'Survival',
                columnGroups: [{ id: 'Low', name: 'Low' }, { id: 'High', name: 'High' }],
                data: [
                    { rowTitle: 10, Low: 1, High: null },
                    { rowTitle: 20, Low: 1, High: null },
                    { rowTitle: 2,  Low: null, High: 1 },
                    { rowTitle: 4,  Low: null, High: 1 },
                ]
            };
            const options = { testId: 'Log-rank Trend Test' };
            const result = await runEngine(sheet, options);
            expect(result.error).toContain('Not enough data');
        });
    });

    describe('Partial Correlation', () => {
        it('computes partial correlation for 3 variables', async () => {
            const sheet = {
                type: 'MultipleVariables',
                columnGroups: [{ id: 'X', name: 'X' }, { id: 'Y', name: 'Y' }, { id: 'Z', name: 'Z' }],
                data: [
                    { X: 1, Y: 2, Z: 3 },
                    { X: 2, Y: 5, Z: 7 },
                    { X: 3, Y: 5, Z: 8 },
                    { X: 4, Y: 8, Z: 12 },
                    { X: 5, Y: 9, Z: 14 }
                ]
            };
            const options = { testId: 'Partial Correlation' };
            const result = await runEngine(sheet, options);
            expect(result.error).toBeUndefined();
            expect(result.statistic).toBeDefined(); // r value
            expect(result.p_value).toBeDefined();
            expect(result.report_markdown).toContain('Partial Correlation (Pearson)');
        });

        it('edge case: rejects dataset with only 2 variables', async () => {
            const sheet = {
                type: 'MultipleVariables',
                columnGroups: [{ id: 'X', name: 'X' }, { id: 'Y', name: 'Y' }],
                data: [
                    { X: 1, Y: 2 },
                    { X: 2, Y: 4 },
                    { X: 3, Y: 6 }
                ]
            };
            const options = { testId: 'Partial Correlation' };
            const result = await runEngine(sheet, options);
            expect(result.error).toContain('requires at least 3 numeric variables');
        });
    });

    describe('Fraction of Total', () => {
        it('computes fraction of total and Wilson CIs', async () => {
            const sheet = {
                type: 'PartsOfWhole',
                columnGroups: [{ id: 'Counts', name: 'Counts' }],
                data: [
                    { rowTitle: 'A', Counts: 40 },
                    { rowTitle: 'B', Counts: 60 }
                ]
            };
            const options = { testId: 'Fraction of Total', fotDisplayAs: 'percentages' };
            const result = await runEngine(sheet, options);
            expect(result.error).toBeUndefined();
            expect(result.report_markdown).toContain('40.00000%');
            expect(result.report_markdown).toContain('60.00000%');
            expect(result.report_markdown).toContain('Divide by Column Total');
        });

        it('edge case: rejects when total sum is 0', async () => {
            const sheet = {
                type: 'PartsOfWhole',
                columnGroups: [{ id: 'Counts', name: 'Counts' }],
                data: [
                    { rowTitle: 'A', Counts: 0 },
                    { rowTitle: 'B', Counts: 0 }
                ]
            };
            const options = { testId: 'Fraction of Total' };
            const result = await runEngine(sheet, options);
            expect(result.error).toContain('Total sum must be strictly positive.');
        });
    });
});
