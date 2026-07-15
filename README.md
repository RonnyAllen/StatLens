# StatLens

**A free, browser-based alternative to GraphPad Prism.** 70+ statistical tests, publication-ready graphs, and your data never leaves your machine — because there is no server.

StatLens runs a real Python scientific stack (NumPy, SciPy, statsmodels, pingouin, lifelines) *inside your browser* via [Pyodide](https://pyodide.org) and WebAssembly. Workbooks are stored in your own Google Drive. There is no backend, no database, and no account to create beyond the Google sign-in you already have.

> **Statistical correctness is the top priority; UX polish is second.**
> 44 of the implemented analyses are pinned to golden reference values from SciPy, statsmodels, pingouin, and R.

---

## Table of contents

- [Why StatLens](#why-statlens)
- [Features](#features)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Google OAuth setup](#google-oauth-setup)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Privacy & data](#privacy--data)
- [Contributing](#contributing)
- [License](#license)

---

## Why StatLens

Prism is excellent and expensive. Most of what bench scientists actually need — a typed data table, the right test, a clean graph with significance brackets — doesn't require a $1,000+/seat desktop licence or an install.

StatLens aims to cover that ground in a browser tab:

- **Free and open.** No licence, no seat count, no install.
- **Actually correct.** Every statistic is checked against a published reference implementation, not eyeballed. See [Testing](#testing).
- **Yours.** Your data goes to your Drive, not our server — we don't have one.
- **Portable.** Works on any machine with a modern browser. Nothing to install, nothing to sync.

---

## Features

### Data tables

Eight Prism-style typed table types, each of which drives which analyses are offered:

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

Sub-column formats include replicates, mean ± SD (n) and mean ± SEM (n).

### Analyses

**70 analyses** are implemented and runtime-audited (see [`docs/AUDIT_MATRIX.md`](docs/AUDIT_MATRIX.md)). Highlights:

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

Tukey HSD · Dunnett's T3 · Šidák / Bonferroni corrections · control-vs-others and specific-pairs comparison schemes. See [`docs/Choosing Post Hoc Tests.md`](docs/) for the selection logic.
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

Analyses report effect sizes (Cohen's d, eta², mean differences), confidence intervals, and degrees of freedom, plus a Markdown results report.

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

## Architecture

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

**How it fits together:**

1. **The stats engine is real Python.** `src/stats/analysis_engine.py` (~2,800 lines) is the single source of statistical truth. It executes under Pyodide inside a Web Worker, so heavy analyses never block the UI.
2. **Pyodide loads from the jsdelivr CDN at runtime.** The Python runtime and scientific packages are *not* in the JS bundle. First load pulls tens of MB and takes a while; the header shows `Loading engine…` → `Engine ready`. Subsequent loads are cached by the browser.
3. **Optional packages install via micropip** (pingouin, scikit-posthocs, lifelines) with defensive imports — if one fails to install, the engine still loads and the analyses that don't need it still work.
4. **No `SharedArrayBuffer`.** This matters: it means StatLens needs no COOP/COEP headers and can be hosted on plain static hosting like GitHub Pages.
5. **Storage is Google Drive.** Workbooks are JSON files named `*.statlens`, saved into a `StatLens` folder in your Drive. The app uses the `drive.file` scope, so it can only ever see files it created — not the rest of your Drive.

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
| Auth | Google Identity Services (GIS) |
| Lint | oxlint |
| Tests | vitest |

---

## Getting started

### Prerequisites

- **Node.js 20+** and npm
- A **Google Cloud OAuth client ID** (see [below](#google-oauth-setup)) — required for sign-in and Drive storage
- A modern browser with WebAssembly (any current Chrome, Edge, Firefox, or Safari)

### Install and run

```bash
git clone https://github.com/<your-username>/StatLens.git
cd StatLens/apps/web
npm install
```

Create `apps/web/.env`:

```
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

Then:

```bash
npm run dev
```

Open http://localhost:5173. The first load will sit on `Loading engine…` for a while as Pyodide downloads — that's expected and it's cached afterwards.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |

> **Note:** there is currently no `test` script wired up. Run tests with `npx vitest` (see [Testing](#testing)). Adding `"test": "vitest"` to `apps/web/package.json` is a welcome first PR.

---

## Google OAuth setup

StatLens needs an OAuth client to sign in and write to Drive. This is free.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project.
2. **APIs & Services → Enabled APIs → + Enable APIs and Services** → enable the **Google Drive API**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Web application**.
4. Under **Authorized JavaScript origins**, add every origin you'll serve from — **origin only, no path, no trailing slash**:
   - `http://localhost:5173` for local dev
   - `https://<your-username>.github.io` if deploying to GitHub Pages
5. Copy the client ID into `apps/web/.env` as `VITE_GOOGLE_CLIENT_ID`.
6. **OAuth consent screen** → **Publish app** → **In production**.
   - While in *Testing*, only accounts listed under **Test users** can sign in, and their sessions expire after 7 days.
   - StatLens only requests `openid`, `email`, `profile`, and `drive.file`. **`drive.file` is a non-sensitive scope**, so publishing to production does **not** trigger Google's app-verification review.

> The OAuth **client ID is public by design** — it is embedded in the built JS bundle and is not a secret. It is not a client *secret*; StatLens never uses one.

---

## Deployment

StatLens is a static SPA, so any static host works. It's configured out of the box for **GitHub Pages** via `.github/workflows/deploy.yml`.

**Key configuration:** `apps/web/vite.config.ts` sets `base` from `const REPO`, because Pages serves project sites from `https://<user>.github.io/<repo>/`. If you fork and rename, **change `const REPO` to match your repo name exactly** — a mismatch produces a blank page with 404s on `/assets/`.

The build also emits `dist/404.html` (a copy of `index.html`) via a small Vite plugin. This is what makes clean URLs work: GitHub Pages has no server-side rewrites, so without it, refreshing on `/dashboard` would 404. Pages serves `404.html` for unknown paths and React Router takes over from there.

In CI, set a repository variable `VITE_GOOGLE_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables). Without it the build still succeeds but the client ID is empty and **sign-in silently fails**.

Cloudflare Pages, Netlify, and Vercel also work well (they support SPA rewrites natively, so you can drop the 404 trick and set `base` to `/`). Whichever you choose, add that host's origin to the OAuth client.

---

## Project structure

```
StatLens/
├── apps/web/                     # the entire application
│   ├── src/
│   │   ├── App.tsx               # routes, header, engine bootstrap
│   │   ├── stats/
│   │   │   ├── analysis_engine.py    # ★ all statistics live here (~2.8k lines)
│   │   │   ├── pyodide.worker2.ts    # Web Worker: boots Pyodide, runs the engine
│   │   │   ├── engine.ts             # main-thread client for the worker
│   │   │   └── __tests__/            # golden-value oracle tests
│   │   ├── charts/
│   │   │   ├── GraphEngine.tsx       # chart dispatch
│   │   │   ├── {Column,XY,Survival}Charts.tsx
│   │   │   ├── SignificanceLayer.tsx # significance bracket layout
│   │   │   └── geometry/             # pure, testable chart maths
│   │   ├── components/
│   │   │   ├── dashboard/            # workbook list
│   │   │   ├── workspace/            # grid, analyse panel, results, graph settings
│   │   │   └── ui/                   # shadcn/ui primitives
│   │   ├── data/
│   │   │   ├── auth.tsx              # Google Identity Services
│   │   │   ├── driveApi.ts           # Drive read/write
│   │   │   └── sheetFactory.ts       # new-sheet templates
│   │   ├── lib/exportGraph.ts        # PNG / SVG export
│   │   └── types/workbook.ts         # zod schemas for the workbook format
│   └── vite.config.ts            # base path + SPA 404 emitter
├── docs/
│   ├── PRD.md                    # product requirements
│   ├── AUDIT_MATRIX.md           # every analysis + its runtime/golden status
│   ├── IMPLEMENTATION_PLAN.md
│   └── *.md                      # statistical references (post hoc, curve fitting…)
├── tests/                        # Python-side oracle tests
└── Agents.md                     # project charter & engineering rules
```

---

## Testing

The project's central rule, from [`Agents.md`](Agents.md):

> **Statistical correctness is non-negotiable.** Every statistic/test has a unit test against known reference values (SciPy/statsmodels/pingouin/lifelines docs, R, or published worked examples) with sensible tolerance. Never change an algorithm without updating tests + comments.

**What that looks like in practice:**

- `apps/web/src/stats/__tests__/golden_values.json` — **44 analyses** pinned to reference outputs
- `apps/web/src/stats/__tests__/reference_R/` — R scripts that generated the expected values (e.g. `unpaired_t_test.R`, `mann_whitney_test.R`)
- `apps/web/src/stats/__tests__/run_audit.test.ts` — boots Pyodide in Node and runs the real engine against the golden values
- `apps/web/src/charts/__tests__/geometry.test.ts` — chart geometry maths
- `tests/` — Python-side oracle tests
- `docs/AUDIT_MATRIX.md` — per-analysis status: does it run, is it golden-tested, does it go through the engine path

Run them:

```bash
cd apps/web
npx vitest              # watch mode
npx vitest run          # single pass
```

Note these tests download Pyodide on first run, so the initial run is slow.

**If you add or change an analysis, add its golden value.** An analysis without a reference test is considered unfinished.

---

## Privacy & data

- **There is no StatLens server.** The app is static files; all computation happens in your browser.
- **Your data goes to your Google Drive**, under a folder named `StatLens`, as `*.statlens` JSON files.
- The app requests the **`drive.file`** scope, which grants access *only to files the app itself creates*. It cannot read the rest of your Drive.
- Your Google access token is held in `localStorage` for the session and revoked on sign-out.
- The only third-party network calls are: Google (auth + Drive), and the jsdelivr CDN + PyPI (to fetch the Python runtime and packages).

---

## Contributing

Read [`Agents.md`](Agents.md) first — it's the project charter and it's short. The golden rules:

1. **Statistical correctness is non-negotiable.** Reference test or it didn't happen.
2. **Prefer correctness and clarity over cleverness.** Prefer fewer moving parts.
3. **Browser-only.** No backend, no database. If a feature needs a server, it needs a different design.

Good first issues:

- Wire up a `test` script in `apps/web/package.json`
- Add golden values for the 26 analyses that run but aren't yet pinned (see `docs/AUDIT_MATRIX.md`)
- Code-split the main bundle (currently ~1.8 MB / 540 kB gzipped)

---

## Acknowledgements

Built on the shoulders of [Pyodide](https://pyodide.org), [SciPy](https://scipy.org), [statsmodels](https://www.statsmodels.org), [pingouin](https://pingouin-stats.org), [scikit-posthocs](https://scikit-posthocs.readthedocs.io), [lifelines](https://lifelines.readthedocs.io), [visx](https://airbnb.io/visx), and [ag-grid](https://www.ag-grid.com).

GraphPad Prism is a trademark of GraphPad Software, LLC. StatLens is an independent project and is not affiliated with, endorsed by, or derived from GraphPad Software.

## License

<!-- TODO: pick one. Without a LICENSE file, "public on GitHub" still means all rights reserved,
     and nobody can legally use or contribute to this. MIT is the usual choice for something
     like this; AGPL-3.0 if you want derivatives to stay open. Add a LICENSE file and
     update this section. -->

_No licence chosen yet — see the note above._
