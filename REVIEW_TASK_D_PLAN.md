# Review of Antigravity's Task D plan — approve with 4 corrections

Verdict: **the plan is sound and mostly well-adapted.** Antigravity caught a real error in my prompt.
But there are two factual problems, one dangerous gap in my own D3 spec, and a verification step that
provides false comfort. Details and fixes below — hand this back with the plan.

---

## ✅ APPROVED — the TopBar adaptation is correct (it caught my mistake)

Antigravity's Open Question: *"the prompt assumes TopBar.tsx exists, but the top bar is embedded in
App.tsx."*

**Verified — approve the adaptation, with one nuance.** `components/layout/TopBar.tsx` *does* exist
(1,526 bytes), but `grep` across every `.tsx` shows it is **imported nowhere** — it is dead code. The
live header is `App.tsx:90` (`<header className="border-b px-6 py-3 …">`).

So my instruction to edit `TopBar.tsx` would have produced an About link that never renders.
**Edit `App.tsx` as proposed.**

**Additional request:** delete `components/layout/TopBar.tsx` in this task. Leaving a dead component
that looks exactly like the real nav is a trap that already cost one round — the next person (or
agent) will edit it again.

---

## 🔴 CORRECTION 1 — `ChartBase.tsx` does not exist (hallucinated path)

The plan lists `[MODIFY] src/components/charts/ChartBase.tsx`.

**Verified: `src/components/charts/` does not exist, and there is no `ChartBase` file anywhere in the
repo.** The real chart directory is `src/charts/` containing `BaseChartLayout.tsx`,
`ColumnCharts.tsx`, `GraphEngine.tsx`, `HorizontalCategoryChart.tsx`, `SignificanceLayer.tsx`,
`SurvivalChart.tsx`, `XYCharts.tsx`.

This matters beyond the filename. The requirement is that the caption appears **in the exported
PNG/SVG**, and:

- `charts/GraphEngine.tsx:61` owns the exported node: `<svg ref={svgRef} width={width} height={height}>`
- `lib/exportGraph.ts:21` exports **only that node**: `svgNode.cloneNode(true)`

**Therefore the caption must be an SVG `<text>` element rendered *inside* that `<svg>` in
`GraphEngine.tsx`.** If it is rendered as HTML underneath the chart it will look correct on screen
and be **silently missing from every export** — which is the entire point of D4.

Target: `src/charts/GraphEngine.tsx`. Not `ChartBase.tsx`.

---

## 🔴 CORRECTION 2 — my D3 method table is unsafe. Use this one instead.

This is my error, found by executing the Task C engine. The engine's method support is
**per-test-branch**, but my D3 table keyed the options by *family + variance*. Measured, before
hardening:

| Asked | On test | Actually returned |
|---|---|---|
| `Dunnett's T3 test` | Ordinary One-way ANOVA | **Tukey's HSD** ← silent substitution |
| `Games-Howell test` | Ordinary One-way ANOVA | **Tukey's HSD** ← silent substitution |
| `Dunnett's multiple comparisons test` (all_pairwise) | Ordinary One-way ANOVA | **Tukey's HSD** ← silent substitution |
| `Bonferroni` | Welch's ANOVA | **None** (no post-hoc table at all) |

That is the exact bug class this project has spent four rounds eliminating, reintroduced by my own
spec. Two things must change:

### (a) Engine hardening — apply this to `analysis_engine.py` **before** wiring the selector

My Task C resolver ends in `else: _mc_method = "tukey"` — a silent-substitution fallback sitting
directly under a rule that says "never silently substitute". Fix it.

**Guard 1 — Ordinary One-way ANOVA resolver. Exactly 1 occurrence.**
The file stores the Šídák test as literal escape text; match it exactly as written here.

FIND:
```python
                    elif "\u0161\u00edd\u00e1k" in _phl or "sidak" in _phl:
                        _mc_method = "sidak"
                    else:
                        _mc_method = "tukey"
```
REPLACE:
```python
                    elif "\u0161\u00edd\u00e1k" in _phl or "sidak" in _phl:
                        _mc_method = "sidak"
                    elif "games-howell" in _phl or "t3" in _phl:
                        # These exist only on the unequal-variance branches. Falling through to
                        # Tukey here would be a silent wrong-test substitution.
                        raise ValueError(
                            f"'{_pht}' is not available for {test_id}. Games-Howell and Dunnett's T3 "
                            "require Welch's or Brown-Forsythe ANOVA (unequal variances). "
                            "Refusing to substitute Tukey's HSD."
                        )
                    elif "dunnett" in _phl and post_hoc_family != "control_vs_others":
                        # Dunnett is valid ONLY via the compare-to-control family, which is
                        # handled below. Asking for it with any other family must not quietly
                        # return Tukey.
                        raise ValueError(
                            f"'{_pht}' requires the 'compare each group to a control' option. "
                            "Refusing to substitute Tukey's HSD."
                        )
                    else:
                        _mc_method = "tukey"
```

