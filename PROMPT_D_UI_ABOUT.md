# TASK D: About page + UI overhaul + post-hoc method selector

Three related pieces of front-end work. **Do this AFTER Task C** — the method selector (D3) sends
strings that only Task C's engine can honour, and shipping it first would mean a user picks
"Bonferroni" and silently receives Tukey.

---

## RULES

1. **Do not touch `apps/web/src/stats/analysis_engine.py`.** This task is UI only.
2. `TestOptionsDialog.tsx` is **CRLF** — preserve it. Other files are LF.
3. If a FIND string doesn't match, **STOP and report**. Don't regenerate files from scratch.
4. `npx tsc -p tsconfig.app.json --noEmit` must exit 0 when you're done.
5. **The About page content in D1 is factual and verified — do not embellish it.** Do not move an
   item from "Coming soon" to "Available" because it looks half-built. Every ✅ below was confirmed
   by executing the engine; every 🔜 was confirmed absent.

---

## D1 — The About page

Create `apps/web/src/components/about/AboutPage.tsx`, add the route, and link it from the top bar.

### Routing — `apps/web/src/App.tsx`, **1 occurrence**
FIND:
```tsx
          <Route path="/" element={<RootRedirect />} />
```
REPLACE:
```tsx
          <Route path="/" element={<RootRedirect />} />
          <Route path="/about" element={<AboutPage />} />
```
Add the import alongside the other imports:
```tsx
import { AboutPage } from '@/components/about/AboutPage'
```

### Nav link — `apps/web/src/components/layout/TopBar.tsx`, **1 occurrence**
FIND:
```tsx
          <Link to="/" className="font-bold text-lg tracking-tight hover:text-primary/80 transition-colors cursor-pointer">StatLens</Link>
```
REPLACE:
```tsx
          <Link to="/" className="font-bold text-lg tracking-tight hover:text-primary/80 transition-colors cursor-pointer">StatLens</Link>
          <Link to="/about" className="ml-4 text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
```
Also surface it on the Dashboard (a secondary "About" button near "New Workbook" is fine).

### Content — must be accurate

Build the page with the existing shadcn/ui primitives (`Card`, `Alert`, `ScrollArea`) and Tailwind
tokens (`bg-background`, `text-muted-foreground`, …) so it themes correctly in light/dark. Use a
centred `max-w-4xl` column with clear section headings and an anchor/section nav.

**§1 — What StatLens is.** A free, browser-only statistics tool that runs the whole "Prism loop":
pick a data-table type → enter data → get descriptives, assumption checks and a recommended test →
run the test → build a publication-quality graph → export. No install, no account beyond Google,
no payment.

**§2 — Architecture.** Say plainly:
- React + TypeScript + Vite single-page app; **nothing is uploaded to a server**.
- Statistics run **entirely in your browser** via **Pyodide** (CPython compiled to WebAssembly) in a
  Web Worker, using the real **SciPy / statsmodels / pingouin / scikit-posthocs / lifelines** —
  the same libraries used in published research, not re-implementations.
- Data is stored **only in your own Google Drive** (`drive.file` scope — StatLens can only see
  files it created), in a `StatLens` folder as `.statlens` JSON.
- Charts are hand-built SVG (visx/D3), exported as **600-DPI PNG** or **SVG**.

**§3 — Implemented features (✅ verified).**
- 8 data-table types: XY, Column, Grouped, Contingency, Survival, Parts of Whole,
  Multiple Variables, Nested
- Spreadsheet grid with multi-cell select, copy/paste from Excel, 50-step undo/redo
- Descriptive statistics + assumption checks (Shapiro-Wilk normality, Levene equal variance)
- A test recommender that reads those assumptions — with manual override
- ~45 statistical tests (see §5)
- Post-hoc: Tukey, Dunnett, Dunnett's T3, Games-Howell, Dunn, Bonferroni, Šídák, Holm-Šídák —
  with adjusted p-values and confidence intervals
- 12 chart types with significance brackets/asterisks
- Publication export: 600-DPI PNG (correct DPI metadata, embedded fonts) + SVG
- Google Drive save/load, light/dark themes

**§4 — Coming soon (🔜 — do not list these as available).**
- **Excel / CSV export** of data and results tables (today only graphs export)
- **Guided Analysis wizard** (step-by-step walkthrough)
- PDF / EPS graph export
- Additional chart types (see §6)
- Offline / local-file storage

**§5 — Usage guide: table types, examples, and supported tests.**
Render as one card per table type: a short "use it when…", a tiny worked example, the **main tests**,
and the **post-hoc tests**. This table is verified — reproduce it faithfully:

