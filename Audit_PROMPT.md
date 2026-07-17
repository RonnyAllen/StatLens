# TASK: Apply 7 verified bug fixes to StatLens (P0–P2)

You are making **surgical, pre-verified edits** to two files. Every FIND block below was copied
verbatim from the current source. Every REPLACE block has already been written and **tested against
independent scipy / statsmodels / pingouin references** — the numbers in "Expected result" are
measured, not predicted.

Your job is **mechanical application, not design**. Do not invent, improve, or re-derive anything.

---

## NON-NEGOTIABLE RULES — read before touching a file

1. **Do not modify any file other than these two:**
   - `apps/web/src/stats/analysis_engine.py`
   - `apps/web/src/components/workspace/AnalysisResultsView.tsx`
2. **If a FIND string does not match the file byte-for-byte: STOP.** Report which fix failed and
   paste the surrounding 10 lines. **Do not** "find something similar", do not fuzzy-match, do not
   re-implement the fix your own way. A failed match means the file drifted — I need to know.
3. **Occurrence counts are exact.** Where a fix says "2 occurrences", there are exactly 2 and
   **both** must be replaced. Where it says 1, there is exactly 1. If you find a different number,
   STOP and report.
4. **Do not reformat, re-indent, reorder imports, rename variables, or "clean up" adjacent code.**
   Indentation in these blocks is significant Python — preserve it exactly as written.
5. **Do not change any statistical formula** other than the ones specified here.
6. **Do not add dependencies.** Every symbol used below (`combinations`, `brentq`,
   `_patched_sr_sf_scalar`, `multipletests`, `stats.t`) already exists in the file or in an
   already-installed package.
7. **Do not remove the `psturng` import.** It is still used as a fallback inside
   `_patched_sr_sf_scalar`.
8. **Do not touch `TestOptionsDialog.tsx`.** It uses CRLF line endings and is out of scope.
9. **Additive JSON only.** You may ADD the keys listed (`ci_lower`, `ci_upper`, `error_detail`,
   `sphericity_epsilon`, `p_value_correction`). Do not rename or remove existing keys.
10. **Out of scope — do NOT build this:** a "compare to control" / Dunnett's test option.
    `control_vs_others` appears in **zero** TypeScript files today; adding it is a separate task.
    Do not add it, do not add a UI control for it, do not stub it.

Both target files use **LF (`\n`)** line endings. Keep them LF.

---

## FIX 1 (P0) — Games-Howell crashes with `NameError: itertools`

**Why:** line 8 does `from itertools import permutations, combinations`, so the bare module name
`itertools` is never bound. Two post-hoc loops call `itertools.combinations(...)` and raise
`NameError`. The outer handler then rewrites this into a message blaming the *user's data*, and the
already-computed F and p are discarded. Reachable from the UI whenever variances are unequal and a
group has ≥50 values (`TestOptionsDialog` sends `"Games-Howell test"` when `maxN >= 50`).

