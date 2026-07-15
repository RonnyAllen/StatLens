\# StatLens — Product Requirements (PRD)



\## 1. Vision \& scope

StatLens lets a researcher complete the full "Prism loop" without buying or learning Prism:

choose a data-table type, enter/import labeled data, see descriptive stats and a recommended

test, run additional tests, build a customizable publication-quality graph with significance

markers, and export an Excel workbook plus transparent PNGs — all free, in the browser, with

files saved in their own Google Drive `StatLens` folder. No account beyond Google, no payment.



In scope (v1): 8 data-table types (XY, Column, Grouped, Contingency, Survival, Parts of whole,

Multiple variables, Nested); descriptive stats per type; assumption checks; a test-recommendation

engine with override; core parametric/non-parametric tests, post-hoc/multiple comparisons, effect

sizes; regression/curve-fitting, survival analysis, contingency analysis, PCA; graph families per

type with full customization and significance markers; Excel + PNG export; Google login + Drive

storage; light/dark themes; a Guided Analysis wizard.



Out of scope v1 (leave extension points): real-time multi-user collaboration; native desktop/

mobile apps; a macro/scripting language; the most specialized niche nonlinear models.



\## 2. Tech stack (zero-setup, browser-only)

\- App: \*\*Vite + React + TypeScript (strict)\*\* — a static single-page app (no SSR, no server).

\- UI: \*\*Tailwind CSS + shadcn/ui\*\*; class-based light/dark with a persisted toggle and design tokens.

