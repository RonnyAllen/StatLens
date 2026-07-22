# StatLens

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-ronnyallen.github.io%2FStatLens-brightgreen)](https://ronnyallen.github.io/StatLens/)

**A free, browser-only statistics tool for the whole analysis loop — from raw data to a publication-quality figure.**

### → **[Try it: ronnyallen.github.io/StatLens](https://ronnyallen.github.io/StatLens/)**

StatLens runs a real Python scientific stack — NumPy, SciPy, statsmodels, pingouin, lifelines — *inside your browser* via [Pyodide](https://pyodide.org) and WebAssembly. ~45 statistical tests, eight typed data table types, and 12 chart types with automatic significance brackets.

Nothing to install. No server. Your workbooks are saved to your own Google Drive.

> **Statistical correctness is the top priority; UX polish is second.**
> 44 analyses are pinned to golden reference values from SciPy, statsmodels, pingouin, and R — and re-verified in CI on every push.

---

## Table of contents

- [Why](#why)
- [Features](#features)
- [What goes in which table](#what-goes-in-which-table)
- [Charts](#charts)
- [Coming soon](#coming-soon)
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
- **Portable & Installable.** Any machine with a modern browser. It functions as a Progressive Web App (PWA): you can install it to your device and, thanks to aggressive Service Worker caching, it loads instantly and runs offline!

---

## Features

- **8 data-table types** — XY, Column, Grouped, Contingency, Survival, Parts of Whole, Multiple Variables, Nested
- **Spreadsheet grid** with multi-cell selection, Excel copy/paste, and 50-step undo/redo
- **Descriptive statistics with assumption checks** — Shapiro-Wilk normality, Levene equal variance
- **A test recommender that reads those assumptions** — with manual override
- **~45 statistical tests** (see [the table guide](#what-goes-in-which-table))
- **One- and two-tailed options** for t-tests and Mann-Whitney
- **Post-hoc tests** — Tukey, Dunnett, Dunnett's T3, Games-Howell, Dunn, Bonferroni, Šídák, Holm-Šídák — with adjusted p-values and confidence intervals
- **12 chart types** with significance brackets and asterisks
- **Publication export** — 600-DPI PNG (correct DPI metadata, embedded fonts) and SVG
- **Google Drive save/load**, light and dark themes
- **Workspace organization** — label workbooks with custom tags, assign them distinct colors, and apply multiple tags per workbook.
- **Progressive Web App (PWA)** — Install it as a standalone app with instant offline loading via background Service Worker caching.

An in-app [About page](https://ronnyallen.github.io/StatLens/about) carries the same guide, kept verified against the engine.

---

## What goes in which table

The table type you pick determines which analyses are offered.

| Table | Use when | Example | Tests | Post hoc |
|---|---|---|---|---|
| **Column** | Comparing groups on one measurement | Control / Drug A / Drug B tumour volumes | One-sample t, Unpaired t (Student's), Welch's t, Paired t, Mann-Whitney, Wilcoxon, Sign test, Kolmogorov-Smirnov, One-way ANOVA, Welch's ANOVA, Brown-Forsythe, Repeated-Measures ANOVA, Kruskal-Wallis, Friedman | Tukey, Dunnett (vs control), Dunnett's T3, Games-Howell, Dunn, Bonferroni, Šídák, Holm-Šídák |
| **XY** | One variable measured against another | Dose vs response; time vs signal | Pearson, Spearman, Simple linear regression, Nonlinear curve fitting (exponential, Michaelis-Menten, 4PL, Gaussian, polynomial, Boltzmann), Deming regression, Simple logistic regression, Area under curve, LOWESS, Spline, Smooth, Integrate, Differentiate | — |
| **Grouped** | Two factors at once | Drug × Dose on blood pressure | Two-way ANOVA (Type III), Repeated-Measures two-way, Mixed-effects, ART ANOVA (non-parametric) | Tukey on marginal means |
| **Contingency** | Counts in categories | Exposed / Unexposed × Case / Control | Chi-square (± Yates), Fisher's exact, McNemar's, Odds and risk ratios, Diagnostic (sensitivity / specificity) | — |
| **Survival** | Time until an event | Days to relapse by treatment arm | Kaplan-Meier, Log-rank (Mantel-Cox), Gehan-Breslow-Wilcoxon, Hazard ratios, Cox regression | Pairwise log-rank (Holm) |
| **Parts of Whole** | One whole split into parts | Cell counts per phenotype | Fraction of total, Chi-square goodness of fit, Binomial test | — |
| **Multiple Variables** | Many variables per subject | Age, BMI, dose, response per patient | Correlation matrix, Multiple linear regression, Multiple logistic regression, Poisson regression, PCA, Three-way ANOVA | — |
| **Nested** | Subsamples within groups | 3 wells per animal, 4 animals per group | Nested t-test / nested one-way ANOVA | Tukey |

Analyses report effect sizes (Cohen's d, eta², mean differences), confidence intervals, and degrees of freedom, alongside a Markdown results report.

---

## Charts

Bar + error bars · Box & whisker · Violin · Raincloud · Scatter · Strip · Jitter · Beeswarm · Horizontal box · Range / dumbbell · CI forest · Kaplan-Meier step

All support significance brackets and asterisks, computed and laid out automatically. Error bars (SD / SEM / CI) and regression overlays with confidence bands. Light/dark theme, 15 bundled font families.

**Export:** 600-DPI PNG with correct DPI metadata and embedded fonts, or SVG.

---

## Coming soon

- Excel / CSV export of data and results tables (today only graphs export)
- Guided Analysis wizard — a step-by-step walkthrough
- PDF / EPS graph export
- More chart types — grouped bar, connected / before-after line, nested plot, pie / donut, heatmap
- Local hard-drive file saving (offline storage)

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
│                   └── analysis_engine.py  (3.1k lines)        │
│                                                              │
└──────────────┬───────────────────────────────────────────────┘
               │  HTTPS
               ▼
   Google Drive (drive.file scope) ── your workbooks, your account
```

**The parts that matter:**

1. **The stats engine is real Python.** [`src/stats/analysis_engine.py`](apps/web/src/stats/analysis_engine.py) (~3,100 lines) is the single source of statistical truth. It executes under Pyodide inside a Web Worker, so heavy analyses never block the UI.
2. **Pyodide loads from a CDN at runtime, but caches locally.** The Python runtime and scientific packages are *not* in the JS bundle. First load pulls tens of MB — the header shows `Loading engine…` → `Engine ready`. After that, the **Service Worker** caches everything locally, meaning the app loads instantly on subsequent visits (even offline) and updates silently in the background (`StaleWhileRevalidate`).
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
| Tests | vitest + a Python-side CI matrix |

---

## Correctness

The project's central rule, from [`Agents.md`](Agents.md):

> **Statistical correctness is non-negotiable.** Every statistic/test has a unit test against known reference values (SciPy/statsmodels/pingouin/lifelines docs, R, or published worked examples) with sensible tolerance. Never change an algorithm without updating tests + comments.

What that looks like in practice:

- [`golden_values.json`](apps/web/src/stats/__tests__/golden_values.json) — **44 analyses** pinned to reference outputs
- [`reference_R/`](apps/web/src/stats/__tests__/reference_R/) — the R scripts that generated those expected values
- `run_audit.test.ts` — boots Pyodide and runs the **real engine** against the golden values, not a mock
- `charts/__tests__/geometry.test.ts` — chart geometry maths
- [`docs/AUDIT_MATRIX.md`](docs/AUDIT_MATRIX.md) — per-analysis status: does it run, is it golden-tested, does it go through the engine path

### Statistics CI

[`.github/workflows/stats-tests.yml`](.github/workflows/stats-tests.yml) runs on every push and PR, against a Python stack **pinned to match what the Pyodide worker installs** — so CI and the browser can't silently diverge:

- **Golden-value verification** — the reference numbers still hold
- **Post-hoc contract matrix** — including a Dunnett determinism guard
- **UI ↔ engine string boundary contract** — catches the class of bug where the UI asks for one test and the engine quietly runs another
- **Typecheck** — full `tsc` pass

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
│   ├── pages/AboutPage.tsx   # in-app about + usage guide
│   ├── stats/
│   │   ├── analysis_engine.py    # ★ all statistics live here (~3.1k lines)
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
├── apps/web/scratch/         # Python contract + verification scripts (run by CI)
├── docs/
│   ├── PRD.md                    # product requirements
│   ├── AUDIT_MATRIX.md           # every analysis + its runtime/golden status
│   └── *.md                      # statistical references (post hoc, curve fitting…)
├── tests/                        # Python-side oracle tests
└── Agents.md                     # project charter & engineering rules
```

---

## Acknowledgements

Built on the shoulders of [Pyodide](https://pyodide.org), [SciPy](https://scipy.org), [statsmodels](https://www.statsmodels.org), [pingouin](https://pingouin-stats.org), [scikit-posthocs](https://scikit-posthocs.readthedocs.io), [lifelines](https://lifelines.readthedocs.io), [visx](https://airbnb.io/visx), and [AG Grid](https://www.ag-grid.com).

Built with [Claude](https://claude.ai) and [Antigravity](https://antigravity.google).

## License

[MIT](LICENSE) — free to use, modify, and distribute; just keep the copyright notice.