| Table type | Use it when | Example | Main tests | Post-hoc |
|---|---|---|---|---|
| **Column** | Comparing groups on one measurement | Control / DrugA / DrugB tumour volumes | One-sample t, Unpaired t, Welch's t, Paired t, Mann-Whitney, Wilcoxon, Sign test, Kolmogorov-Smirnov, One-way ANOVA, Welch's ANOVA, Brown-Forsythe, Repeated-Measures ANOVA, Kruskal-Wallis, Friedman | Tukey, **Dunnett** (vs control), Dunnett's T3, Games-Howell, Dunn, Bonferroni, Šídák, Holm-Šídák |
| **XY** | One variable measured against another | Dose vs response; time vs signal | Pearson, Spearman, Simple linear regression, **Nonlinear curve fitting** (exponential, Michaelis-Menten, 4PL, Gaussian, polynomial, Boltzmann), Deming regression, Simple logistic regression, Area under curve, LOWESS, Spline, Smooth, Integrate, Differentiate | — |
| **Grouped** | Two factors at once | Drug × Dose on blood pressure | Two-way ANOVA (Type III), Repeated-Measures two-way, Mixed-effects, ART ANOVA (non-parametric) | Tukey on marginal means |
| **Contingency** | Counts in categories | Exposed/Unexposed × Case/Control | Chi-square (± Yates), Fisher's exact, McNemar's, Odds/Risk ratios, Diagnostic (sensitivity/specificity) | — |
| **Survival** | Time until an event | Days to relapse by treatment arm | Kaplan-Meier, Log-rank (Mantel-Cox), Gehan-Breslow-Wilcoxon, Hazard ratios, Cox regression | Pairwise log-rank (Holm) |
| **Parts of Whole** | One whole split into parts | Cell counts per phenotype | Chi-square goodness of fit, Binomial test | — |
| **Multiple Variables** | Many variables per subject | Age, BMI, dose, response per patient | Correlation matrix, Multiple linear regression, Multiple logistic regression, Poisson regression, PCA, Three-way ANOVA | — |
| **Nested** | Subsamples within groups | 3 wells per animal, 4 animals per group | Nested t-test / nested one-way ANOVA | Tukey |

Add two notes:
- **Three-way ANOVA** expects the **response column last** and the three factor columns before it,
  each with repeated levels.
- **Column tables support subcolumns (replicates)** for technical replicates; they are pooled per group.

**§6 — Chart types.**
- **Available (✅):** bar + error bars, box & whisker, violin, raincloud, scatter, strip, jitter,
  beeswarm, horizontal box, range/dumbbell, CI forest, Kaplan-Meier step.
- **Coming soon (🔜):** grouped bar, connected/before-after line, nested plot, pie/donut,
  heatmap, PDF/EPS export.

**§7 — Important Disclaimer.** Render this prominently — an `Alert` with a warning icon, visually
distinct, **not** small print. Exact wording:

> **Important Disclaimer:** Statistical results are automated for convenience, but users should
> always verify test assumptions, selections, and outputs using additional tools or expert
> consultation. This app is not a substitute for professional statistical advice.

**§8 — Get involved.**
- MIT licensed.
- Source: https://github.com/RonnyAllen/StatLens
- Report issues: https://github.com/RonnyAllen/StatLens/issues

Use real `<a>` tags with `target="_blank" rel="noopener noreferrer"`.

**§9 — Footer.**
> Created by **Rohan Alag**
> Special thanks to Pyodide, SciPy, statsmodels, pingouin, scikit-posthocs, lifelines, visx,
> AG Grid, Claude, and Antigravity.

Render the thanks as a wrapped row of subtle chips/badges, muted, centred.

---

## D2 — UI overhaul (modern + animated)

**Constraints:** keep shadcn/ui + Tailwind + the existing theme tokens. **Do not** introduce a new
component library or rewrite the workspace layout. **Do not** add a heavy animation dependency —
Tailwind transitions + CSS keyframes cover everything here. If you want a spring physics library,
`framer-motion` is acceptable **only** if bundle impact is checked; Pyodide already makes this app
heavy, so prefer CSS.

Work through these, in order:

1. **Design tokens first.** Before restyling components, settle: a slightly tighter type scale, a
   consistent radius, one accent colour, and 2–3 elevation levels. Apply via Tailwind config /
   CSS vars so light+dark both work. Everything else follows from this.
