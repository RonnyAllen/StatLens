# StatLens — Implementation Plan

Build so the app runs and is useful at the end of every phase. Each phase ends with self-
verification in the browser and screenshots appended to /docs/PROGRESS.md. There is NO backend or
database in any phase — stats run in Pyodide, persistence is Google Drive.

## Phase 0 — Foundation, design system, Pyodide bootstrap
- Scaffold `apps/web` (Vite + React + TS strict); ESLint/Prettier; test runner (Vitest).
- Tailwind + shadcn/ui; design tokens; class-based light/dark toggle that persists.
- Bundle OFL fonts via Fontsource; wire into Tailwind.
- Base app shell: top bar (title, theme toggle, placeholder account), left sidebar placeholder,
  empty canvas.
- **Pyodide bootstrap in a Web Worker:** load numpy/pandas/scipy/scikit-learn/statsmodels and
  micropip-install pingouin, scikit-posthocs, lifelines; expose a typed `runStats(payload)` bridge;
  add a tiny smoke computation (e.g. a t-test) to prove the engine works.
Acceptance: app builds with zero type errors; light/dark toggle persists; fonts load locally (no
external font URLs); the Pyodide worker loads and the smoke t-test returns a value matching SciPy
(unit-tested); a one-time "Loading statistics engine…" state shows on first use.

