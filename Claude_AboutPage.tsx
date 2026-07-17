import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Code2, ExternalLink, Bug } from "lucide-react"

/* ------------------------------------------------------------------ *
 * Content is VERIFIED against the engine. Do not promote an item from
 * "Coming soon" to "Available" without executing it first.
 * ------------------------------------------------------------------ */

const CREDITS: { name: string; url: string }[] = [
  { name: "Pyodide", url: "https://pyodide.org" },
  { name: "SciPy", url: "https://scipy.org" },
  { name: "statsmodels", url: "https://www.statsmodels.org" },
  { name: "pingouin", url: "https://pingouin-stats.org" },
  { name: "scikit-posthocs", url: "https://scikit-posthocs.readthedocs.io" },
  { name: "lifelines", url: "https://lifelines.readthedocs.io" },
  { name: "visx", url: "https://airbnb.io/visx" },
  { name: "AG Grid", url: "https://www.ag-grid.com" },
  { name: "Claude", url: "https://claude.ai" },
  { name: "Antigravity", url: "https://antigravity.google" },
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
]

const COMING_SOON: string[] = [
  "Excel / CSV export of data and results tables (today only graphs export)",
  "Guided Analysis wizard — a step-by-step walkthrough",
  "PDF / EPS graph export",
  "Additional chart types (see below)",
  "Offline / local-file storage",
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
      <h2 className="text-2xl font-semibold tracking-tight mb-4">{title}</h2>
      {children}
    </section>
  )
}

export function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-14">
        {/* Hero */}
        <header className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">About StatLens</h1>
          <p className="text-lg text-muted-foreground">
            A free, browser-only statistics tool for the whole analysis loop — from raw data to a
            publication-quality figure.
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm text-muted-foreground">
            {[
              ["#idea", "The idea"],
              ["#architecture", "Architecture"],
              ["#features", "Features"],
              ["#guide", "Usage guide"],
              ["#charts", "Charts"],
              ["#disclaimer", "Disclaimer"],
              ["#involved", "Get involved"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-foreground transition-colors">
                {label}
              </a>
            ))}
          </nav>
        </header>

        {/* 1. Idea */}
        <Section id="idea" title="The idea">
          <p className="text-muted-foreground leading-relaxed">
            StatLens runs the full analysis loop without a purchase or an install: pick a data-table
            type, enter or paste your data, see descriptive statistics, assumption checks and a
            recommended test, run the test, build a customisable graph with significance markers,
            and export it. It runs entirely in your browser. No account beyond Google, no payment.
          </p>
        </Section>

        {/* 2. Architecture */}
        <Section id="architecture" title="How it works">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nothing leaves your browser</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                StatLens is a static React + TypeScript app. There is no StatLens server and your
                data is never uploaded to one.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Real statistics libraries</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Statistics run in a Web Worker via <strong>Pyodide</strong> (CPython compiled to
                WebAssembly), using the genuine SciPy, statsmodels, pingouin, scikit-posthocs and
                lifelines packages — not re-implementations.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Drive, your files</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Workbooks are saved as <code className="text-xs">.statlens</code> JSON in a
                StatLens folder in your own Google Drive, using the restricted{" "}
                <code className="text-xs">drive.file</code> scope — StatLens can only see files it
                created.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Vector charts</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Charts are hand-built SVG (visx / D3), exported as 600-DPI PNG with embedded fonts,
                or as SVG.
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* 3 + 4. Features */}
        <Section id="features" title="Features">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Available now
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
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
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Coming soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
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
          <p className="text-muted-foreground mb-6">
            Pick the table type that matches your experiment — it determines which tests StatLens
            offers.
          </p>
          <div className="space-y-4">
            {TABLE_GUIDE.map((t) => (
              <Card key={t.type}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t.type}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t.when}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
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
          <div className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-1">
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
              <h3 className="text-sm font-medium mb-3">Available now</h3>
              <div className="flex flex-wrap gap-2">
                {CHARTS_AVAILABLE.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3">Coming soon</h3>
              <div className="flex flex-wrap gap-2">
                {CHARTS_SOON.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground/70"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Disclaimer */}
        <Section id="disclaimer" title="Important disclaimer">
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">
              Important Disclaimer
            </AlertTitle>
            <AlertDescription className="text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
              Statistical results are automated for convenience, but users should always verify test
              assumptions, selections, and outputs using additional tools or expert consultation.
              This app is not a substitute for professional statistical advice.
            </AlertDescription>
          </Alert>
        </Section>

        {/* 8. Get involved */}
        <Section id="involved" title="Get involved">
          <p className="text-muted-foreground mb-4">
            StatLens is open source under the <strong>MIT licence</strong>. Contributions, bug
            reports and feature requests are all welcome.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/RonnyAllen/StatLens"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Code2 className="h-4 w-4" />
              Source code
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
            <a
              href="https://github.com/RonnyAllen/StatLens/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Bug className="h-4 w-4" />
              Report an issue
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          </div>
        </Section>

        {/* 9. Footer */}
        <footer className="border-t pt-8 space-y-5 text-center">
          <p className="text-sm">
            Created by <strong>Rohan Alag</strong>
          </p>
          <div>
            <p className="text-sm text-muted-foreground mb-3">Special thanks to</p>
            <div className="flex flex-wrap justify-center gap-2">
              {CREDITS.map((c) => (
                <a
                  key={c.name}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/20 transition-colors"
                >
                  {c.name}
                  <ExternalLink className="h-3 w-3 opacity-40" />
                </a>
              ))}
            </div>
          </div>
          <p className="pt-2">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to StatLens
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
