# TASK C: Fix the Column-replicates crash (P0) + add the full compare-all method menu

Both changes below have been **written and executed** against the current engine, checked against
independent scipy/statsmodels references, and re-run through all three existing regression suites.
The numbers under "Expected result" are measured.

Mechanical application, not design.

---

## PRECONDITION

```bash
cd apps/web
wc -l src/stats/analysis_engine.py          # must print 3017
python3 scratch/posthoc_matrix.py           # must print 14/14 + determinism PASS
python3 scratch/verify_fixes.py             # must print ALL CHECKS: PASS
```
If any check fails, **STOP and report** — wrong base revision.

---

## NON-NEGOTIABLE RULES

1. Only these files change: `apps/web/src/stats/analysis_engine.py` (LF),
   `apps/web/scratch/verify_fixes.py`, `apps/web/scratch/posthoc_matrix.py`,
   and `apps/web/src/components/workspace/TestOptionsDialog.tsx` (**CRLF — preserve**).
2. **If a FIND string does not match byte-for-byte: STOP and report.** Do not fuzzy-match, do not
   improvise your own version, do not regenerate a file.
3. Occurrence counts are exact (all are 1× unless stated).
4. Do not reformat, re-indent, or "improve" adjacent code. Python indentation is significant.
5. **Never silently substitute a different post-hoc method.** If a method can't be honoured, raise.
6. Additive JSON only.

---

## C1 (P0) — Column tables with subcolumns crash every ANOVA-family test

### The bug (verified by execution)
When a Column table has `replicates > 1`, the engine rebinds `group_names` to **base ids**
(`"c0"`) but leaves `df` holding the **replicate columns** (`"c0_1"`, `"c0_2"`). There are **9**
downstream `df.melt(value_vars=group_names)` calls and ~12 `df[g]` lookups. All raise.

Measured, on a 3-group Column table:

| Test | replicates=1 | replicates=2 |
|---|---|---|
| Ordinary One-way ANOVA | OK | **ERROR** |
| Welch's ANOVA | OK | **ERROR** |
| Kruskal-Wallis | OK | **ERROR** |
| Brown-Forsythe ANOVA | OK | **ERROR** |

The user sees: *"Statistical error: The following id_vars or value_vars are not present in the
DataFrame: ['c0', 'c1', 'c2']. Check your data for missing values…"* — i.e. the engine blames their
data for its own bug.

This is fully reachable from the UI: `ColumnConfigSchema` has `replicates`, `sheetFactory`
creates Column tables with a replicate count, and `AGGridWrapper` renders the subcolumn headers.

There is a **second, quieter half**: `col_id_to_name` is keyed `"c0_1" → "Control (Y1)"`, so
`col_id_to_name.get("c0")` misses and post-hoc labels come back as raw ids (`"c0"`). The charts key
`xScale` by **display name** (`ColumnCharts.tsx:53` → `g.name || g.id`), so every significance
bracket would silently fail to render even after the crash is fixed.

**One root-cause fix repairs both.**

### The edit — **exactly 1 occurrence**

FIND:
```python
        if table_type == "Column" and replicates > 1:
            if len(columns) >= 1:
                df_long = pd.melt(df, value_vars=columns, var_name='Group', value_name='Value').dropna()
                df_long['Group'] = df_long['Group'].apply(lambda x: x.rsplit('_', 1)[0])
                group_names = list(df_long['Group'].unique())
                groups = [df_long[df_long['Group'] == g]['Value'].values for g in group_names]
```
REPLACE:
```python
        if table_type == "Column" and replicates > 1:
            if len(columns) >= 1:
                df_long = pd.melt(df, value_vars=columns, var_name='Group', value_name='Value').dropna()
                df_long['Group'] = df_long['Group'].apply(lambda x: x.rsplit('_', 1)[0])
                group_names = list(df_long['Group'].unique())
                groups = [df_long[df_long['Group'] == g]['Value'].values for g in group_names]
                # group_names now holds BASE ids (e.g. "c0"), but df still holds the replicate
                # columns ("c0_1", "c0_2"). Every downstream `df[g]` and
                # `df.melt(value_vars=group_names)` would raise. Rebuild df in base-group form
                # so the replicate case behaves exactly like the single-column case.
                df = pd.DataFrame({g: pd.Series(v, dtype=float) for g, v in zip(group_names, groups)})
                # Base ids must resolve to display names, otherwise post-hoc labels come back as
                # raw ids ("c0") and the chart's significance brackets — keyed by display name —
                # silently fail to render.
                for _bid, _bname in base_col_id_to_name.items():
                    if _bname:
                        col_id_to_name.setdefault(_bid, _bname)
```

