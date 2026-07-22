# Progress Log

## Phase 0 & 1
- **What was built:** 
  - Scaffolded `apps/web` with Vite, React, TypeScript Strict.
  - Tailwind CSS + shadcn/ui foundation configured with light/dark theme toggles persisting in localStorage.
  - Setup Pyodide in a dedicated Web Worker to load scipy, numpy, pandas, statsmodels, scikit-learn, pingouin, scikit-posthocs, and lifelines, with a smoke test confirming execution.
  - Configured Google Identity Services (GIS) for browser-only OAuth with `drive.file` scopes.
  - Developed `DriveAPI` wrapper to create a `StatLens` folder, list `.statlens` files, and create/save workbook JSON files securely to the user's Google Drive.
  - Built the main Dashboard UI representing logged in vs logged out states, with a list of workbooks.
- **How it was verified:** Ran `tsc -b && vite build` which succeeded cleanly. Wrote an integration smoke test for Pyodide stats engine.
- **Known limitations:** Empty workbooks are created via Drive API but the spreadsheet data grid view itself is coming in Phase 2.

## Phase 2
- **What was built:**
  - Integrated `react-router-dom` to support nested application states (`/dashboard` vs `/workbook/:id`).
  - Created a modular **Workspace** shell with a collapsible sidebar navigator for sheets, analyses, and graphs. Added global StatLens branding and profile sign-out flows.
  - Implemented the **DataTableChooser** modal to allow creation of 8 standard GraphPad Prism-style data tables (XY, Column, Grouped, etc.), including support for generating dummy sample data.
  - Integrated **AG Grid** (`ag-grid-community`, `ag-grid-react`) for high-performance table editing. Since AG Grid Community lacks native multi-cell selection and clipboard support, built a **custom selection engine** mimicking Excel/Prism:
    - Custom keyboard listeners for `Shift+Arrow` expansion.
    - Global 50-step `Undo/Redo` stack tied directly to the React state.
    - Right-click context menu (via Radix UI) mapping Cut/Copy/Paste/Delete natively.
    - Hand-rolled clipboard parser enabling seamless multidimensional data paste from Excel/Prism into the grid.
  - Injected dynamic AMOLED Dark Mode linking straight into AG Grid's native theming API `colorSchemeDark`.
  - Added robust `useDebounce` saving logic seamlessly tied to the AG Grid `onCellValueChanged` event. Modified `DriveAPI.updateWorkbook` to use `PATCH` and media multipart uploads to save the application's JSON representation strictly back to the user's Google Drive.
- **How it was verified:** User visually tested all spreadsheet edge-cases on screen, ran `tsc -b && vite build` successfully.
- **Known limitations:** Advanced AG grid grouped columns for Replicates/Subcolumns are flattened for now. Data tables are currently purely structural; Pyodide integration with them happens in Phase 3.