\- Data grid: \*\*AG Grid Community\*\* (MIT) — supports grouped/multi-row headers (needed for XY/

&#x20; Grouped/Nested subcolumns) and virtualization. A thin "table model" layer renders Prism-style

&#x20; grouped subcolumns on top.

\- Charts: a \*\*vector SVG chart engine\*\*. Either (A) \*\*D3 + visx\*\* primitives for full control, or

&#x20; (B) a charting library in \*\*SVG mode\*\* (e.g. ECharts). Significance brackets/asterisks are ALWAYS

&#x20; a custom SVG layer we draw from stored results (never the library's defaults). Prefer the

&#x20; lighter option since Pyodide already adds weight; verify transparent-PNG export early.

\- \*\*Statistics: Pyodide in a Web Worker.\*\* Load numpy/pandas/scipy/scikit-learn/statsmodels from

&#x20; the Pyodide distribution and micropip-install pingouin, scikit-posthocs, lifelines. Stats run off

&#x20; the main thread so the UI stays smooth. Show a one-time "Loading statistics engine…" state on

&#x20; first use; cache aggressively thereafter.

\- Excel export: \*\*SheetJS (xlsx)\*\* client-side (pure JS, light) — or openpyxl inside Pyodide.

&#x20; Prefer SheetJS for bundle size.

\- PNG export: serialize the chart SVG → draw to an offscreen canvas with no fill → `toBlob('image/

&#x20; png')`. Transparent background, selectable scale (1x/2x/4x). Optional SVG/PDF.

\- Auth: \*\*Google Identity Services token client\*\* in the browser — client ID only, NO secret,

&#x20; scope `openid email profile` + `drive.file`. Short-lived access tokens; re-request silently on

&#x20; expiry. (No server needed because there is no secret to protect.)

\- Storage: \*\*Google Drive only\*\* (Drive API v3 from the browser). No database.

\- Fonts: self-host open-source fonts via \*\*Fontsource\*\* (OFL/Apache) — bundled, not hotlinked.

\- Deploy: any static host (Vercel/Netlify/Cloudflare Pages, one-click) or run locally via the dev

&#x20; server. Nothing else to deploy.



\## 3. Workbook model (typed; the `.statlens` file)

\- `Workbook`: schemaVersion, id, name, createdAt/updatedAt, driveFileId?, sheets\[], analyses\[],

&#x20; graphs\[], appTheme.

\- `DataSheet`: id, name (user-named; used in export naming), type (XY|Column|Grouped|Contingency|

&#x20; Survival|PartsOfWhole|MultipleVariables|Nested), config (per-type options), columnGroups

&#x20; (grouped headers/subcolumns), rowTitles?, data (matrix of number|null|string; blank ≠ 0).

\- `Analysis`: id, sheetId, test (canonical id), options (post-hoc method, tails, paired, α…),

&#x20; results (structured: omnibus stat, df, p, effect size, CIs, full pairwise/post-hoc table with

&#x20; adjusted p + significance flags), report (plain-language), createdAt.

\- `GraphSpec`: id, sheetId, analysisId?, graphType (e.g. bar\_mean\_sem, scatter\_dot, box\_whisker,

&#x20; km\_curve), style (colors, fonts, axes, legend, annotations, significance markers).

Provide matching runtime validators (e.g. zod) so files load safely across versions.



\## 4. Data-table types (mirror Prism's 8; a "New table" chooser with thumbnails + per-type options)

Users can name the worksheet and label every applicable group, subcolumn, and row. Each type

offers "Enter data into a new table" vs "Start with sample data" (build a small sample per type).

1\. XY — each point has X and Y. X kind: Numbers / Numbers with error (horizontal error bars) /

&#x20;  Dates / Elapsed times. One or more Y datasets, each with N replicate subcolumns or pre-computed

&#x20;  mean+error. Rows = points (optional row titles).

2\. Column — one grouping variable; each column a group. Options: replicate values stacked; paired/

&#x20;  repeated measures (each subject a row); or pre-computed error (Mean/SD/N, Mean/SEM/N, etc.). The

&#x20;  paired flag drives paired vs unpaired test selection.

3\. Grouped — two factors: rows (with titles) × column-groups (with labels). Each group: single Y,

&#x20;  N side-by-side replicate subcolumns, or pre-computed error.

4\. Contingency — rows = exposures (titles), columns = outcomes (labels), cells = integer counts.

&#x20;  Support 2×2 and R×C.

5\. Survival — X = time (Days/Months…); one Y column per group; each row a subject; Y encodes the

&#x20;  event (1 = event/death, 0 = censored), with a clear in-UI helper. Option: enter elapsed time, or

&#x20;  start+end dates (compute elapsed).

6\. Parts of whole — rows = mutually exclusive categories (titles); one value column.

7\. Multiple variables — columns = variables (name + kind: continuous/categorical/binary); rows =

&#x20;  subjects/units.

8\. Nested — column-groups (labels); each group has N subcolumns = experimental (biological)

&#x20;  replicates; each row within a subcolumn = a technical replicate. Option: "Create this many

&#x20;  subcolumns: N."

All types: editable sheet name/headers/row labels; per-column data types; copy–paste to/from Excel;

undo/redo; validation (integer-only counts for Contingency; 0/1 helper for Survival; distinguish

missing values from zeros); debounced autosave to the Drive `.statlens` file with a "Saving…/Saved"

indicator.



\## 5. Statistical engine (runs in Pyodide; three layers)

(A) DESCRIPTIVES — Continuous (per group/cell/variable): n, mean, SD, SEM, 95% CI of mean, median,

min, max, range, Q1/Q3/IQR, sum, skewness, kurtosis, CV, geometric mean (if all positive).

Contingency: row/col totals, row/col/overall %, expected counts. Survival: n, events, censored,

median survival + 95% CI (Greenwood), survival at chosen times. Parts of whole: counts, %,

cumulative %. Multiple variables: per-variable descriptives + correlation matrix (r, p, n).

Show descriptives in the side panel as soon as a sheet is valid.



(B) ASSUMPTION CHECKS — Normality: Shapiro-Wilk (default), D'Agostino-Pearson K², Anderson-Darling,

KS/Lilliefors. Equal variance: Levene (default), Brown-Forsythe, Bartlett, F-test (2 groups).

Sphericity (RM ANOVA): Mauchly with Geisser-Greenhouse correction (default).



(C) RECOMMENDATION + ALL APPLICABLE TESTS, by table type — always show a plain-language rationale

and let the user override. Always report: test statistic, df, exact p, effect size (with

interpretation), 95% CIs; for multi-group tests, the post-hoc table with adjusted p and a

significance summary.



&#x20; Column data (decision matrix):

&#x20; - 1 group vs hypothetical → one-sample t (normal) / Wilcoxon signed-rank (non-normal). ES: Cohen's d.

&#x20; - 2 groups unpaired → unpaired Student's t (normal, equal var) / Welch's t (normal, unequal var) /

&#x20;   Mann-Whitney U (non-normal). ES: Cohen's d or rank-biserial.

&#x20; - 2 groups paired → paired t (normal diffs) / Wilcoxon matched-pairs (non-normal). ES: Cohen's dz.

&#x20; - 3+ groups unpaired → one-way ANOVA (normal, equal var) / Welch's ANOVA or Brown-Forsythe

&#x20;   (unequal var) / Kruskal-Wallis (non-normal). Post-hoc: Tukey (all pairs), Dunnett (vs control),

&#x20;   Šidák, Bonferroni, Holm-Šidák; Games-Howell or Dunnett T3 after Welch; Dunn's after

&#x20;   Kruskal-Wallis. ES: η²/ω²; ε² for KW.

&#x20; - 3+ groups paired/RM → RM one-way ANOVA (Geisser-Greenhouse) or mixed-effects (missing data) /

&#x20;   Friedman (non-normal). Post-hoc within-subject (Tukey/Dunnett/Šidák/Holm); Dunn's after Friedman.

&#x20;   ES: partial η²; Kendall's W.



&#x20; Grouped data: two-way ANOVA (main effects + interaction; % variation explained, F, p per term);

&#x20; variants RM two-way and mixed-effects (missing data); three-way ANOVA when a third grouping

&#x20; exists; ART ANOVA as non-parametric alternative. Post-hoc Šidák/Tukey/Dunnett/Bonferroni within

&#x20; rows, within columns, or across cells (adjusted p + 95% CI). ES: partial η².



&#x20; XY data: Pearson r (linear/normal) or Spearman ρ (monotonic/non-normal); linear regression

&#x20; (slope/intercept, R², 95% CIs, p, runs test, residuals; compare slopes/intercepts);

&#x20; nonlinear curve fitting (exponential growth/decay, one-/two-phase decay, Michaelis-Menten,

&#x20; log(agonist) vs response 4-parameter logistic → EC50/IC50, Gaussian, polynomial, Boltzmann) with

&#x20; best-fit params + 95% CI, R², model comparison via extra sum-of-squares F and AICc, shared/

&#x20; constrained params across datasets. Heuristic: linear (runs test ok, high R²) → linear + Pearson;

&#x20; monotonic-nonlinear → curve fit + Spearman; else present both with guidance.



&#x20; Contingency data: 2×2 → Fisher's exact (small expected counts) else chi-square (offer Yates);

&#x20; always report relative risk, odds ratio (95% CI), and for diagnostic tables sensitivity/

&#x20; specificity/PPV/NPV/likelihood ratios + NNT; paired 2×2 → McNemar. R×C → chi-square of

&#x20; independence; chi-square for trend (Cochran-Armitage) for ordered categories; Cramér's V; Fisher-

&#x20; Freeman-Halton for small sparse tables.



&#x20; Survival data: Kaplan-Meier (+95% CI); log-rank (Mantel-Cox) (default), Gehan-Breslow-Wilcoxon,

&#x20; log-rank for trend; hazard ratio (logrank + Mantel-Haenszel) with 95% CI for 2 groups; Cox PH for

&#x20; covariates/multiple groups (HRs + CI; PH-assumption check); pairwise log-rank with Bonferroni/

&#x20; Šidák for >2 groups.



&#x20; Parts of whole: primarily descriptive/visual; optional chi-square goodness-of-fit, binomial/exact

&#x20; test for a single proportion, CIs on proportions.



&#x20; Multiple variables: correlation matrix (heatmap, p, n); multiple linear regression (coeffs+CI,

&#x20; R²/adj R², standardized βs, VIF, residual diagnostics); multiple logistic regression (ORs+CI,

&#x20; ROC/AUC, classification); Poisson regression; PCA (scree, loadings, scores, biplot); optional

&#x20; partial correlation, Deming/simple regression.



&#x20; Nested data: nested t-test (2 groups) and nested one-way ANOVA (3+ groups) via mixed-effects/

&#x20; hierarchical models treating the experimental replicate (subcolumn) as a random effect so

&#x20; technical replicates aren't pseudo-replicated; fixed-effect comparisons with post-hoc + correction.



&#x20; Cross-cutting (per analysis, user-overridable): α = 0.05; CIs at 95%; one- vs two-tailed; paired/

&#x20; unpaired; post-hoc method; normality/variance test; missing-value handling.



(D) REPORTING — Each run returns (a) a structured JSON results object and (b) a plain-language

report stating the test/model in plain English, the null and alternative hypotheses in plain

language, which assumptions were checked and their results, and an interpretation sentence. The UI

shows two tiers: a concise Result summary (e.g. "Group A vs Group B: mean diff 4.2, 95% CI

\[1.1, 7.3], p = 0.023, significant at α = 0.05") and an expandable Details view with full tables.

When asterisks appear, include a legend stating the thresholds used.



Design the engine so new tests/graphs are easy to add (registry pattern keyed by table type).



\## 6. Graphing \& defaults

Graph families per type: XY (scatter, line, scatter+line, error bars, fitted curves, residuals,

bubble); Column (bar ± error, dot plot, box, violin, floating bars, before-after, histogram, CDF);

Grouped (interleaved/stacked/separated bars, grouped dot/box/violin, heatmap); Contingency (stacked/

grouped/100% bars); Survival (Kaplan-Meier step curves with censor ticks, optional CI bands, number-

at-risk table); Parts of whole (pie, donut, 100% stacked, polar); Multiple variables (correlation

heatmap, scatter-plot matrix, PCA biplot/scores, volcano); Nested (nested dot plots with group

means). All render as SVG, transparent background, live-updating.



Display defaults (apply out of the box, all overridable): box/whisker + floating bars use min→max

whiskers; point-overlay graphs show all individual points (jitter on); summaries default to mean ±

SEM (one-click to SD or 95% CI, surfaced prominently); axes auto-range min→max + padding.



Significance markers: default asterisk scale `ns` (p > 0.05), `\*` (≤0.05), `\*\*` (≤0.01), `\*\*\*`

(≤0.0001), `\*\*\*\*` (≤0.00001), assigned strictest-first; toggle asterisks vs exact p vs both; drawn

as comparison brackets connecting groups (auto-stacking, repositionable), pulling p-values from the

stored post-hoc results so graph and stats never disagree; default to showing the significant

comparisons. Offer a "results box" annotation with test name, statistic, p, n. Provide a one-click

switch to the common 0.05/0.01/0.001/0.0001 scale.



Customization (at least as flexible as Prism): axes (titles/units, manual ranges, tick spacing +

minor ticks, linear/log10/log2/probability, breaks, gridlines, frame style, reverse); data

appearance (per-dataset colors for symbols/lines/fills/error bars, symbol shape/size/border, line

style/width, bar fill solid/gradient/pattern/hollow, bar width/gap, error-bar cap + direction,

connecting lines, jitter, opacity); color (pickers + palette manager with colorblind-safe presets

e.g. Okabe-Ito/Viridis + grayscale, per-point coloring, gradients); fonts (family from bundled OFL

set, size/weight/italic/color independently for title, axis titles, axis labels, legend,

annotations); legend (position/border/title/order/show-hide); annotations (title/subtitle, text,

arrows/lines, significance brackets, n-labels, results box); layout (aspect ratio, dimensions,

margins, plot-area fill, transparent background by default); style presets ("StatLens default,"

"Publication," "Grayscale," "Colorblind-safe") plus the global light/dark theme; save/reuse a style.



\## 7. Export

Excel (.xlsx, generated client-side via SheetJS): for each sheet, in order — the data sheet named

`<SheetName>` (labels matching the app); a `<SheetName>\_DesStat` descriptive-stats sheet; one

`<SheetName>\_<test\_name>` results sheet per test run. Enforce Excel rules with a `safeSheetName`

helper: ≤31 chars, no `\[]:\*?/\\`, unique; truncate the `<SheetName>` portion to fit the suffix and

append `\~2`, `\~3`… on collisions (document the rule). Embed round-trip metadata (table type +

options + full untruncated name) as a hidden first row and/or a hidden `\_StatLens\_Info` sheet so re-

import reconstructs worksheet types. Result sheets include input parameters (paired/unpaired, α,

test type), omnibus result with df + p, effect sizes, CIs, and a compact pairwise/post-hoc table

with adjusted p + significance flags; include the asterisk-threshold legend.



Graphs (PNG): transparent background, named `<SheetName>\_<test\_name>\_graph.png` (sanitize illegal

chars; truncate the SheetName portion to a sensible total length; use the graph type if no test is

attached); scale selector 1x/2x/4x; optional SVG/PDF.



Destinations: both Excel and PNG can be downloaded directly AND saved into the Drive folder, in per-

workbook subfolders (`/StatLens/<workbook>/exports/` and `/graphs/`). Use Drive revisions for

version history. Saving the project itself writes the `.statlens` JSON (also a new Drive revision).



\## 8. UI/UX

Shell: left navigator with sections Data Tables, Results, Graphs, Layouts; top bar (workbook name,

Saving…/Saved status, export, theme toggle, account menu); main canvas (grid + "Analyze" panel for

data tables; a dedicated Graph tab with preview + right-hand settings panel for graphs); tabs for

multiple sheets.

Onboarding: the data-type chooser with thumbnails; a sample-data path per type; helpful empty states

("No analyses yet — click Analyze").

Analyze experience: shows assumption-check results, the recommended test with its plain-language

rationale, and a categorized list of applicable alternatives; running a test opens its options

(post-hoc, tails, α) then the two-tier results view (summary + details) and saves an Analysis.

Guided Analysis mode (wizard): optional step-by-step flow — (1) pick table type, (2) enter/import

data, (3) review descriptives, (4) choose a test (recommendation pre-selected + explained), (5)

customize and export the graph. This is the key feature that lets a non-expert use StatLens without

learning it; power users can skip it.

Theming \& fonts: light/dark via tokens, persisted; bundle OFL fonts (e.g. Inter, Roboto, Lato, Open

Sans, Source Sans 3, Nunito Sans, Montserrat, Arimo, IBM Plex Sans/Serif/Mono, Merriweather, Roboto

Slab, Roboto Mono, JetBrains Mono) and expose them in app UI and graph font pickers.

Responsiveness \& a11y: optimized for laptop/desktop, reasonable on tablets; keyboard nav in grid and

dialogs; WCAG-AA contrast; respect prefers-reduced-motion.



\## 9. Non-functional

Performance: virtualized grid; debounced live graph re-renders; Pyodide in a Web Worker so the UI

never blocks; lazy-load heavy modules; a one-time engine-loading state. Reliability: structured,

friendly errors ("ANOVA needs ≥3 groups", "not enough replicates", "this test doesn't fit this data

type") — never a raw stack trace. Validation: distinguish missing values from zeros everywhere;

validate column types; warn before running a test whose requirements aren't met. Privacy: only Drive

\+ in-browser computation; a short privacy page. Testing: unit tests per statistic (vs reference

values), component tests for grid/editor, one end-to-end flow test (login → data → analyze → graph →

export). Reproducibility: a fresh clone runs with one documented command (e.g. `npm install \&\& npm

run dev`); provide `.env.example` and seed/sample data.