2. **Motion, tastefully.**
   - Page/route transitions: 150–200 ms fade + 4-8 px rise.
   - Cards/list items: subtle stagger on mount (~30 ms apart), hover lift + shadow.
   - Dialogs/sheets: scale 0.97→1 with fade (Radix already exposes `data-[state=open]` — animate those).
   - Buttons: press-scale ~0.98, smooth colour transitions.
   - **Skeleton loaders** for the Drive workbook list and the results panel.
   - The **"Loading statistics engine…"** first-run state deserves real care — it's a multi-second
     Pyodide download and currently the app's worst moment. Give it a progress indicator and a
     rotating "did you know" line.
3. **Respect `prefers-reduced-motion`** — wrap non-essential motion in
   `@media (prefers-reduced-motion: no-preference)`. This is an accessibility requirement, not a nicety.
4. **Polish the empty/error states.** Dashboard empty state, "no analysis yet", engine errors.
5. **Results panel**: make the post-hoc table scannable — monospace/tabular numbers, a subtle
   significance highlight, sticky header.

**Performance guardrails:** animate only `transform` and `opacity` (never `width`/`height`/`top`);
keep durations ≤250 ms; never animate the chart SVG during export.

**Do not regress:** the 600-DPI PNG/SVG export path, AG Grid keyboard/clipboard behaviour, or the
significance-bracket layout.

---

## D3 — Post-hoc method selector (pairs with Task C)

Today `recommendedPostHoc` is a `useMemo` with **no setter**, so the recommendation is also the
only option. Add an override.

In `apps/web/src/components/workspace/TestOptionsDialog.tsx` (**CRLF**):

1. Add state: `const [methodOverride, setMethodOverride] = useState<string>("")`.
2. Compute `const effectivePostHoc = methodOverride || recommendedPostHoc`.
3. Send `effectivePostHoc` instead of `recommendedPostHoc` in `handleRun`'s `postHocTest`.
4. Under the existing "Recommended Post-Hoc: {recommendedPostHoc}" line, add a select/radio
   **"Method (advanced)"** listing only methods valid for the current family — the engine after
   Task C honours exactly these:

| Family | Allowed methods |
|---|---|
| `all_pairwise`, equal variance | `Tukey's HSD` (default), `Bonferroni`, `Šídák`, `Holm-Šídák` |
| `all_pairwise`, unequal variance | `Dunnett's T3 test`, `Games-Howell test` |
| `all_pairwise`, non-parametric | `Dunn's test` |
| `specific_pairs` | `Pairwise t-tests with Holm correction`, `Pairwise Welch t-tests with Holm correction`, `Bonferroni`, `Šídák`, `Holm-Šídák` |
| `control_vs_others` | `Dunnett's multiple comparisons test` (equal var), `Dunnett's T3 test` (unequal), `Dunn's test` (non-parametric) |

5. Default the override to empty so the recommendation still leads; mark the recommended entry
   "(recommended)". Reset `methodOverride` when `postHocFamily` changes — a method valid for one
   family may not be valid for another.

**Do not offer a method the engine can't honour.** The strings above are exactly what Task C's
`_mc_method` resolver matches; anything else silently falls back to Tukey.

---

## D4 — Show which test produced the asterisks

Significance brackets are correctly bound to their analysis (`Workspace.tsx` resolves
`graph.analysisId` → that analysis's `post_hocs`), so the numbers are traceable. But **the graph
never says which method produced them** — a reader can't tell Tukey from Dunnett from Dunn.

- In `GraphSettingsPanel.tsx`, add a toggle **"Show post-hoc method caption"** (default on).
- When enabled, render `analysisResults.post_hocs.method` as a small caption under the chart
  (and for Dunnett, append `control_group`, e.g. *"Dunnett's multiple comparisons test vs Control"* —
  the engine already returns `control_group`).
- It must be part of the exported SVG/PNG, not just the screen.

---

## ACCEPTANCE

- [ ] `/about` renders; linked from top bar **and** dashboard; themes correctly in light+dark
- [ ] About content matches D1 exactly — nothing promoted from 🔜 to ✅
- [ ] Disclaimer is visually prominent, wording verbatim
- [ ] Links + MIT + credits + "Created by Rohan Alag" present
- [ ] Motion respects `prefers-reduced-motion`; only `transform`/`opacity` animated
- [ ] Method selector offers only engine-honoured strings; resets on family change
- [ ] Post-hoc method caption appears on chart and in the export
- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0
- [ ] `python3 scratch/posthoc_matrix.py` still passes (you changed no engine code)
- [ ] Export smoke test: 600-DPI PNG still correct

Report anything you couldn't tick. Do not mark a box you didn't verify.
