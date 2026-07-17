# TASK E: palettes, survival options, ANOVA routing, About, UI overhaul, tails

Six items. **E1 and E6 are tested code — apply them verbatim.** E2/E3/E5 are specs, because they
need design decisions I can't make for you. E4 ships as a finished file.

> **I could not verify anchors against your current tree** — I don't have a snapshot since Task C/D
> landed. Every FIND below is from the pre-D revision. **If a FIND doesn't match: STOP and report,
> don't improvise.** Send me the zip and I'll re-anchor. E1/E4/E6 are low-risk (E6 is engine-only,
> which D didn't touch; E4 is a whole-file replace).

---

## E6 (do first) — One- and two-tailed tests ✅ tested

### What's actually missing
Your item 6 says "Student's t test and Mann-Whitney U aren't incorporated". **They both are** —
"Unpaired t test" *is* Student's t-test, and Mann-Whitney has run correctly all along (exact P with
tie handling for n≤16). What is genuinely missing is **tails**: `pg.ttest(...)` and `pg.mwu(...)`
are called with no `alternative=`, so **every test is silently two-sided**, and the UI has zero
tails controls. Prism always asks.

So this is one feature (tails), not two missing tests. Labelling is E6c.

### ⚠️ The trap that makes this non-obvious
The Mann-Whitney branch calls `pg.mwu(...)` and then **overwrites** the p-value:

```python
_exact_p = _mwu_exact_p(groups[0], groups[1])
if _exact_p is not None:
    result["p_value"] = get_clean_float(_exact_p)   # <-- overwrites
```

`_mwu_exact_p` is two-sided **by construction** (`U_obs = min(U1, n1*n2 - U1)`). Patch only
`pg.mwu` and one-tailed MWU stays silently two-sided for n≤16 — precisely where MWU is used most.
Both call sites must change.

### E6a — teach the exact path direction. **1 occurrence.**

FIND:
```python
def _mwu_exact_p(a, b, max_n=16):
    """Exact two-sided Mann-Whitney P accounting for ties (matches GraphPad Prism),
    by enumerating all C(n1+n2, n1) group assignments of the combined mid-ranks.
    Returns None when total n exceeds max_n, so the caller keeps the asymptotic P."""
```
REPLACE:
```python
def _mwu_exact_p(a, b, max_n=16, alternative="two-sided"):
    """Exact Mann-Whitney P accounting for ties (matches GraphPad Prism), by enumerating
    all C(n1+n2, n1) group assignments of the combined mid-ranks.
    `alternative` is 'two-sided' | 'less' | 'greater' and follows scipy's convention
    (direction refers to the FIRST sample). Returns None when total n exceeds max_n,
    so the caller keeps the asymptotic P."""
```

FIND:
```python
    U1_obs = ranks[:n1].sum() - n1 * (n1 + 1) / 2.0
    U_obs = min(U1_obs, n1 * n2 - U1_obs)
    count = 0; total = 0
    for comb in combinations(range(N), n1):
        U1 = ranks[list(comb)].sum() - n1 * (n1 + 1) / 2.0
        U = min(U1, n1 * n2 - U1)
        total += 1
        if U <= U_obs + 1e-9:
            count += 1
    return count / total if total else None
```
REPLACE:
```python
    U1_obs = ranks[:n1].sum() - n1 * (n1 + 1) / 2.0
    U_obs = min(U1_obs, n1 * n2 - U1_obs)
    count = 0; total = 0
    for comb in combinations(range(N), n1):
        U1 = ranks[list(comb)].sum() - n1 * (n1 + 1) / 2.0
        total += 1
        if alternative == "less":
            # P(U1 <= U1_obs): the first sample tends to be SMALLER.
            if U1 <= U1_obs + 1e-9:
                count += 1
        elif alternative == "greater":
            # P(U1 >= U1_obs): the first sample tends to be LARGER.
            if U1 >= U1_obs - 1e-9:
                count += 1
        else:
            U = min(U1, n1 * n2 - U1)
            if U <= U_obs + 1e-9:
                count += 1
    return count / total if total else None
```