> The `and post_hoc_family != "control_vs_others"` clause is load-bearing. Without it the guard fires
> on the *valid* Dunnett path and kills the feature — I made exactly that mistake and caught it by
> testing.

**Guard 2 — Welch's ANOVA + Brown-Forsythe. Exactly 2 occurrences (identical text). Replace both.**

FIND (×2):
```python
                if post_hoc_family != "none":
                    if post_hoc_test == "Games-Howell test":
```
REPLACE (×2):
```python
                if post_hoc_family != "none":
                    _pht_r = str(post_hoc_test or "")
                    if _pht_r not in ("Games-Howell test", "Dunnett's T3 test", "None", ""):
                        # This branch implements only Games-Howell and Dunnett's T3. Anything else
                        # would silently produce no post-hoc table at all.
                        raise ValueError(
                            f"'{_pht_r}' is not available for {test_id}. Unequal-variance ANOVA "
                            "supports Games-Howell or Dunnett's T3. Refusing to return a different "
                            "test or an empty table."
                        )
                    if post_hoc_test == "Games-Howell test":
```

**Measured after hardening:** all four bad combos above return `REFUSED`; all valid combos are
unaffected (Tukey → Tukey's HSD; Bonferroni → pooled-SD Bonferroni; control_vs_others + Dunnett →
Dunnett's multiple comparisons test; Welch + Games-Howell → Games-Howell; Welch + T3 → Dunnett's T3).
All three suites still exit 0.

### (b) Key the UI list by **testId**, not by variance

Replace the D3 table with this. `recommendedTestId` is already a prop of `TestOptionsDialog`.

| `recommendedTestId` | Family | Allowed methods |
|---|---|---|
| Ordinary One-way ANOVA | `all_pairwise` | `Tukey's HSD` *(recommended)*, `Bonferroni`, `Šídák`, `Holm-Šídák` |
| Ordinary One-way ANOVA | `specific_pairs` | `Pairwise t-tests with Holm correction` *(rec)*, `Bonferroni`, `Šídák`, `Holm-Šídák` |
| Ordinary One-way ANOVA | `control_vs_others` | `Dunnett's multiple comparisons test` *(only option)* |
| Welch's ANOVA / Brown-Forsythe | `all_pairwise` | `Dunnett's T3 test` *(rec if maxN<50)*, `Games-Howell test` |
| Welch's ANOVA / Brown-Forsythe | `control_vs_others` | `Dunnett's T3 test` *(only option)* |
| Kruskal-Wallis / Friedman | any | `Dunn's test` *(only option)* |
| Survival tests | any | `Pairwise Logrank with Holm correction` *(only option)* |

If a combination isn't listed, show the recommended method with the selector **disabled** — never
offer a method the engine will refuse.

---

## 🔴 CORRECTION 3 — the verification plan gives false comfort

The plan says: *"Run `python3 scratch/posthoc_matrix.py` to ensure the post-hoc method selector
integration doesn't break engine contracts."*

