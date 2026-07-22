import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Code2, ExternalLink, Bug } from "lucide-react"

/* ------------------------------------------------------------------ *
 * Content is VERIFIED against the engine. Do not promote an item from
 * "Coming soon" to "Available" without executing it first.
 * ------------------------------------------------------------------ */

const CREDITS: { name: string; url: string; colorClass: string }[] = [
  { name: "Pyodide", url: "https://pyodide.org", colorClass: "text-blue-700 bg-blue-100 border-blue-200 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900/40 dark:border-blue-800 dark:hover:bg-blue-900/60" },
  { name: "SciPy", url: "https://scipy.org", colorClass: "text-emerald-700 bg-emerald-100 border-emerald-200 hover:bg-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-800 dark:hover:bg-emerald-900/60" },
  { name: "statsmodels", url: "https://www.statsmodels.org", colorClass: "text-amber-700 bg-amber-100 border-amber-200 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-900/40 dark:border-amber-800 dark:hover:bg-amber-900/60" },
  { name: "pingouin", url: "https://pingouin-stats.org", colorClass: "text-purple-700 bg-purple-100 border-purple-200 hover:bg-purple-200 dark:text-purple-300 dark:bg-purple-900/40 dark:border-purple-800 dark:hover:bg-purple-900/60" },
  { name: "scikit-posthocs", url: "https://scikit-posthocs.readthedocs.io", colorClass: "text-rose-700 bg-rose-100 border-rose-200 hover:bg-rose-200 dark:text-rose-300 dark:bg-rose-900/40 dark:border-rose-800 dark:hover:bg-rose-900/60" },
  { name: "lifelines", url: "https://lifelines.readthedocs.io", colorClass: "text-cyan-700 bg-cyan-100 border-cyan-200 hover:bg-cyan-200 dark:text-cyan-300 dark:bg-cyan-900/40 dark:border-cyan-800 dark:hover:bg-cyan-900/60" },
  { name: "visx", url: "https://airbnb.io/visx", colorClass: "text-indigo-700 bg-indigo-100 border-indigo-200 hover:bg-indigo-200 dark:text-indigo-300 dark:bg-indigo-900/40 dark:border-indigo-800 dark:hover:bg-indigo-900/60" },
  { name: "AG Grid", url: "https://www.ag-grid.com", colorClass: "text-fuchsia-700 bg-fuchsia-100 border-fuchsia-200 hover:bg-fuchsia-200 dark:text-fuchsia-300 dark:bg-fuchsia-900/40 dark:border-fuchsia-800 dark:hover:bg-fuchsia-900/60" },
  { name: "Claude", url: "https://claude.ai", colorClass: "text-teal-700 bg-teal-100 border-teal-200 hover:bg-teal-200 dark:text-teal-300 dark:bg-teal-900/40 dark:border-teal-800 dark:hover:bg-teal-900/60" },
  { name: "Antigravity", url: "https://antigravity.google", colorClass: "text-orange-700 bg-orange-100 border-orange-200 hover:bg-orange-200 dark:text-orange-300 dark:bg-orange-900/40 dark:border-orange-800 dark:hover:bg-orange-900/60" },
]

const IMPLEMENTED: string[] = [
  "8 data-table types: XY, Column, Grouped, Contingency, Survival, Parts of Whole, Multiple Variables, Nested",
  "Spreadsheet grid with multi-cell selection, Excel copy/paste, and 50-step undo/redo",
  "Descriptive statistics with assumption checks (Shapiro-Wilk normality, Levene equal variance)",
  "A test recommender that reads those assumptions — with manual override",
  "~45 statistical tests (see the usage guide below)",
  "One- and two-tailed options for t-tests and Mann-Whitney",
  "Post-hoc: Tukey, Dunnett, Dunnett's T3, Games-Howell, Dunn, Bonferroni, Šídák, Holm-Šídák — with adjusted p-values and confidence intervals",
  "12 chart types with significance brackets and asterisks",
  "Publication export: 600-DPI PNG (correct DPI metadata, embedded fonts) and SVG",
  "Google Drive save/load, light and dark themes",
  "Workspace organization: label workbooks with multiple custom color-coded tags",
  "Progressive Web App (PWA): Install it as a standalone app and load instantly offline via Service Worker caching",
]