### E6b — read the option and pass it. **1 occurrence each.**

FIND:
```python
    specific_pairs = options.get('specificPairs', [])
```
REPLACE:
```python
    specific_pairs = options.get('specificPairs', [])
    # Tails. Prism always asks; the UI sends 'two-sided' | 'less' | 'greater'
    # (direction refers to the FIRST/left group, matching scipy's convention).
    tails = options.get('tails', 'two-sided')
    if tails not in ('two-sided', 'less', 'greater'):
        tails = 'two-sided'
    _tail_label = {'two-sided': 'two-tailed', 'less': 'one-tailed', 'greater': 'one-tailed'}[tails]
```

Then these four one-line edits (each **1 occurrence**):

| FIND | REPLACE |
|---|---|
| `res = pg.ttest(groups[0], groups[1], paired=False, correction=False)` | `res = pg.ttest(groups[0], groups[1], paired=False, correction=False, alternative=tails)` |
| `res = pg.ttest(groups[0], groups[1], paired=False, correction=True)` | `res = pg.ttest(groups[0], groups[1], paired=False, correction=True, alternative=tails)` |
| `res = pg.ttest(groups[0][:min_len], groups[1][:min_len], paired=True)` | `res = pg.ttest(groups[0][:min_len], groups[1][:min_len], paired=True, alternative=tails)` |
| `res = pg.mwu(groups[0], groups[1])` | `res = pg.mwu(groups[0], groups[1], alternative=tails)` |

And the exact-path call. **1 occurrence.**

FIND:
```python
                _exact_p = _mwu_exact_p(groups[0], groups[1])
```
REPLACE:
```python
                # The exact path OVERWRITES p below, so it must know the direction too --
                # otherwise a one-tailed request silently returns a two-sided p for n <= 16.
                _exact_p = _mwu_exact_p(groups[0], groups[1], alternative=tails)
```

**Measured — every value matches scipy exactly:**

| Test | two-sided | less | greater |
|---|---|---|---|
| Unpaired t | 1.6928189e-05 | 8.4640946e-06 | 0.99999154 |
| Welch's t | 1.7784163e-05 | 8.8920815e-06 | 0.99999111 |
| Paired t | 9.9446115e-07 | 4.9723058e-07 | 0.9999995 |
| **Mann-Whitney (exact path)** | 0.00058275058 | **0.00029137529** | 1 |

Omitting `tails` still returns the old two-sided value (`1.6928189196568956e-05`) — back-compatible.
All three suites exit 0.

### E6c — UI

In `TestOptionsDialog.tsx` (**CRLF**) add a **Tails** radio for Unpaired t, Welch's t, Paired t,
One-sample t, Mann-Whitney and Wilcoxon:

- **Two-tailed** (default) → `tails: "two-sided"`
- **One-tailed** → `tails: "less" | "greater"`, with a direction picker reading
  *"Predicted: {group1} < {group2}"* / *"{group1} > {group2}"*.

`less`/`greater` refer to the **first (left) group**. Show a hint: *a one-tailed test requires you
to predict the direction before seeing the data.* Include `tails` in the saved `Analysis.options`
(the PRD already lists it) and surface *"two-tailed"/"one-tailed"* in the results report.

Rename the menu label `Unpaired t test` → **`Unpaired t test (Student's)`** — display only, do
**not** change the `test_id` string; the engine dispatches on it.

---

## E1 — More colour palettes

Currently only 3, and they're constrained in **two** places that must stay in sync.

**(a)** `src/types/workbook.ts:117` — the zod enum is the gatekeeper. A palette missing here fails
validation on load.