## Phase 3
- **What was built:**
  - Integrated a Python Recommender system operating entirely within the Pyodide Web Worker.
  - Implemented dynamic global passing of the JS `DataSheet` payload into Pyodide via `pyodide.globals`.
  - Used `pandas` and `scipy.stats` inside Pyodide to automatically parse data matrices, discard NaN fields, compute group-wise descriptive statistics (N, Mean, Std Dev, SEM, Min, Max), and test for normality (Shapiro-Wilk) and equal variance (Levene).
  - Wrote a complex, logic-gated Recommender tree for `Column` and `Contingency` tables that returns plain-text recommendations and rationales (e.g., Unpaired vs Paired t-tests, Welch's t-test, Mann-Whitney, ANOVAs, Kruskal-Wallis, Fisher Exact, Chi-Square).
  - Added an "Analyze" mode to the main `Workspace`, which replaces the AG Grid view with a rich `AnalyzePanel.tsx` that highlights the recommended statistical tests, renders pass/fail assumption badges, and displays a clean descriptives table.
- **How it was verified:** Ran `tsc -b && vite build` which succeeded cleanly. Set up a dummy vitest unit test for the Pyodide wrapper.
- **Known limitations:** The recommendation engine currently only covers `Column` and `Contingency` table types as a proof of concept. The "Analyze" tab performs a real-time recalculation, which takes ~0.5s for Pyodide to spin up/serialize on every tab switch.

## Phase 4
- **What was built:**
  - Architected a universal `analysis_engine.py` in the Pyodide Web Worker responsible for consuming robust datasets and yielding rich standard JSON representations of statistical test results.
  - Built support for 18 distinct complex test families: Unpaired/Paired t-tests, Welch's t-test, Mann-Whitney, Wilcoxon, Ordinary/Welch's/Repeated-Measures ANOVA, Kruskal-Wallis, Friedman, Two-Way ANOVA (Type III), Nested ANOVA, Chi-Square (with/without Yates), Fisher's Exact, Deming Regression, and Kaplan-Meier Hazard Ratios.
  - Automated dynamic markdown `report_markdown` generation for all tests which translates test results directly into human-readable conclusions formatted to APA standards.
  - Implemented exact Post-Hoc engines supporting Tukey's HSD, Dunnett's T3, and specialized non-parametric Dunn's/Conover methods using `scikit-posthocs` and `pingouin`.
  - Hardened the engine heavily via Phase 4.7 blind audit using an independent reference test harness (anchored against R `webr` and canonical scipy math). 
  - Isolated and bypassed severe WASM-specific numerical integration Pyodide bugs affecting `statsmodels.tukeyhsd` and `studentized_range`.
  - Pinned `pingouin`, `scikit-posthocs`, and `lifelines` to exact versions in the worker.
- **How it was verified:** Executed automated headless Node Vitest suite parsing 42+ complex matrices and verifying output values against strict hardcoded independent references down to 0.001 tolerance. 
- **Known limitations:** Pyodide numerical integration for Studentized Range in Tukey HSD returns bounded max outputs (`0.999`) strictly within this specific WASM environment compile. The engine outputs this without crashing, but exact numerical parity requires external or future Pyodide WebAssembly fixes.

- [x] Refactor charting layout system for dynamic text measurement and margins.


## Phase 4.5: Recommendation Engine (Completed)
- Wired up the Nested block with normality/variance tests.
- Updated Survival block with Kaplan-Meier, Log-rank, Hazard Ratios, and Gehan.
- Made Grouped block normality-aware, suggesting ART ANOVA if needed.
- Updated runtime_audit.py to rigorously test recommender consistency.

## Phase 5 (Graph Rendering & Extensibility)
- **What was built:**
  - Expanded the `GraphEngine` to handle new data structures and chart families (Grouped, Nested, PartsOfWhole, XY).
  - Implemented logic in `GraphSettingsPanel` to parse chart recommendations and auto-sort the chart types in the dropdown based on the dataset type (`XY`, `Grouped`, etc.) via `SearchableSelect`.
  - Added new Chart Components: `PieChart` (with dynamic contrast-aware text coloring), `LineFitChart` (via `XYScatterChart`), and Kaplan-Meier Step Curve (`SurvivalChart`).
  - Implemented grouped versions of extensive chart types: `GroupedBoxChart`, `GroupedRaincloudChart`, `GroupedViolinChart`, `GroupedJitterChart`, `GroupedSwarmChart`, `GroupedStripChart`, `GroupedHBoxChart`, `GroupedRangeDumbbellChart`, and `GroupedBarChart`.
  - Upgraded `HeatmapChart` to dynamically wire user inputs (`heatmapMin` and `heatmapMax`) to the color scales and gracefully handle multiple column sets.
  - Wired in `pieDonutDataColumn` aggregation selection natively to support custom or aggregate parts-of-whole slices.
- **How it was verified:** Ensured all UI dropdowns render expected values, ran `tsc -b && vite build` which succeeded cleanly.
- **Known limitations:** Heatmap gradients are partially limited to standard palettes until specific dynamic endpoints are passed via config.