## Phase 1 — Google sign-in + Drive folder + dashboard
- Browser Google OAuth via Google Identity Services token client (client ID from `.env`, NO secret),
  scopes `openid email profile` + `drive.file`; silent token refresh on expiry; clear consent-
  rationale UI ("StatLens saves your workbooks to a folder in your own Drive and accesses nothing
  else").
- On first login, find-or-create the `StatLens` Drive folder; on workbook creation, create a per-
  workbook subfolder and store the `.statlens` JSON there; CRUD via Drive with revisions.
- Dashboard: list workbooks from the StatLens folder (name, modified, sheet count) with New / Import
  Excel (stub ok here) / Open / Rename / Duplicate / Delete / Download.
- **Produce the click-by-click Google OAuth setup guide for the user** (see Appendix D) and a
  `.env.example` with `VITE_GOOGLE_CLIENT_ID=`.
Acceptance: a real Google account signs in entirely in-browser; the StatLens folder (+ a per-
workbook subfolder) is created if absent; a new empty workbook saves to Drive and reappears after
reload; sign out/in works; no tokens are logged; the OAuth guide is accurate and assumes no prior
knowledge.

## Phase 2 — Data-table engine (all 8 types)
- Workbook/DataSheet/SheetConfig types + runtime validators in a shared module.
- "New table" chooser (cards with thumbnails, descriptions, per-type options from PRD §4); worksheet
  naming.
- Table-model layer + AG Grid grouped-header config rendering each type's correct subcolumn/row
  structure; editable group/subcolumn/row labels; validation (integer-only Contingency, 0/1 helper
  Survival, blank≠0); copy–paste to/from Excel; undo/redo; a sample dataset per type.
- Debounced autosave to the Drive `.statlens` file with a Saving…/Saved indicator.
Acceptance: for each of the 8 types the user can create a sheet, name it, see the correct Prism-style
layout, label everything, enter data, load the sample dataset, and round-trip save/load from Drive
with no loss; the grid handles several thousand rows smoothly.

## Phase 3 — In-browser stats: descriptives + assumptions + recommendation
- In the Pyodide worker: descriptives per table type; assumption checks (normality/variance/
  sphericity); a recommender returning the recommended test id + plain-language rationale + the list
  of applicable alternatives. Typed wrappers + unit tests.
- "Analyze" panel showing descriptives, assumption results, and the recommendation with rationale.
Acceptance: descriptives match reference values (unit-tested); the recommender returns the correct
test for representative fixtures (2 unpaired normal groups → unpaired t; 3 non-normal groups →
Kruskal-Wallis; 2×2 small expected counts → Fisher); the UI shows it all per table type.

## Phase 4 — Statistical tests + results + plain-language report
We are splitting Phase 4 into logical chunks. **Phase 4A is currently completed.**

### Phase 4A — Column Data Tests (COMPLETED)
- **Auto-Guide Assumption Engine**: Automatically run Shapiro-Wilk and Levene's/Brown-Forsythe to assess normality and homoscedasticity before recommending tests.
- **Ultra-Exhaustive Statistical Library (Statskingdom / Sensabled inspired)**: 
  - T-tests (Unpaired, Paired, One-Sample) and non-parametric analogues (Mann-Whitney, Wilcoxon, Sign).
  - Ordinary One-Way ANOVA, Kruskal-Wallis, Repeated Measures ANOVA.
  - **Combinatory Robust ANOVA**: Custom WebAssembly-backed Welch and Brown-Forsythe ANOVA execution.
  - Exact numerical integration (SMM and Studentized Range) for perfect Dunnett's T3 and Tukey's HSD p-values (matching Prism).
  - Games-Howell, Dunn's, and Holm-Bonferroni post-hocs.
- **Smart UI Selection**: Two-tier results view with a dynamic plain-language report (hypotheses, assumptions, interpretation).

### Phase 4B — Advanced Data Types (Pending)
- **Column (Remaining)**: Friedman test (non-normal RM ANOVA) + Dunn's post-hoc + Kendall's W.
- **XY (Correlation & Regression)**: Pearson/Spearman/partial correlation. Linear regression (runs test, residuals, compare slopes/intercepts, Deming regression). Nonlinear curve fitting (exponential, Michaelis-Menten, 4-parameter logistic/EC50, Gaussian, polynomial, Boltzmann) with model comparison via extra sum-of-squares F and AICc.
- **Contingency**: 2×2 Fisher's exact/Chi-square (Yates), RR, OR, diagnostics (Sensitivity, Specificity, PPV, NPV, likelihood ratios, NNT). Paired 2×2 McNemar. R×C Chi-square of independence, trend (Cochran-Armitage), Cramér's V, Fisher-Freeman-Halton.
- **Survival**: Kaplan-Meier, log-rank (Mantel-Cox), Gehan-Breslow-Wilcoxon, log-rank for trend, Hazard Ratio (Mantel-Haenszel + Cox PH).
- **Grouped/Nested**: Two-way, three-way, RM two-way ANOVA, and ART ANOVA (non-parametric). Nested t-test/ANOVA via mixed-effects models.
- **Multiple Variables & Parts of Whole**: Multiple linear/logistic/Poisson regression, Firth's Penalized Logistic Regression, PCA (scree, loadings, scores, biplot). Chi-square goodness-of-fit, binomial test.

## Phase 5 — Graph engine, significance markers, & Advanced Geometries
- SVG chart engine (D3/visx or library-in-SVG-mode + custom significance layer) implementing the
  graph families per type in PRD §6; live updates; transparent backgrounds; apply display defaults
  (min→max whiskers, all points shown, mean±SEM, auto-range + padding).
- **Advanced Geometries & Niche Plots**: Include support for specialized, modern statistical plots such as Violin plots, Raincloud plots (combining half-violin, boxplot, and raw jitter), and Ridge plots for dense data visualization, ensuring they maintain the high aesthetic and interactive bar.
- Graph workflow: from a Data Table or Analysis, "New graph" → pick type → GraphSpec linked to the
  sheet (+ analysis); Graph tab with preview, graph list, and right-hand settings.
- Significance markers drawn by us from stored post-hoc results: default asterisk scale, toggle
  asterisks/exact-p/both, brackets with auto-stacking and repositioning, default to significant
  comparisons; results-box annotation.
- PNG export smoke test (transparent).
Acceptance: each data type produces its core graphs (including advanced geometries) with correct defaults; significance markers match the stats exactly; brackets don't overlap; graphs re-render live; a graph exports to transparent PNG.

## Phase 6 — Graph customization + themes
- Full customization panel from PRD §6 (axes incl. log/probability + breaks; data appearance; color/
  palette manager with colorblind-safe presets; per-element fonts; legend; annotations; layout;
  style presets); on-screen theme adaptation while exported colors stay user-controlled.
Acceptance: the user can change axis ranges/scales (incl. log), recolor every element, switch fonts,
add/move significance brackets + a results box, apply a style preset, and save/reuse a style;
transparent background preserved.

## Phase 7 — Export (Excel + PNG) + Drive outputs
- Client-side multi-sheet `.xlsx` (SheetJS) with the exact ordering + `safeSheetName` truncation/
  uniqueness rules, embedded round-trip metadata, result-sheet formatting, and the asterisk legend.
- Transparent PNG export at selectable scale with the exact filename rule; optional SVG/PDF.
- Save both to per-workbook Drive subfolders (exports/, graphs/) with revisions, plus direct
  download.
Acceptance: exporting a multi-sheet, multi-analysis workbook yields correctly ordered, named, and
truncated sheets that open cleanly in Excel/Sheets and carry recoverable type metadata; a graph
exports as a transparent PNG with the specified filename and resolution; both land in the correct
Drive subfolders and create new revisions on re-export.

## Phase 8 — Excel import + Guided Analysis + polish
- Import `.xlsx`/`.csv`: auto-detect type from embedded `_StatLens_Info` when present (round-trip),
  else a mapping wizard (column detection, header mapping, group assignment, numeric/categorical
  typing).
- Build the Guided Analysis wizard (PRD §8).
- Empty/error states; performance passes (grid virtualization, lazy-loading, worker offload);
  accessibility audit (WCAG-AA both themes, keyboard nav); component + e2e tests for the full flow;
  original-wording tooltips/help for each table type and test.
Acceptance: a StatLens-exported file re-imports to the exact original table types automatically; a
generic Excel file imports via the wizard with correct labels/data; a first-time user can finish an
analysis end-to-end using Guided Analysis alone; the e2e test (login → import/enter → analyze →
graph → export) passes; a11y passes AA; large-table performance is smooth.

## Phase 9 — Deploy, docs, demo
- One-click static deploy (Vercel/Netlify/Cloudflare Pages) — add the deployed origin to the OAuth
  client's Authorized JavaScript origins; confirm the app works at the deployed URL. (Local-only use
  via the dev server is also fully supported.)
- README with setup/run; a short "Developer guide" on adding new tests/graph types; the OAuth setup
  guide (Appendix D); an in-app help/tutorial using sample datasets; a privacy page; a demo script
  (create a sample workbook, enter data for ≥2 table types, run analyses, export graphs + workbook).
Acceptance: a fresh clone runs with one documented command; the deployed URL signs in and runs the
full loop; the OAuth guide and demo script are accurate; docs explain how to extend tests/graphs.

Final deliverables: complete source code; the Google OAuth setup guide; run/deploy instructions; the
developer guide; the demo script.