const COMING_SOON: string[] = [
  "Excel / CSV export of data and results tables (today only graphs export)",
  "Guided Analysis wizard — a step-by-step walkthrough",
  "PDF / EPS graph export",
  "Additional chart types (see below)",
  "Local hard-drive file saving (offline storage)",
]

interface TableGuide {
  type: string
  when: string
  example: string
  tests: string
  postHoc: string
}

const TABLE_GUIDE: TableGuide[] = [
  {
    type: "Column",
    when: "Comparing groups on one measurement",
    example: "Control / Drug A / Drug B tumour volumes",
    tests:
      "One-sample t, Unpaired t (Student's), Welch's t, Paired t, Mann-Whitney, Wilcoxon, Sign test, Kolmogorov-Smirnov, One-way ANOVA, Welch's ANOVA, Brown-Forsythe, Repeated-Measures ANOVA, Kruskal-Wallis, Friedman",
    postHoc:
      "Tukey, Dunnett (vs control), Dunnett's T3, Games-Howell, Dunn, Bonferroni, Šídák, Holm-Šídák",
  },
  {
    type: "XY",
    when: "One variable measured against another",
    example: "Dose vs response; time vs signal",
    tests:
      "Pearson, Spearman, Simple linear regression, Nonlinear curve fitting (exponential, Michaelis-Menten, 4PL, Gaussian, polynomial, Boltzmann), Deming regression, Simple logistic regression, Area under curve, LOWESS, Spline, Smooth, Integrate, Differentiate",
    postHoc: "—",
  },
  {
    type: "Grouped",
    when: "Two factors at once",
    example: "Drug × Dose on blood pressure",
    tests:
      "Two-way ANOVA (Type III), Repeated-Measures two-way, Mixed-effects, ART ANOVA (non-parametric)",
    postHoc: "Tukey on marginal means",
  },
  {
    type: "Contingency",
    when: "Counts in categories",
    example: "Exposed / Unexposed × Case / Control",
    tests:
      "Chi-square (± Yates), Fisher's exact, McNemar's, Odds and risk ratios, Diagnostic (sensitivity / specificity)",
    postHoc: "—",
  },
  {
    type: "Survival",
    when: "Time until an event",
    example: "Days to relapse by treatment arm",
    tests:
      "Kaplan-Meier, Log-rank (Mantel-Cox), Gehan-Breslow-Wilcoxon, Hazard ratios, Cox regression",
    postHoc: "Pairwise log-rank (Holm)",
  },
  {
    type: "Parts of Whole",
    when: "One whole split into parts",
    example: "Cell counts per phenotype",
    tests: "Chi-square goodness of fit, Binomial test",
    postHoc: "—",
  },
  {
    type: "Multiple Variables",
    when: "Many variables per subject",
    example: "Age, BMI, dose, response per patient",
    tests:
      "Correlation matrix, Multiple linear regression, Multiple logistic regression, Poisson regression, PCA, Three-way ANOVA",
    postHoc: "—",
  },
  {
    type: "Nested",
    when: "Subsamples within groups",
    example: "3 wells per animal, 4 animals per group",
    tests: "Nested t-test / nested one-way ANOVA",
    postHoc: "Tukey",
  },
]

const CHARTS_AVAILABLE = [
  "Bar + error bars",
  "Box & whisker",
  "Violin",
  "Raincloud",
  "Scatter",
  "Strip",
  "Jitter",
  "Beeswarm",
  "Horizontal box",
  "Range / dumbbell",
  "CI forest",
  "Kaplan-Meier step",
]

const CHARTS_SOON = [
  "Grouped bar",
  "Connected / before-after line",
  "Nested plot",
  "Pie / donut",
  "Heatmap",
  "PDF / EPS export",
]

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-semibold tracking-tight mb-3">{title}</h2>
      {children}
    </section>
  )
}