**It cannot do that.** `posthoc_matrix.py` reads `src/stats/analysis_engine.py` and calls `run()`
directly. It never opens `TestOptionsDialog.tsx`. A UI that offers a method string the engine
refuses would leave the matrix at a happy 18/18. Running it is still worth doing (it proves you
didn't break the engine), but it is **not** evidence the selector is wired correctly.

**Add a real boundary test** — `apps/web/scratch/ui_contract.py`. This is the check that would have
caught Correction 2 automatically:

```python
"""UI <-> engine contract: every post-hoc method the UI can offer must be honoured
by the engine for the test it is offered on. Golden values check numbers; the contract
matrix checks the engine; NOTHING today checks the UI/engine string boundary.
Run from apps/web:  python3 scratch/ui_contract.py
"""
import re, io, contextlib, sys

TSX = "src/components/workspace/TestOptionsDialog.tsx"
ENGINE = "src/stats/analysis_engine.py"

# Every quoted method string the dialog can send.
ui_text = open(TSX, encoding="utf-8").read()
ui_methods = set(re.findall(r'"([^"]*(?:Tukey|Dunnett|Games-Howell|Dunn\'s|Bonferroni|\u0160\u00edd\u00e1k|Holm|Pairwise)[^"]*)"', ui_text))
ui_methods = {m for m in ui_methods if len(m) > 3}

src = re.sub(r"\n\s*run\(\)\s*$", "\n", open(ENGINE).read())
NS = {"__name__": "eng"}; exec(compile(src, ENGINE, "exec"), NS)

def call(sheet, options):
    NS["sheet_data"] = sheet; NS["options"] = options; NS["post_progress"] = lambda *a: None
    with contextlib.redirect_stdout(io.StringIO()):
        try: return NS["run"]()
        except Exception as e: return {"error": f"{type(e).__name__}: {e}"}

def col(d):
    cg = [{"id": f"c{i}", "name": n} for i, n in enumerate(d)]
    idb = {g["name"]: g["id"] for g in cg}
    L = max(len(v) for v in d.values()); data = []
    for r in range(L):
        row = {}
        for n, v in d.items():
            if r < len(v): row[idb[n]] = v[r]
        data.append(row)
    return {"type": "Column", "config": {}, "columnGroups": cg, "data": data}

A=[23.1,20.8,25.4,22.1,24.9,21.3,23.8]; B=[28.4,30.1,27.9,31.2,29.5,26.8,30.7]; C=[19.2,18.5,20.1,17.8,19.9,18.2,20.5]
SHEET = col({"Control": A, "DrugA": B, "DrugB": C})

# The (test, family) contexts the UI can actually produce for each method.
ALLOWED = {
    "Tukey's HSD":                          [("Ordinary One-way ANOVA", "all_pairwise")],
    "Bonferroni":                           [("Ordinary One-way ANOVA", "all_pairwise"), ("Ordinary One-way ANOVA", "specific_pairs")],
    "\u0160\u00edd\u00e1k":                 [("Ordinary One-way ANOVA", "all_pairwise")],
    "Holm-\u0160\u00edd\u00e1k":            [("Ordinary One-way ANOVA", "all_pairwise")],
    "Pairwise t-tests with Holm correction":[("Ordinary One-way ANOVA", "specific_pairs")],
    "Dunnett's multiple comparisons test":  [("Ordinary One-way ANOVA", "control_vs_others")],
    "Games-Howell test":                    [("Welch's ANOVA", "all_pairwise")],
    "Dunnett's T3 test":                    [("Welch's ANOVA", "all_pairwise"), ("Welch's ANOVA", "control_vs_others")],
    "Dunn's test":                          [("Kruskal-Wallis test", "all_pairwise"), ("Kruskal-Wallis test", "control_vs_others")],
}

fails = 0
print("UI method strings found in TestOptionsDialog.tsx:", len(ui_methods))
for m in sorted(ui_methods):
    ctxs = ALLOWED.get(m)
    if ctxs is None:
        print(f"  UNKNOWN  {m!r} -> not in ALLOWED; either the UI gained a method the engine "
              f"was never taught, or this table is stale"); fails += 1; continue
    for test, fam in ctxs:
        r = call(SHEET, {"testId": test, "postHocFamily": fam, "postHocTest": m,
                         "specificPairs": [["c0", "c1"]], "controlGroup": "c0"})
        got = (r.get("post_hocs") or {}).get("method")
        if r.get("error") or not got:
            print(f"  FAIL     {m!r} on {test}/{fam} -> {r.get('error') or 'no post_hocs'}"); fails += 1
        else:
            key = m.split("'")[0].split()[0].lower()
            if key not in str(got).lower():
                print(f"  MISMATCH {m!r} on {test}/{fam} -> engine returned {got!r}"); fails += 1
            else:
                print(f"  ok       {m!r} on {test}/{fam} -> {got}")
print("\nUI CONTRACT:", "PASS" if not fails else f"FAIL ({fails})")
sys.exit(1 if fails else 0)
```

Add it to `.github/workflows/stats-tests.yml` as a step after the contract matrix.

---

## ⚠️ CORRECTION 4 — small gaps in the plan

1. **`methodOverride` must reset when `postHocFamily` changes** (D3 item 5). The plan doesn't mention
   it. Without the reset, picking `Bonferroni` under `all_pairwise` and then switching to
   `control_vs_others` sends `Bonferroni` on the Dunnett path — which now (correctly) raises.
2. **Export non-regression is unlisted.** D2 says don't regress the 600-DPI PNG path. Add an explicit
   manual check: export a PNG, confirm it still opens at 600 DPI with fonts embedded, *and* that the
   new caption is present.
3. **`AnalysisResultsView.tsx` already renders the CI column** (`95% CI of Diff`) from earlier work.
   When restyling that table, keep the `ci_lower != null` em-dash fallback — the Holm/Holm-Šídák
   paths legitimately return `null` CIs.
4. **Don't promote 🔜 → ✅.** The plan says it will implement §3/§4 "as specified" — good. Excel export
   and the Guided wizard are confirmed **absent**; they stay under "Coming soon".

---

## Suggested order

1. Engine hardening (Correction 2a) → re-run all three suites.
2. `ui_contract.py` (Correction 3) → it should pass *before* D3, then keep passing after.
3. D1 About page (App.tsx, per the approved adaptation; delete dead `TopBar.tsx`).
4. D3 selector using the testId-keyed table (Correction 2b).
5. D4 caption inside `GraphEngine.tsx`'s `<svg>` (Correction 1).
6. D2 visual/motion pass last — it touches the most surface and is the easiest to redo.

## Final acceptance
- [ ] All three existing suites exit 0, plus `ui_contract.py` exits 0
- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0
- [ ] Exported PNG contains the caption and is still 600 DPI
- [ ] Selector offers no method the engine refuses (proven by `ui_contract.py`, not by inspection)
- [ ] Dead `TopBar.tsx` removed