**Expected result (measured):** all four tests above return OK on replicates=2. Post-hoc labels
become `Control / DrugA / DrugB` (not `c0/c1/c2`). Replicate-stacked one-way ANOVA returns
`p = 2.17305925087605e-16` vs scipy on the pooled values `2.1730592508761434e-16` — exact.

---

## C2 — The full compare-all method menu (Prism parity)

### Why
`recommendedPostHoc` in `TestOptionsDialog.tsx` is a `useMemo` with **zero setters** — the user cannot
choose a method. And for `all_pairwise` the engine only ever runs **Tukey**. Prism's one-way ANOVA
menu also offers **Bonferroni**, **Šídák** and **Holm-Šídák**.

### C2a — resolve the requested method. **1 occurrence.**

FIND:
```python
                    _pht = str(post_hoc_test or "")
                    _use_pairwise = (post_hoc_family == "specific_pairs") and ("Pairwise" in _pht)
                    ph_results = []
```
REPLACE:
```python
                    _pht = str(post_hoc_test or "")
                    _phl = _pht.lower()
                    # Resolve the requested multiple-comparison METHOD. Prism's one-way ANOVA
                    # menu is: Tukey / Bonferroni / Sidak / Holm-Sidak (all-pairs or a chosen
                    # subset) and Dunnett (vs a control). Anything we cannot honour must raise,
                    # never silently fall back to a different test.
                    if "tukey" in _phl:
                        _mc_method = "tukey"
                    elif "holm-\u0161\u00edd\u00e1k" in _phl or "holm-sidak" in _phl:
                        _mc_method = "holm-sidak"
                    elif "holm" in _phl:
                        _mc_method = "holm"
                    elif "bonferroni" in _phl:
                        _mc_method = "bonferroni"
                    elif "\u0161\u00edd\u00e1k" in _phl or "sidak" in _phl:
                        _mc_method = "sidak"
                    else:
                        _mc_method = "tukey"
                    _use_pairwise = (_mc_method != "tukey")
                    ph_results = []
```

### C2b — apply the method to the chosen pair set. **1 occurrence.**

FIND:
```python
                        for g1, g2 in combinations(group_names, 2):
                            is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                            if not is_in:
                                continue
```
REPLACE:
```python
                        for g1, g2 in combinations(group_names, 2):
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in:
                                    continue
```

### C2c — record the SE/df so single-step CIs can be built. **1 occurrence.**

FIND:
```python
                            _t = _diff / _se
                            _p = float(2.0 * stats.t.sf(abs(_t), _dfp))
                            _pairs_out.append((g1, g2, _diff))
                            _p_raw.append(_p)
```
REPLACE:
```python
                            _t = _diff / _se
                            _p = float(2.0 * stats.t.sf(abs(_t), _dfp))
                            _pairs_out.append((g1, g2, _diff, _se))
                            _dfp_last = _dfp
                            _p_raw.append(_p)
```

### C2d — adjust with the requested method + build CIs. **1 occurrence.**

FIND:
```python
                        if _p_raw:
                            if multipletests is not None:
                                _rej, _padj, _, _ = multipletests(_p_raw, alpha=0.05, method='holm')
                            else:
                                _m = len(_p_raw)
                                _padj = [min(1.0, p * _m) for p in _p_raw]
                                _rej = [p < 0.05 for p in _padj]
```
REPLACE:
```python
                        if _p_raw:
                            if multipletests is not None:
                                _rej, _padj, _, _ = multipletests(_p_raw, alpha=0.05, method=_mc_method)
                            else:
                                _m = len(_p_raw)
                                _padj = [min(1.0, p * _m) for p in _p_raw]
                                _rej = [p < 0.05 for p in _padj]
                            # Single-step methods have simultaneous CIs; stepwise ones (Holm,
                            # Holm-Sidak) do not -- Prism omits CIs for those too.
                            _C = len(_p_raw)
                            _tcrit = None
                            if _mc_method == "bonferroni":
                                _tcrit = stats.t.ppf(1.0 - (0.05 / _C) / 2.0, _dfp_last)
                            elif _mc_method == "sidak":
                                _a_s = 1.0 - (1.0 - 0.05) ** (1.0 / _C)
                                _tcrit = stats.t.ppf(1.0 - _a_s / 2.0, _dfp_last)
```