export function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        {/* Hero */}
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">About StatLens</h1>
          <p className="text-lg text-muted-foreground mt-4">
            A free, browser-only statistics tool for the whole analysis loop — from raw data to a
            publication-quality figure.
          </p>
          <nav className="flex flex-wrap gap-2 pt-4">
            {[
              ["#idea", "The idea", "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60"],
              ["#architecture", "Architecture", "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/60"],
              ["#features", "Features", "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/60"],
              ["#guide", "Usage guide", "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/60"],
              ["#charts", "Charts", "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-800/60"],
              ["#disclaimer", "Disclaimer", "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/60"],
              ["#involved", "Get involved", "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/60"],
            ].map(([href, label, colorClass]) => (
              <a key={href} href={href} className={`px-4 py-2 rounded-md text-lg font-medium transition-colors border border-transparent hover:border-border shadow-sm ${colorClass}`}>
                {label}
              </a>
            ))}
          </nav>
        </header>

        {/* 1. Idea */}
        <Section id="idea" title="The idea">
          <p className="text-muted-foreground leading-relaxed text-base">
            StatLens runs the full analysis loop without a purchase or an install: pick a data-table
            type, enter or paste your data, see descriptive statistics, assumption checks and a
            recommended test, run the test, build a customisable graph with significance markers,
            and export it. It runs entirely in your browser. No account beyond Google, no payment.
          </p>
        </Section>

        {/* 2. Architecture */}
        <Section id="architecture" title="How it works">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg font-semibold">Nothing leaves your browser</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-base text-muted-foreground">
                StatLens is a static React + TypeScript Progressive Web App (PWA). There is no StatLens server and your
                data is never uploaded to one. Once loaded, the heavy Python engines are aggressively cached on your device for instant, offline loading.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg font-semibold">Scientific Accuracy & Real Libraries</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-base text-muted-foreground space-y-2">
                <p>
                  StatLens guarantees scientific accuracy by utilizing the exact same libraries that power modern data science and academic research. 
                  Statistics run in a background Web Worker via <strong>Pyodide</strong> (a port of CPython to WebAssembly).
                </p>
                <p>
                  Instead of unreliable JavaScript reimplementations, we use the genuine <strong>SciPy</strong>, <strong>statsmodels</strong>, <strong>pingouin</strong>, <strong>scikit-posthocs</strong>, and <strong>lifelines</strong> Python packages.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg font-semibold">Your Drive, your files</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-base text-muted-foreground">
                Workbooks are saved as <code className="text-lg">.statlens</code> JSON in a
                StatLens folder in your own Google Drive, using the restricted{" "}
                <code className="text-lg">drive.file</code> scope — StatLens can only see files it
                created.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg font-semibold">Vector charts</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-base text-muted-foreground">
                Charts are hand-built SVG (visx / D3), exported as 600-DPI PNG with embedded fonts,
                or as SVG.
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* 3 + 4. Features */}
        <Section id="features" title="Features">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Available now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-base text-muted-foreground">
                  {IMPLEMENTED.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-emerald-500 shrink-0">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Coming soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-base text-muted-foreground">
                  {COMING_SOON.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-amber-500 shrink-0">○</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* 5. Usage guide */}
        <Section id="guide" title="Quick usage guide">
          <p className="text-muted-foreground text-base mb-6">
            Pick the table type that matches your experiment — it determines which tests StatLens
            offers.
          </p>
          <div className="space-y-4">
            {TABLE_GUIDE.map((t) => (
              <Card key={t.type}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{t.type}</CardTitle>
                  <p className="text-lg text-muted-foreground">{t.when}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-base">
                  <div>
                    <span className="font-medium">Example: </span>
                    <span className="text-muted-foreground">{t.example}</span>
                  </div>
                  <div>
                    <span className="font-medium">Tests: </span>
                    <span className="text-muted-foreground">{t.tests}</span>
                  </div>
                  <div>
                    <span className="font-medium">Post-hoc: </span>
                    <span className="text-muted-foreground">{t.postHoc}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-dashed p-4 text-base text-muted-foreground space-y-2">
            <p>
              <strong>Three-way ANOVA</strong> expects the response column <em>last</em>, with the
              three factor columns before it, each with repeated levels.
            </p>
            <p>
              <strong>Column tables support subcolumns (replicates)</strong> for technical
              replicates; values are pooled per group.
            </p>
          </div>
        </Section>

        {/* 6. Charts */}
        <Section id="charts" title="Chart types">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-medium mb-3">Available now</h3>
              <div className="flex flex-wrap gap-2">
                {CHARTS_AVAILABLE.map((c, i) => {
                  const colors = [
                    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50",
                    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50",
                    "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/50",
                    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50",
                    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50",
                    "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700/50",
                  ];
                  return (
                    <span
                      key={c}
                      className={`rounded-full border px-4 py-1.5 text-lg font-medium shadow-sm transition-transform hover:scale-105 cursor-default ${colors[i % colors.length]}`}
                    >
                      {c}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3">Coming soon</h3>
              <div className="flex flex-wrap gap-2">
                {CHARTS_SOON.map((c, i) => {
                  const colors = [
                    "text-blue-600/80 border-blue-300/60 dark:text-blue-400/70 dark:border-blue-700/50 bg-blue-50/40 dark:bg-blue-900/10",
                    "text-emerald-600/80 border-emerald-300/60 dark:text-emerald-400/70 dark:border-emerald-700/50 bg-emerald-50/40 dark:bg-emerald-900/10",
                    "text-violet-600/80 border-violet-300/60 dark:text-violet-400/70 dark:border-violet-700/50 bg-violet-50/40 dark:bg-violet-900/10",
                    "text-rose-600/80 border-rose-300/60 dark:text-rose-400/70 dark:border-rose-700/50 bg-rose-50/40 dark:bg-rose-900/10",
                    "text-amber-600/80 border-amber-300/60 dark:text-amber-400/70 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-900/10",
                  ];
                  return (
                    <span
                      key={c}
                      className={`rounded-full border border-dashed px-4 py-1.5 text-lg font-medium cursor-default ${colors[i % colors.length]}`}
                    >
                      {c}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Disclaimer */}
        <Section id="disclaimer" title="Important disclaimer">
          <Alert className="border-red-500/50 bg-red-500/10 dark:border-red-400/40 dark:bg-red-900/20 p-6">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mt-1" />
            <AlertTitle className="text-red-800 dark:text-red-300 font-semibold text-lg ml-2">
              Important Disclaimer
            </AlertTitle>
            <AlertDescription className="text-red-900/90 dark:text-red-200/90 leading-relaxed text-base ml-2 mt-2">
              Statistical results are automated for convenience, but users should always verify test
              assumptions, selections, and outputs using additional tools or expert consultation.
              This app is not a substitute for professional statistical advice.
            </AlertDescription>
          </Alert>
        </Section>

        {/* 8. Get involved */}
        <Section id="involved" title="Get involved">
          <p className="text-muted-foreground text-base mb-6">
            StatLens is open source under the <strong>MIT licence</strong>. Contributions, bug
            reports and feature requests are all welcome.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/RonnyAllen/StatLens"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-base font-medium text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors shadow-sm"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              Source code
              <ExternalLink className="h-4 w-4 opacity-50" />
            </a>
            <a
              href="https://github.com/RonnyAllen/StatLens/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-base font-medium text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shadow-sm"
            >
              <Bug className="h-6 w-6" />
              Report an issue
              <ExternalLink className="h-4 w-4 opacity-50" />
            </a>
          </div>
        </Section>

        {/* 9. Footer */}
        <footer className="border-t pt-8 space-y-5 text-center">
          <p className="text-lg">
            Created by <strong>Rohan Alag</strong>
          </p>
          <div>
            <p className="text-lg text-muted-foreground mb-4">Special thanks to</p>
            <div className="flex flex-wrap justify-center gap-3">
              {CREDITS.map((c) => (
                <a
                  key={c.name}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-lg font-medium transition-colors shadow-sm ${c.colorClass}`}
                >
                  {c.name}
                  <ExternalLink className="h-4 w-4 opacity-50" />
                </a>
              ))}
            </div>
          </div>
          <div className="pt-6 pb-4">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-lg font-semibold text-primary-foreground shadow-md hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-200">
              ← Back to StatLens
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