FIND:
```ts
  palette: z.enum(["okabe-ito", "viridis", "tableau"]).default("okabe-ito"),
```
REPLACE:
```ts
  palette: z.enum([
    "okabe-ito", "viridis", "tableau", "set1", "dark2", "paired",
    "nature", "lancet", "jama", "grayscale", "magma", "cividis"
  ]).default("okabe-ito"),
```

**(b)** `src/charts/ColumnCharts.tsx:57` — add the swatches to `PALETTES` (exported; `XYCharts.tsx`
imports it, so all chart families inherit them):

```ts
export const PALETTES: Record<string, string[]> = {
  "okabe-ito": ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#000000"],
  "viridis":   ["#440154", "#414487", "#2A788E", "#22A884", "#7AD151", "#FDE725"],
  "tableau":   ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC949", "#AF7AA1", "#FF9DA7", "#9C755F", "#BAB0AB"],
  // --- added ---
  "set1":      ["#E41A1C", "#377EB8", "#4DAF4A", "#984EA3", "#FF7F00", "#FFFF33", "#A65628", "#F781BF"],
  "dark2":     ["#1B9E77", "#D95F02", "#7570B3", "#E7298A", "#66A61E", "#E6AB02", "#A6761D", "#666666"],
  "paired":    ["#A6CEE3", "#1F78B4", "#B2DF8A", "#33A02C", "#FB9A99", "#E31A1C", "#FDBF6F", "#FF7F00"],
  "nature":    ["#E64B35", "#4DBBD5", "#00A087", "#3C5488", "#F39B7F", "#8491B4", "#91D1C2", "#DC0000"],
  "lancet":    ["#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F", "#FDAF91", "#AD002A", "#ADB6B6"],
  "jama":      ["#374E55", "#DF8F44", "#00A1D5", "#B24745", "#79AF97", "#6A6599", "#80796B"],
  "grayscale": ["#000000", "#404040", "#666666", "#8C8C8C", "#B3B3B3", "#D9D9D9"],
  "magma":     ["#000004", "#3B0F70", "#8C2981", "#DE4968", "#FE9F6D", "#FCFDBF"],
  "cividis":   ["#00204D", "#31446B", "#666970", "#958F78", "#CAB969", "#FFEA46"],
};
```

**(c)** `GraphSettingsPanel.tsx:~360` — add matching `<option>`s. Group them:
*Colourblind-safe* (Okabe-Ito, Viridis, Cividis, Magma), *Journal* (Nature, Lancet, JAMA),
*Qualitative* (Tableau 10, Set1, Dark2, Paired), *Print* (Grayscale).

Okabe-Ito, Viridis and Cividis are colourblind-safe; Grayscale is for print. Worth labelling —
it's a real reason people pick a palette.

---

## E2 — Survival graph options (spec)

`SurvivalChart.tsx` today: `config.errorBars` is a **boolean** that only draws a 95% CI band; symbols
are drawn only at censored points (`grp.data.filter(d => d.isCensored)`); survival is always a
fraction. Prism (your screenshot) offers three independent controls. Note the KM curve and Greenwood
SE are computed **in TypeScript** inside `SurvivalChart.tsx` — `se` already exists at the CI line, so
SE bars need no engine work.

Add to the **graph** config schema (not `SurvivalConfigSchema`, which is sheet-level):

```ts
survivalShowAs:    z.enum(["fractions", "percents"]).default("fractions"),
survivalSymbolsAt: z.enum(["all", "censored"]).default("censored"),
survivalErrorBars: z.enum(["none", "se", "ci95"]).default("none"),
survivalStyle:     z.enum(["staircase-ticks", "staircase", "connected-dots", "dots-only"]).default("staircase-ticks"),
```

- **fractions → percents**: multiply the y-scale by 100 and set the axis label/format. Do it at the
  scale, not per-point.
- **SE vs 95% CI**: you have `se`; CI is `S ± 1.96·se`, SE bars are `S ± se`. Both must clamp to
  [0,1] like the existing CI does.