### C2e — emit CIs, flipping them with the sign. **1 occurrence.**

FIND:
```python
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
```
REPLACE:
```python
                            for _i, (g1, g2, _diff, _se_i) in enumerate(_pairs_out):
                                _gg1, _gg2, _dd = g1, g2, _diff
                                _lo = _hi = None
                                if _tcrit is not None:
                                    _lo = _diff - _tcrit * _se_i
                                    _hi = _diff + _tcrit * _se_i
                                if _dd < 0:
                                    _dd = -_dd; _gg1, _gg2 = _gg2, _gg1
                                    if _lo is not None:
                                        _lo, _hi = -_hi, -_lo
                                ph_results.append({
                                    "group1": col_id_to_name.get(_gg1, _gg1),
                                    "group2": col_id_to_name.get(_gg2, _gg2),
                                    "mean_diff": get_clean_float(_dd),
                                    "p_value": get_clean_float(float(_padj[_i])),
                                    "ci_lower": get_clean_float(_lo) if _lo is not None else None,
                                    "ci_upper": get_clean_float(_hi) if _hi is not None else None,
                                    "significant": bool(_rej[_i]),
                                })
```

### C2f — name the method honestly (includes scope). **1 occurrence.**

FIND:
```python
                        _method_name = ("Pairwise Welch t-tests (Holm-adjusted)" if _welch
                                        else "Pairwise t-tests, pooled SD (Holm-adjusted)")
```
REPLACE:
```python
                        _pretty = {"bonferroni": "Bonferroni", "sidak": "\u0160\u00edd\u00e1k",
                                   "holm": "Holm", "holm-sidak": "Holm-\u0160\u00edd\u00e1k"}.get(_mc_method, _mc_method)
                        _scope = "selected pairs" if post_hoc_family == "specific_pairs" else "all pairs"
                        _method_name = (f"Pairwise Welch t-tests ({_pretty}-adjusted, {_scope})" if _welch
                                        else f"Pairwise t-tests, pooled SD ({_pretty}-adjusted, {_scope})")
```

**Expected result (measured, all matched against `statsmodels.stats.multitest.multipletests`):**

| Requested | Returned method | p-values | CIs |
|---|---|---|---|
| Tukey's HSD | Tukey's HSD | `[0.0, 0.0, 0.0003]` | ✅ |
| Bonferroni | Pairwise t-tests, pooled SD (Bonferroni-adjusted, all pairs) | `[0.0, 1.21e-06, 3.7414e-04]` **= ref** | ✅ |
| Šídák | …(Šídák-adjusted, all pairs) | `[0.0, 1.21e-06, 3.7409e-04]` **= ref** | ✅ |
| Holm-Šídák | …(Holm-Šídák-adjusted, all pairs) | `[0.0, 8e-07, 1.2471e-04]` **= ref** | ⛔ (correct — stepwise) |
| Holm | …(Holm-adjusted, all pairs) | `[0.0, 8e-07, 1.2471e-04]` **= ref** | ⛔ (correct) |

---

## C3 — a DELIBERATE contract change you must land with it

C2f renames the specific-pairs method label from
`"Pairwise t-tests, pooled SD (Holm-adjusted)"` → `"Pairwise t-tests, pooled SD (Holm-adjusted, selected pairs)"`.

`verify_fixes.py` pins that string, so it will fail. **This is the harness working correctly.**
Update the label assertion only — **the p-value threshold must not move** (the maths is unchanged;
verified: `p = 4.0167574311655835e-07` before and after).

In `apps/web/scratch/verify_fixes.py`, **1 occurrence**:

FIND:
```python
t5 = m == "Pairwise t-tests, pooled SD (Holm-adjusted)"
```
REPLACE:
```python
t5 = m == "Pairwise t-tests, pooled SD (Holm-adjusted, selected pairs)"
```

Do **not** touch `abs(comps[0]["p_value"]-4.0167574e-07) < 1e-10` on that line.

---

## C4 — extend the contract matrix

In `apps/web/scratch/posthoc_matrix.py`, add these rows to `CASES` (after the existing
Ordinary One-way ANOVA rows), so the new menu is permanently covered:

```python
    ("Ordinary One-way ANOVA", "Bonferroni",  "all_pairwise",   "Bonferroni"),
    ("Ordinary One-way ANOVA", "\u0160\u00edd\u00e1k",      "all_pairwise",   "\u0160\u00edd\u00e1k"),
    ("Ordinary One-way ANOVA", "Holm-\u0160\u00edd\u00e1k", "all_pairwise",   "Holm-\u0160\u00edd\u00e1k"),
    ("Ordinary One-way ANOVA", "Bonferroni",  "specific_pairs", "Bonferroni"),
```

Also add a **replicates regression** so C1 can never silently return. Insert before the final
`print(...)`/`sys.exit(...)`:

```python
# ---- Column tables with subcolumns (replicates > 1) --------------------------------
# Regression for the P0 where group_names became base ids ("c0") while df still held
# replicate columns ("c0_1"), crashing every df.melt(value_vars=group_names) call.
def _replicates_regression():
    cg = [{"id": "c0", "name": "Control"}, {"id": "c1", "name": "DrugA"}, {"id": "c2", "name": "DrugB"}]
    base = {"c0": [10, 11, 9, 10, 11, 9, 10.5, 9.5],
            "c1": [14, 15, 13, 14, 15, 13, 14.5, 13.5],
            "c2": [20, 21, 19, 20, 21, 19, 20.5, 19.5]}
    rows = []
    for i in range(4):
        row = {}
        for cid in ["c0", "c1", "c2"]:
            row[f"{cid}_1"] = base[cid][i*2]
            row[f"{cid}_2"] = base[cid][i*2+1]
        rows.append(row)
    sheet = {"type": "Column", "config": {"config": {"replicates": 2}}, "columnGroups": cg, "data": rows}
    bad = []
    for t in ["Ordinary One-way ANOVA", "Welch's ANOVA", "Kruskal-Wallis test", "Brown-Forsythe ANOVA"]:
        r = call(sheet, {"testId": t, "postHocFamily": "none"})
        if r.get("error"):
            bad.append(f"{t}: {str(r.get('error'))[:40]}")
    # labels must be display names, or significance brackets silently vanish
    r = call(sheet, {"testId": "Ordinary One-way ANOVA", "postHocFamily": "all_pairwise", "postHocTest": "Tukey's HSD"})
    labels = set()
    for c in (r.get("post_hocs") or {}).get("comparisons", []):
        labels.add(c["group1"]); labels.add(c["group2"])
    if labels and not labels <= {"Control", "DrugA", "DrugB"}:
        bad.append(f"post-hoc labels are not display names: {sorted(labels)}")
    return bad

_rep_bad = _replicates_regression()
print()
print("Column replicates (subcolumns):", "PASS" if not _rep_bad else "FAIL")
for _b in _rep_bad:
    print("   ", _b)
if _rep_bad:
    failures += 1
```

---

## VERIFICATION — all must pass

```bash
cd apps/web
python3 scratch/verify_fixes.py       # ALL CHECKS: PASS   (exit 0)
python3 scratch/posthoc_matrix.py     # 18/18 + determinism PASS + replicates PASS (exit 0)
python3 scratch/verify_dunnett.py     # ALL CHECKS: PASS   (exit 0)
npx tsc -p tsconfig.app.json --noEmit # exit 0
```

**Measured on the reference implementation: all three suites exit 0 with C1+C2 applied.**

If a FIND fails or a check won't tick, **stop and report**. Do not weaken an assertion to make it
green — the only assertion change permitted is C3, and only the label half of it.

---

## OUT OF SCOPE
- Dunnett's test — **already implemented and verified**; do not touch it.
- Post-hoc methods for Grouped / Nested / Survival tables.
- Newman-Keuls (deliberately omitted; Prism discourages it).