**File:** `apps/web/src/stats/analysis_engine.py`
**Occurrences: exactly 2** (currently ~line 541 in Welch's ANOVA, ~line 631 in Brown-Forsythe ANOVA).
The two lines are byte-identical — **replace both**.

FIND (×2):
```python
                        for g1, g2 in itertools.combinations(group_names, 2):
```
REPLACE (×2):
```python
                        for g1, g2 in combinations(group_names, 2):
```

> Note: the two-way ANOVA block (~line 1653) does `import itertools as _it` locally and is correct.
> **Leave it alone.**

**Expected result:** Welch's ANOVA + Games-Howell returns 3 comparisons instead of an error.
Verified p-values: `A-B 4.8968e-05`, `A-C 0.00145096`, `B-C 1.3460e-07` — an exact match to
`pingouin.pairwise_gameshowell` computed in a clean reference environment.

---

## FIX 2 (P1) — `studentized_range.ppf` is stubbed to `0.0`

**Why:** `_patched_sr_ppf` returns `0.0` unconditionally and is monkey-patched onto the **global**
`scipy.stats.studentized_range.ppf` for the whole Pyodide session. Any library that calls it gets a
critical value of 0 → every comparison becomes "significant". The `sf` patch next to it is
**accurate** (verified: `sf(3.77,3,12)=0.050182` vs true `0.050182`), so we invert it by
root-finding instead of guessing.

**File:** `apps/web/src/stats/analysis_engine.py` — **exactly 1 occurrence** (~line 61).

FIND:
```python
def _patched_sr_ppf(p, k, df):
    return 0.0
```
REPLACE:
```python
def _patched_sr_ppf(p, k, df):
    """Critical value q for the studentized range.

    scipy's native ppf relies on numerical integration that is unreliable in the
    Pyodide/WASM build, so we invert the (accurate) patched sf by root-finding.
    Verified exact to 5 decimals against scipy's CPython ppf.
    """
    from scipy.optimize import brentq
    try:
        p = float(p)
        if not (0.0 < p < 1.0) or k < 2 or df < 1:
            return float("nan")
        target = 1.0 - p
        f = lambda q: _patched_sr_sf_scalar(q, k, df) - target
        lo, hi = 1e-6, 100.0
        if f(lo) < 0.0:
            return float(lo)
        if f(hi) > 0.0:
            return float(hi)
        return float(brentq(f, lo, hi, xtol=1e-8))
    except Exception:
        try:
            from statsmodels.stats.libqsturng import qsturng
            return float(np.ravel(qsturng(p, k, df))[0])
        except Exception:
            return float("nan")
```

**Do not** delete the `scipy.stats.studentized_range.ppf = _patched_sr_ppf` line below it — the
patch must stay, it just needs to return the right number now.

**Expected result (measured):** `ppf(0.95, 3, 12)` → `3.77293` (was `0.0`; true value `3.77293`).
`ppf(0.99, 4, 20)` → `5.01802` (true `5.01802`). Error `0.00000` across all tested cases.

---

## FIX 3 (P1) — `psturng` silently clamps p-values to [0.001, 0.9]

**Why:** `statsmodels.libqsturng.psturng` is a lookup table that **cannot return p below 0.001**.
Measured: `psturng(20.0, 3, 12)` returns `0.001` when the true value is `2.1e-08`. This leaks
straight into user-facing reports — a two-way ANOVA with a mean difference of 64.5 and near-zero
variance currently prints **`p-adj = 0.001`** instead of `<0.0001`. The file already contains an
accurate studentized-range implementation (`_patched_sr_sf_scalar`), so use it.

**File:** `apps/web/src/stats/analysis_engine.py`. Three separate FIND/REPLACE pairs.

### 3a — Games-Howell (**exactly 2 occurrences**, ~lines 556 and 646, byte-identical — replace both)
FIND (×2):
```python
                            p_val = float(np.ravel(psturng(q, k_groups, df_welch))[0])
```
REPLACE (×2):
```python
                            p_val = float(_patched_sr_sf_scalar(q, k_groups, df_welch))
```

### 3b — Two-way ANOVA Tukey (**exactly 1 occurrence**, ~line 1674)
FIND:
```python
                                        p_adj = float(psturng(q, k, _res_df))
```
REPLACE:
```python
                                        p_adj = float(_patched_sr_sf_scalar(q, k, _res_df))
```

### 3c — Nested ANOVA Tukey (**exactly 1 occurrence**, ~line 2022)
FIND:
```python
                                p_val = float(np.ravel(psturng(q, len(treats), df_b))[0])
```
REPLACE:
```python
                                p_val = float(_patched_sr_sf_scalar(q, len(treats), df_b))
```

**Expected result (measured):** two-way ANOVA post-hoc row changes from
`| High | Low | 64.5000 | 0.001 | True |` to `| High | Low | 64.5000 | <0.0001 | True |`.

---

## FIX 4 + 5 (P1) — Tukey CIs are discarded; `specific_pairs` ignores the requested method

**Why, part 1 (CI):** the loop reads statsmodels' Tukey rows
`[group1, group2, meandiff, p-adj, lower, upper, reject]` but only takes indices 0–3. **The 95% CI
is already computed and thrown away.** Prism shows a CI for every comparison. Note the existing code
flips the sign of a negative mean difference — when it does, **the CI must flip and swap too**
(`lo, hi = -hi, -lo`), which the replacement handles.

**Why, part 2 (method):** when the user picks "specific pairs", the UI sends
`postHocTest = "Pairwise t-tests with Holm correction"` (or the Welch variant), but the engine runs
**Tukey** and merely filters the output. That is statistically wrong: Tukey's p-values are adjusted
for all *k(k−1)/2* comparisons, so filtering leaves them over-conservative — **and mislabeled**.
Prism adjusts across only the selected comparisons.

**File:** `apps/web/src/stats/analysis_engine.py` — **exactly 1 occurrence** (~lines 494–519, inside
`elif test_id == "Ordinary One-way ANOVA":`).

FIND:
```python
                if post_hoc_family != "none":
                    _vals, _labs = [], []
                    for g in group_names:
                        arr = df[g].dropna().values
                        _vals.extend(list(arr)); _labs.extend([g] * len(arr))
                    _mc = MultiComparison(np.array(_vals, dtype=float), np.array(_labs))
                    _res = _mc.tukeyhsd()
                    ph_results = []
                    # rows: [group1, group2, meandiff, p-adj, lower, upper, reject]
                    for row in _res._results_table.data[1:]:
                        g1, g2, meandiff, padj = row[0], row[1], float(row[2]), float(row[3])
                        if post_hoc_family == "specific_pairs":
                            is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                            if not is_in:
                                continue
                        if meandiff < 0:               # report a positive mean difference
                            meandiff = -meandiff; g1, g2 = g2, g1
                        ph_results.append({
                            "group1": col_id_to_name.get(g1, g1),
                            "group2": col_id_to_name.get(g2, g2),
                            "mean_diff": get_clean_float(meandiff),
                            "p_value": get_clean_float(padj),
                            "significant": bool(padj < 0.05),
                        })
                    result["post_hocs"] = {"method": "Tukey's HSD", "comparisons": ph_results}
                    report += "Post-hoc comparisons using Tukey's HSD test were conducted. "
```
REPLACE:
```python
                if post_hoc_family != "none":
                    _pht = str(post_hoc_test or "")
                    _use_pairwise = (post_hoc_family == "specific_pairs") and ("Pairwise" in _pht)
                    ph_results = []

                    if _use_pairwise:
                        # Prism: for a chosen subset of comparisons, run t tests and adjust
                        # (Holm) across ONLY the selected pairs. Filtering Tukey output is
                        # wrong: Tukey adjusts for all k(k-1)/2 comparisons.
                        _welch = "Welch" in _pht
                        _all_vals, _all_labs = [], []
                        for g in group_names:
                            arr = df[g].dropna().values
                            _all_vals.extend(list(arr)); _all_labs.extend([g] * len(arr))
                        _N = len(_all_vals); _k = len(group_names)
                        _mse = np.nan
                        if _N > _k:
                            _ss = 0.0
                            for g in group_names:
                                _a = df[g].dropna().values
                                if len(_a): _ss += float(((_a - _a.mean()) ** 2).sum())
                            _mse = _ss / (_N - _k)
                        _pairs_out, _p_raw = [], []
                        for g1, g2 in combinations(group_names, 2):
                            is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                            if not is_in:
                                continue
                            _a = df[g1].dropna().values; _b = df[g2].dropna().values
                            _n1, _n2 = len(_a), len(_b)
                            if _n1 < 2 or _n2 < 2: continue
                            _diff = float(_a.mean() - _b.mean())
                            if _welch:
                                _v1 = float(_a.var(ddof=1)); _v2 = float(_b.var(ddof=1))
                                _se = np.sqrt(_v1/_n1 + _v2/_n2)
                                _dfp = (_v1/_n1 + _v2/_n2) ** 2 / ((_v1/_n1) ** 2/(_n1-1) + (_v2/_n2) ** 2/(_n2-1))
                            else:
                                _se = np.sqrt(_mse * (1.0/_n1 + 1.0/_n2))
                                _dfp = float(_N - _k)
                            if not (_se > 0):
                                continue
                            _t = _diff / _se
                            _p = float(2.0 * stats.t.sf(abs(_t), _dfp))
                            _pairs_out.append((g1, g2, _diff))
                            _p_raw.append(_p)
                        if _p_raw:
                            if multipletests is not None:
                                _rej, _padj, _, _ = multipletests(_p_raw, alpha=0.05, method='holm')
                            else:
                                _m = len(_p_raw)
                                _padj = [min(1.0, p * _m) for p in _p_raw]
                                _rej = [p < 0.05 for p in _padj]
                            for _i, (g1, g2, _diff) in enumerate(_pairs_out):
                                _gg1, _gg2, _dd = g1, g2, _diff
                                if _dd < 0:
                                    _dd = -_dd; _gg1, _gg2 = _gg2, _gg1
                                ph_results.append({
                                    "group1": col_id_to_name.get(_gg1, _gg1),
                                    "group2": col_id_to_name.get(_gg2, _gg2),
                                    "mean_diff": get_clean_float(_dd),
                                    "p_value": get_clean_float(float(_padj[_i])),
                                    "ci_lower": None,
                                    "ci_upper": None,
                                    "significant": bool(_rej[_i]),
                                })
                        _method_name = ("Pairwise Welch t-tests (Holm-adjusted)" if _welch
                                        else "Pairwise t-tests, pooled SD (Holm-adjusted)")
                        result["post_hocs"] = {"method": _method_name, "comparisons": ph_results}
                        report += f"Post-hoc comparisons using {_method_name} were conducted across the selected pairs. "
                    else:
                        _vals, _labs = [], []
                        for g in group_names:
                            arr = df[g].dropna().values
                            _vals.extend(list(arr)); _labs.extend([g] * len(arr))
                        _mc = MultiComparison(np.array(_vals, dtype=float), np.array(_labs))
                        _res = _mc.tukeyhsd()
                        # rows: [group1, group2, meandiff, p-adj, lower, upper, reject]
                        for row in _res._results_table.data[1:]:
                            g1, g2, meandiff, padj = row[0], row[1], float(row[2]), float(row[3])
                            ci_lo, ci_hi = float(row[4]), float(row[5])
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in:
                                    continue
                            if meandiff < 0:               # report a positive mean difference
                                meandiff = -meandiff; g1, g2 = g2, g1
                                ci_lo, ci_hi = -ci_hi, -ci_lo   # CI must flip with the sign
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "mean_diff": get_clean_float(meandiff),
                                "p_value": get_clean_float(padj),
                                "ci_lower": get_clean_float(ci_lo),
                                "ci_upper": get_clean_float(ci_hi),
                                "significant": bool(padj < 0.05),
                            })
                        result["post_hocs"] = {"method": "Tukey's HSD", "comparisons": ph_results}
                        report += "Post-hoc comparisons using Tukey's HSD test were conducted. "
```

**Expected result (measured):**
- Tukey now returns CIs matching statsmodels exactly: `A vs B: diff=6.1714, CI=[4.133, 8.210]`;
  `C vs A: diff=3.8857, CI=[1.847, 5.925]` (correctly sign-flipped from statsmodels' `A-C =
  -3.8857, CI=[-5.925,-1.847]`).
- `specific_pairs` + `"Pairwise t-tests with Holm correction"` on pair (A,B) now reports method
  `"Pairwise t-tests, pooled SD (Holm-adjusted)"` with `p = 4.0168e-07`, matching a hand-computed
  pooled-MSE t-test (`t=-7.7252, df=18`). It previously reported `"Tukey's HSD"`.
- `ci_lower`/`ci_upper` are intentionally `None` for the Holm path: Holm is sequential and Prism
  does not report CIs for it either.

---

## FIX 6 (P2) — RM-ANOVA reports a GG-corrected p against uncorrected df

**Why:** the p-value lookup prefers `p_GG_corr` (correct, Prism's default), but the df string falls
through to the uncorrected `k-1, (n-1)(k-1)`. pingouin returns a single `DF` column and **no
`ddof2`**, so `df2_col` is always `None` and the fallback always fires. Result: the report reads
`F(2,6)=288.0, p=0.0004` — but p=0.0004 does not correspond to F(2,6) (that would be ~1e-6). With
ε=0.5 the correct df is (1.000, 3.000).

**File:** `apps/web/src/stats/analysis_engine.py` — **exactly 1 occurrence** (~lines 696–706).

FIND:
```python
                # Compute degrees of freedom robustly: try multiple possible column names
                df1_col = next((c for c in ['ddof1', 'DF1', 'df1', 'DF', 'df'] if c in res.columns), None)
                df2_col = next((c for c in ['ddof2', 'DF2', 'df2'] if c in res.columns), None)
                if df1_col and df2_col:
                    result["degrees_of_freedom"] = f"{get_clean_float(res[df1_col].values[0]):.0f}, {get_clean_float(res[df2_col].values[0]):.0f}"
                else:
                    # Compute from data: df1 = k-1, df2 = (n-1)*(k-1) where k = groups, n = subjects
                    k = len(group_names)
                    n = len(df_clean)
                    result["degrees_of_freedom"] = f"{k-1}, {(n-1)*(k-1)}"
```
REPLACE:
```python
                # Degrees of freedom. If we surfaced a Greenhouse-Geisser corrected p we MUST
                # also report GG-corrected df, otherwise F(df1,df2) and p disagree.
                _k = len(group_names)
                _n = len(df_clean)
                _df1 = float(_k - 1)
                _df2 = float((_n - 1) * (_k - 1))
                _used_gg = str(p_col) in ('p_GG_corr', 'p-GG-corr')
                _eps_col = next((c for c in ['eps', 'Eps', 'epsilon'] if c in res.columns), None)
                _eps = 1.0
                if _eps_col is not None:
                    try:
                        _e = get_clean_float(res[_eps_col].values[0])
                        if _e is not None and _e > 0: _eps = float(_e)
                    except Exception:
                        _eps = 1.0
                if _used_gg and _eps_col is not None:
                    result["degrees_of_freedom"] = f"{_df1 * _eps:.3f}, {_df2 * _eps:.3f}"
                    result["sphericity_epsilon"] = _eps
                    result["p_value_correction"] = "Greenhouse-Geisser"
                else:
                    result["degrees_of_freedom"] = f"{_df1:.0f}, {_df2:.0f}"
```

**Expected result (measured):** `F(2, 6) = 288.0, p = 0.000446` → `F(1.000, 3.000) = 288.0,
p = 0.000446`, with `sphericity_epsilon = 0.5` and `p_value_correction = "Greenhouse-Geisser"`.

---

## FIX 7 (P2) — engine bugs are reported to the user as data problems

**Why:** the catch-all rewrites *every* exception into "Check your data for missing values, zero
variance, or insufficient sample sizes." That is how FIX 1 stayed hidden. A `NameError` is never the
user's fault.

**File:** `apps/web/src/stats/analysis_engine.py` — **exactly 1 occurrence** (~line 2653).

FIND:
```python
    except Exception as e:
        _msg = str(e)
        if "NoneType" in _msg and "not supported" in _msg:
```
REPLACE:
```python
    except Exception as e:
        _msg = str(e)
        _etype = type(e).__name__
        import traceback as _tb
        result["error_detail"] = _tb.format_exc()
        if _etype in ("NameError", "AttributeError", "ImportError", "ModuleNotFoundError", "SyntaxError", "UnboundLocalError"):
            # These are ALWAYS engine bugs. Never blame the user's data for them.
            result["error"] = f"Internal engine error ({_etype}): {_msg}. This is a bug in StatLens, not a problem with your data."
            result["status"] = "error"
            return result
        if "NoneType" in _msg and "not supported" in _msg:
```

Keep every branch that follows unchanged.

**Expected result (measured):** an injected `NameError` now yields
`"Internal engine error (NameError): name 'bogus' is not defined. This is a bug in StatLens, not a
problem with your data."` plus a full traceback in `error_detail`.

---

## FIX 4-UI — render the confidence interval column

**File:** `apps/web/src/components/workspace/AnalysisResultsView.tsx` (LF line endings).
Three small edits, **1 occurrence each**.

### (a) Table header — add a CI column between "Mean Diff" and "Adjusted P Value"
FIND:
```tsx
                        <th className="px-4 py-2 font-medium text-right">Mean Diff</th>
                        <th className="px-4 py-2 font-medium text-right">Adjusted P Value</th>
```
REPLACE:
```tsx
                        <th className="px-4 py-2 font-medium text-right">Mean Diff</th>
                        <th className="px-4 py-2 font-medium text-right">95% CI of Diff</th>
                        <th className="px-4 py-2 font-medium text-right">Adjusted P Value</th>
```

### (b) Table body — add the matching cell
FIND:
```tsx
                          <td className="px-4 py-2 text-right">{comp.mean_diff !== undefined ? comp.mean_diff?.toFixed(4) : "-"}</td>
                          <td className="px-4 py-2 text-right">{comp.p_value < 0.0001 ? "< 0.0001" : comp.p_value?.toFixed(4)}</td>
```
REPLACE:
```tsx
                          <td className="px-4 py-2 text-right">{comp.mean_diff !== undefined ? comp.mean_diff?.toFixed(4) : "-"}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{comp.ci_lower != null && comp.ci_upper != null ? `${comp.ci_lower.toFixed(4)} to ${comp.ci_upper.toFixed(4)}` : "—"}</td>
                          <td className="px-4 py-2 text-right">{comp.p_value < 0.0001 ? "< 0.0001" : comp.p_value?.toFixed(4)}</td>
```

### (c) Empty-state colSpan 4 → 5
FIND:
```tsx
                          <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
```
REPLACE:
```tsx
                          <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
```

The `—` fallback is required: the Holm path returns `ci_lower: null` by design.

---

## VERIFICATION — run this and paste the full output back

Do not report success until this passes. Create `apps/web/scratch/verify_fixes.py`:

```python
import re, io, contextlib, numpy as np
P = "apps/web/src/stats/analysis_engine.py"          # adjust path if run from elsewhere
src = re.sub(r"\n\s*run\(\)\s*$", "\n", open(P).read())
NS = {"__name__": "eng"}; exec(compile(src, P, "exec"), NS)

def call(sheet, options):
    NS["sheet_data"] = sheet; NS["options"] = options; NS["post_progress"] = lambda *a: None
    with contextlib.redirect_stdout(io.StringIO()):
        return NS["run"]()

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

A = [23.1,20.8,25.4,22.1,24.9,21.3,23.8]
B = [28.4,30.1,27.9,31.2,29.5,26.8,30.7]
C = [19.2,18.5,20.1,17.8,19.9,18.2,20.5]
ok = True

# FIX 1
r = call(col({"A":A,"B":B,"C":C}), {"testId":"Welch's ANOVA","postHocFamily":"all_pairwise","postHocTest":"Games-Howell test"})
ps = sorted(c["p_value"] for c in (r.get("post_hocs") or {}).get("comparisons", []))
t1 = r.get("error") is None and len(ps) == 3 and abs(ps[0]-1.3460307e-07) < 1e-9 and abs(ps[2]-0.001450962) < 1e-6
print("FIX1 Games-Howell      :", "PASS" if t1 else f"FAIL err={r.get('error')} ps={ps}"); ok &= t1

# FIX 2
v = NS["scipy"].stats.studentized_range.ppf(0.95, 3, 12)
t2 = abs(v - 3.77293) < 1e-3
print("FIX2 sr.ppf            :", "PASS" if t2 else f"FAIL ppf(0.95,3,12)={v} expected 3.77293"); ok &= t2

# FIX 4 (CI present + correct)
r = call(col({"A":A,"B":B,"C":C}), {"testId":"Ordinary One-way ANOVA","postHocFamily":"all_pairwise","postHocTest":"Tukey's HSD"})
cs = {(c["group1"], c["group2"]): c for c in (r.get("post_hocs") or {}).get("comparisons", [])}
ab = cs.get(("A","B"))
t4 = ab is not None and abs(ab["ci_lower"]-4.133) < 0.01 and abs(ab["ci_upper"]-8.210) < 0.01
print("FIX4 Tukey CI          :", "PASS" if t4 else f"FAIL {ab}"); ok &= t4

# FIX 5 (specific_pairs honors method)
r = call(col({"A":A,"B":B,"C":C}), {"testId":"Ordinary One-way ANOVA","postHocFamily":"specific_pairs",
      "postHocTest":"Pairwise t-tests with Holm correction","specificPairs":[["c0","c1"]]})
m = (r.get("post_hocs") or {}).get("method"); comps = (r.get("post_hocs") or {}).get("comparisons", [])
t5 = m == "Pairwise t-tests, pooled SD (Holm-adjusted)" and len(comps) == 1 and abs(comps[0]["p_value"]-4.0167574e-07) < 1e-10
print("FIX5 specific_pairs    :", "PASS" if t5 else f"FAIL method={m} comps={comps}"); ok &= t5

# FIX 6 (GG df)
r = call(col({"Cond1":[10,12,9,11],"Cond2":[14,15,13,16],"Cond3":[18,19,17,20]}), {"testId":"Repeated Measures ANOVA"})
t6 = r.get("degrees_of_freedom") == "1.000, 3.000" and abs(r.get("sphericity_epsilon",0)-0.5) < 1e-6
print("FIX6 RM GG df          :", "PASS" if t6 else f"FAIL df={r.get('degrees_of_freedom')} eps={r.get('sphericity_epsilon')}"); ok &= t6

# REGRESSION — these must not move
import scipy.stats as ss
reg = [("Unpaired t test", {"testId":"Unpaired t test"}, col({"A":A,"B":B}), float(ss.ttest_ind(A,B).pvalue)),
       ("Ordinary One-way ANOVA", {"testId":"Ordinary One-way ANOVA","postHocFamily":"none"}, col({"A":A,"B":B,"C":C}), float(ss.f_oneway(A,B,C).pvalue)),
       ("Kruskal-Wallis test", {"testId":"Kruskal-Wallis test","postHocFamily":"none"}, col({"A":A,"B":B,"C":C}), float(ss.kruskal(A,B,C).pvalue))]
for name, o, sh, ref in reg:
    r = call(sh, o); got = r.get("p_value")
    good = got is not None and abs(got - ref) < 1e-9
    print(f"REG  {name:22s}:", "PASS" if good else f"FAIL got={got} ref={ref}"); ok &= good

print("\nALL CHECKS:", "PASS" if ok else "FAIL")
```

Run:
```bash
cd apps/web && python3 scratch/verify_fixes.py
```

Then confirm the frontend still compiles:
```bash
cd apps/web && npx tsc -p tsconfig.app.json --noEmit
```
(Expected: exit code 0, no output. It passes cleanly today — if you introduce errors, fix *your*
edit, don't touch unrelated files.)

---

## ACCEPTANCE CHECKLIST — report each line explicitly

- [ ] FIX 1 applied to **both** occurrences; zero `itertools.` references remain
      (`grep -c "itertools\." analysis_engine.py` → **0**)
- [ ] FIX 2 applied; `studentized_range.ppf = _patched_sr_ppf` line still present
- [ ] FIX 3a (×2), 3b (×1), 3c (×1) applied; `psturng` still imported and still used inside
      `_patched_sr_sf_scalar`'s fallback (`grep -c "psturng" analysis_engine.py` → **3**)
- [ ] FIX 4+5 applied; Tukey branch returns `ci_lower`/`ci_upper`; Holm branch returns `None`
- [ ] FIX 6 applied
- [ ] FIX 7 applied; all downstream `elif` branches intact
- [ ] FIX 4-UI (a), (b), (c) applied
- [ ] `verify_fixes.py` prints **ALL CHECKS: PASS**
- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0
- [ ] `git diff --stat` shows **exactly 2 files changed** (plus the new scratch/verify_fixes.py)

If any box cannot be ticked, **stop and report** — do not paper over it, do not delete the check,
and do not weaken the assertions in `verify_fixes.py` to make it pass. The thresholds encode
independently verified reference values.

---

## FINAL ANTI-DRIFT STEP

After applying, print the output of:
```bash
git diff --stat
grep -n "itertools\." apps/web/src/stats/analysis_engine.py || echo "OK: no itertools. refs"
grep -n "return 0.0" apps/web/src/stats/analysis_engine.py || echo "OK: ppf stub gone"
```
These fixes have been overwritten by regeneration before. **Do not regenerate either file from
scratch. Do not "rewrite for clarity". Edit in place, only at the sites listed above.**