- **Symbols at all points**: drop the `.filter(d => d.isCensored)` and render every point, keeping
  censored ticks visually distinct.
- **⚠️ `errorBars` changes from boolean to enum.** Migrate existing saved workbooks or zod will
  reject them: coerce `true → "ci95"`, `false → "none"` in the schema (`z.preprocess`).

---

## E3 — Two-way ANOVA matching dialog + Three-way under Grouped (spec)

**What's already true:** the Grouped recommender menu already lists
`['Two-way ANOVA', 'Repeated Measures Two-way ANOVA', 'Mixed-effects ANOVA', 'ART ANOVA (Non-parametric)']`,
and the engine implements RM/mixed at the `Repeated Measures Two-way ANOVA` / `Mixed-effects ANOVA`
branches via `pg.rm_anova(...)` / `pg.mixed_anova(...)`. Three-way ANOVA lives under
`table_type == "MultipleVariables"` and is recommended only there.

**What's missing** is Prism's *questions* dialog (your screenshot) — the user shouldn't have to know
that "matched across a row" means RM.

Build a Grouped-table options dialog that asks, then **derives** the test:

1. **Matching by which factor(s)?** (two checkboxes)
   - "Each column represents a different time point, so matched values are spread across a row."
   - "Each row represents a different time point, so matched values are stacked into a subcolumn."

   | Column-matched | Row-matched | → test_id |
   |---|---|---|
   | ☐ | ☐ | `Two-way ANOVA` |
   | ☑ | ☐ | `Mixed-effects ANOVA` (within = column factor) |
   | ☐ | ☑ | `Mixed-effects ANOVA` (within = row factor) |
   | ☑ | ☑ | `Repeated Measures Two-way ANOVA` |

2. **Include interaction term?** → send `interaction: true|false`; formula drops `*` for `+`.
3. **Assume sphericity?** → `No, use Geisser-Greenhouse (recommended)` (default) / `Yes`.
   ⚠️ **Engine gap:** line ~1971 calls `pg.rm_anova(..., within=[factor1_col, 'Factor2'], subject='Subject')`
   with **no `correction=` argument**, while the one-way RM path uses `correction=True`. So GG is
   currently *not* applied for two-way RM. Wire `correction=ggCorrection` and report the ε-adjusted
   df exactly as FIX6 did for one-way — otherwise you reintroduce the "GG p against uncorrected df"
   bug we already fixed once.
4. Mirror Prism's yellow summary box: *"Based on your choices, StatLens will perform: …"*. It's the
   feature that makes the dialog teach rather than just configure.

**Three-way ANOVA under Grouped:** Prism reaches it from a Grouped table. Simplest correct route —
add `'Three-way ANOVA'` to the Grouped menu and, when chosen, reshape the Grouped sheet
(row factor + column factor + subcolumn factor) into the response-last long form the existing
`MultipleVariables` branch already consumes. **Reuse that branch — don't write a second
implementation.** Add a contract-matrix row proving Grouped-routed and MultipleVariables-routed
three-way ANOVA return identical F/p on the same numbers.

---

## E4 — About page (ships complete)

`AboutPage.tsx` is delivered as a finished file — **replace your current one wholesale.** It already
contains everything reported missing:

- ✅ Implemented features / 🔜 Coming soon (two-column card layout)
- ✅ Usage guide: all 8 table types, each with *when to use*, a worked example, main tests, post-hoc
- ✅ Chart types — available and coming soon
- ✅ Credits as **hyperlink buttons** (all 10, real URLs, `target="_blank"`, external-link icons)
- ✅ Prominent disclaimer `Alert`, wording verbatim
- ✅ MIT + source + issues buttons, "Created by Rohan Alag"
- ✅ Section anchor nav

