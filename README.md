# StatLens

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-ronnyallen.github.io%2FStatLens-brightgreen)](https://ronnyallen.github.io/StatLens/)

**Statistical analysis and publication-ready graphs, in your browser.**

### → **[Try it: ronnyallen.github.io/StatLens](https://ronnyallen.github.io/StatLens/)**

StatLens runs a real Python scientific stack — NumPy, SciPy, statsmodels, pingouin, lifelines — *inside your browser* via [Pyodide](https://pyodide.org) and WebAssembly. 70+ statistical tests, eight typed data table types, and charts with automatic significance brackets.

Nothing to install. No server. Your workbooks are saved to your own Google Drive.

> **Statistical correctness is the top priority; UX polish is second.**
> 44 of the implemented analyses are pinned to golden reference values from SciPy, statsmodels, pingouin, and R.

---

## Table of contents

- [Why](#why)
- [Features](#features)
- [How it works](#how-it-works)
- [Correctness](#correctness)
- [Privacy & data](#privacy--data)
- [Code map](#code-map)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## Why

Statistics software tends to be expensive, desktop-bound, or both. StatLens does the everyday work — put data in a typed table, run the right test, get a clean graph with significance brackets — in a browser tab, for free.

- **Free and open.** No licence, no seat count, no install.
- **Actually correct.** Every statistic is checked against a published reference implementation, not eyeballed. See [Correctness](#correctness).
- **Yours.** Your data goes to your Drive, not our server — there isn't one.
- **Portable.** Any machine with a modern browser. Nothing to install, nothing to sync.

---

## Features

### Data tables

Eight typed table types, each of which determines which analyses are offered:

| Table type | Use for |
|---|---|
| **XY** | Dose-response, kinetics, regression, correlation |
| **Column** | Group comparisons (t-tests, ANOVA, non-parametrics) |
| **Grouped** | Two-way / mixed / repeated-measures designs |
| **Contingency** | 2×2 and R×C count data |
| **Survival** | Kaplan-Meier, log-rank, hazard ratios |
| **Parts of Whole** | Binomial, chi-square goodness of fit |
| **Multiple Variables** | Multiple regression, PCA, correlation matrices |
| **Nested** | Nested t-test / nested ANOVA |

Sub-column formats include replicates, mean ± SD (n), and mean ± SEM (n).

### Analyses

**70 analyses** are implemented and runtime-audited (see [`docs/AUDIT_MATRIX.md`](docs/AUDIT_MATRIX.md)).

<details>
<summary><b>Column comparisons</b></summary>

One-sample / unpaired / paired t-tests · Welch's t-test · Mann-Whitney · Wilcoxon matched-pairs signed rank · One-sample Wilcoxon · Sign tests (one-sample, paired) · Ordinary one-way ANOVA · Welch's ANOVA · Brown-Forsythe ANOVA · Repeated-measures ANOVA · Kruskal-Wallis · Friedman · Kolmogorov-Smirnov
</details>

<details>
<summary><b>Grouped / factorial designs</b></summary>

Two-way ANOVA (incl. Type III unbalanced) · Repeated-measures two-way ANOVA · Mixed-effects ANOVA · Nested t-test / nested ANOVA · ART ANOVA (aligned rank transform, parametric & non-parametric)
</details>

<details>
<summary><b>Post hoc tests</b></summary>

Tukey HSD · Dunnett's T3 · Šidák / Bonferroni corrections · control-vs-others and specific-pairs comparison schemes. The selection logic is documented in [`docs/Choosing Post Hoc Tests.md`](docs/).
</details>

<details>
<summary><b>Regression & curve fitting</b></summary>

Simple & multiple linear regression · Simple & multiple logistic regression · Poisson regression · Deming regression · Nonlinear curve fitting (with AICc model comparison) · LOWESS · Spline fitting · Smoothing · Differentiate · Integrate · Area under curve · Interpolation of unknowns
</details>

<details>
<summary><b>Contingency & diagnostics</b></summary>

Chi-square (± Yates' correction) · Fisher's exact · McNemar's · Binomial · Chi-square goodness of fit · Odds ratio (incl. Haldane correction) · Relative risk · Sensitivity / specificity
</details>

<details>
<summary><b>Survival</b></summary>

Kaplan-Meier · Log-rank (Mantel-Cox) · Gehan-Breslow-Wilcoxon · Hazard ratios · Pairwise log-rank with Bonferroni/Šidák
</details>

<details>
<summary><b>Multivariate</b></summary>

Principal component analysis (PCA) · Correlation matrices · Pearson & Spearman correlation (with exact p-values for small n)
</details>

Analyses report effect sizes (Cohen's d, eta², mean differences), confidence intervals, and degrees of freedom, alongside a Markdown results report.

### Graphs

- Column/bar, XY, survival, and horizontal category charts
- Scatter overlays: **beeswarm**, **jitter**, **violin** (KDE), **box-and-whisker**
- Error bars (SD / SEM / CI), regression overlays with confidence bands
- **Significance brackets** computed and laid out automatically
- Light/dark theme, 15 bundled font families
- Export to **PNG** and **SVG**

### Assumption checking

Normality, equal-variance, and outlier diagnostics run alongside analyses, with plain-language verdicts ("The data appears to be normally distributed").

---

## How it works

StatLens is a **100% client-side single-page app**. Nothing runs on a server.

```
┌──────────────────────── Browser tab ─────────────────────────┐
│                                                              │
│  React 19 + TypeScript (Vite 8)                              │
│    ├── ag-grid ............ spreadsheet data tables          │
│    ├── visx / d3 .......... chart rendering (SVG)            │
│    └── Radix + Tailwind ... UI (shadcn/ui)                   │
│                    │                                          │
│                    │  postMessage                             │
│                    ▼                                          │
│  Web Worker ──► Pyodide 0.26.1 (WebAssembly)                 │
│                   ├── numpy, pandas, scipy                    │
│                   ├── statsmodels, scikit-learn               │
│                   └── pingouin, scikit-posthocs, lifelines    │
│                   └── analysis_engine.py  (2.8k lines)        │
│                                                              │
└──────────────┬───────────────────────────────────────────────┘
               │  HTTPS
               ▼
   Google Drive (drive.file scope) ── your workbooks, your account
```

**The parts that matter:**

1. **The stats engine is real Python.** [`src/stats/analysis_engine.py`](apps/web/src/stats/analysis_engine.py) (~2,800 lines) is the single source of statistical truth. It executes under Pyodide inside a Web Worker, so heavy analyses never block the UI.
2. **Pyodide loads from a CDN at runtime.** The Python runtime and scientific packages are *not* in the JS bundle. First load pulls tens of MB and takes a while — the header shows `Loading engine…` → `Engine ready`. After that the browser caches it.
3. **Optional packages install via micropip** (pingouin, scikit-posthocs, lifelines) behind defensive imports — if one fails to install, the engine still loads and everything that doesn't need it still works.
4. **No `SharedArrayBuffer`**, so no COOP/COEP headers are required and the whole app can be served as plain static files.
5. **Storage is Google Drive.** Workbooks are JSON files named `*.statlens`, saved into a `StatLens` folder in your Drive.

### Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 8 (Rolldown), TypeScript 6 |
| UI | React 19, Tailwind CSS 3.4, Radix UI / shadcn/ui, lucide-react |
| Grid | ag-grid-community 35 |
| Charts | visx 4, d3-scale / d3-shape / d3-array |
| Routing | react-router-dom 7 |
| Validation | zod 4 |
| Stats | Pyodide 0.26.1 → NumPy, pandas, SciPy, statsmodels, scikit-learn, pingouin, scikit-posthocs, lifelines |
| Auth | Google Identity Services |
| Lint | oxlint |
| Tests | vitest |

---

## Correctness

The project's central rule, from [`Agents.md`](Agents.md):

> **Statistical correctness is non-negotiable.** Every statistic/test has a unit test against known reference values (SciPy/statsmodels/pingouin/lifelines docs, R, or published worked examples) with sensible tolerance. Never change an algorithm without updating tests + comments.

What that looks like in practice:

- [`apps/web/src/stats/__tests__/golden_values.json`](apps/web/src/stats/__tests__/golden_values.json) — **44 analyses** pinned to reference outputs
- [`apps/web/src/stats/__tests__/reference_R/`](apps/web/src/stats/__tests__/reference_R/) — the R scripts that generated those expected values
- `run_audit.test.ts` — boots Pyodide and runs the **real engine** against the golden values, not a mock
- `charts/__tests__/geometry.test.ts` — chart geometry maths
- [`docs/AUDIT_MATRIX.md`](docs/AUDIT_MATRIX.md) — per-analysis status: does it run, is it golden-tested, does it go through the engine path

An analysis without a reference test is considered unfinished.

---

## Privacy & data

- **There is no StatLens server.** The app is static files; all computation happens in your browser.
- **Your data goes to your own Google Drive**, in a folder named `StatLens`, as `*.statlens` JSON files.
- The app requests the **`drive.file`** scope, which grants access *only to files the app itself creates*. It cannot read the rest of your Drive.
- Your access token is held in `localStorage` for the session and revoked on sign-out.
- The only third-party network calls are to Google (sign-in + Drive) and to the CDN/PyPI that serve the Python runtime and packages.

---

## Code map

```
StatLens/
├── apps/web/src/
│   ├── App.tsx               # routes, header, engine bootstrap
│   ├── stats/
│   │   ├── analysis_engine.py    # ★ all statistics live here (~2.8k lines)
│   │   ├── pyodide.worker2.ts    # Web Worker: boots Pyodide, runs the engine
│   │   ├── engine.ts             # main-thread client for the worker
│   │   └── __tests__/            # golden-value oracle tests
│   ├── charts/
│   │   ├── GraphEngine.tsx       # chart dispatch
│   │   ├── {Column,XY,Survival}Charts.tsx
│   │   ├── SignificanceLayer.tsx # significance bracket layout
│   │   └── geometry/             # pure, testable chart maths
│   ├── components/
│   │   ├── dashboard/            # workbook list
│   │   ├── workspace/            # grid, analyse panel, results, graph settings
│   │   └── ui/                   # shadcn/ui primitives
│   ├── data/                     # auth, Drive API, sheet templates
│   ├── lib/exportGraph.ts        # PNG / SVG export
│   └── types/workbook.ts         # zod schemas for the workbook format
├── docs/
│   ├── PRD.md                    # product requirements
│   ├── AUDIT_MATRIX.md           # every analysis + its runtime/golden status
│   └── *.md                      # statistical references (post hoc, curve fitting…)
├── tests/                        # Python-side oracle tests
└── Agents.md                     # project charter & engineering rules
```

---

## Acknowledgements

Built on the shoulders of [Pyodide](https://pyodide.org), [SciPy](https://scipy.org), [statsmodels](https://www.statsmodels.org), [pingouin](https://pingouin-stats.org), [scikit-posthocs](https://scikit-posthocs.readthedocs.io), [lifelines](https://lifelines.readthedocs.io), [visx](https://airbnb.io/visx), and [ag-grid](https://www.ag-grid.com).

## License

[MIT](LICENSE) — free to use, modify, and distribute; just keep the copyright notice.