Only wiring needed: `import { AboutPage } from '@/components/about/AboutPage'` and the
`/about` route. It uses `Card`, `Alert` and `lucide-react` — all already dependencies.

**Content is verified against the engine. Do not promote anything from 🔜 to ✅.** Excel export and
the Guided wizard are confirmed absent.

---

## E5 — UI overhaul (this failed twice — here's why)

The last two attempts said "make it modern" and produced nothing, because that isn't actionable.
**Do it in this order and stop after each step.**

### Step 1 — tokens only, no components
In `index.css`, define the vocabulary first. Nothing else changes this round:

```css
@layer base {
  :root {
    --radius: 0.625rem;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.04);
    --shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04);
    --shadow-lg: 0 12px 32px -8px rgb(0 0 0 / 0.12);
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --dur-fast: 120ms;
    --dur-base: 180ms;
  }
  .dark {
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
    --shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.4);
    --shadow-lg: 0 12px 32px -8px rgb(0 0 0 / 0.5);
  }
}

@layer utilities {
  @media (prefers-reduced-motion: no-preference) {
    .animate-in-up { animation: in-up var(--dur-base) var(--ease-out) both; }
    .press:active  { transform: scale(0.98); }
    .lift { transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out); }
    .lift:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  }
  @keyframes in-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
}
```

### Step 2 — apply to exactly three surfaces, then stop
Dashboard cards (`.lift`, staggered `.animate-in-up` via `animationDelay: i*30ms`), buttons
(`.press`), dialogs (animate Radix's `data-[state=open]`). **Report back before going further.**

### Step 3 — the Pyodide first-load
This is the app's worst moment: a multi-second silent wait. Give it a real progress state and
rotating hints. Highest-value single change here.

### Step 4 — density and rhythm
Tighten the type scale, unify spacing on a 4px grid, make the results table use tabular numerals
(`font-variant-numeric: tabular-nums`) — numbers that don't jitter between rows read as precise.

**Hard constraints:** animate only `transform`/`opacity`; ≤250 ms; everything non-essential behind
`prefers-reduced-motion`; **never animate the chart SVG** (it's the export node); don't regress
600-DPI PNG, AG Grid clipboard, or bracket layout.

---

## VERIFICATION

```bash
cd apps/web
python3 scratch/verify_fixes.py      # ALL CHECKS: PASS
python3 scratch/posthoc_matrix.py    # all permutations + determinism + replicates PASS
python3 scratch/verify_dunnett.py    # ALL CHECKS: PASS
python3 scratch/ui_contract.py       # PASS
npx tsc -p tsconfig.app.json --noEmit
```

Add a tails regression to `verify_fixes.py`:

```python
# Tails: one-tailed must equal scipy, and the EXACT MWU path must honour direction.
import scipy.stats as _ss
_A=[23.1,20.8,25.4,22.1,24.9,21.3,23.8]; _B=[28.4,30.1,27.9,31.2,29.5,26.8,30.7]
_ok = True
for _alt in ("two-sided","less","greater"):
    _r = call(SHEET_AB, {"testId": "Unpaired t test", "tails": _alt})
    _ok &= abs(_r["p_value"] - float(_ss.ttest_ind(_A,_B,alternative=_alt).pvalue)) < 1e-12
    _r = call(SHEET_AB, {"testId": "Mann-Whitney test", "tails": _alt})
    _ok &= abs(_r["p_value"] - float(_ss.mannwhitneyu(_A,_B,alternative=_alt,method="exact").pvalue)) < 1e-9
print("TAILS t + exact MWU  :", "PASS" if _ok else "FAIL"); ok &= _ok
```

## Order
1. **E6** (tested, engine) → suites green
2. **E4** (drop-in file) → quick win
3. **E1** (palettes) → quick win
4. **E5 Step 1–2** → stop and report
5. **E2** (survival) → needs the boolean→enum migration
6. **E3** (ANOVA dialog) → largest; includes the two-way GG gap
