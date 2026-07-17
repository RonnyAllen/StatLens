# TASK A: Add Dunnett's test ("compare each group to a control") — engine + UI

Every REPLACE block below has been **written and executed** against the current engine and checked
against independent `scipy.stats.dunnett` / `scikit-posthocs` references, **including inside the real
Pyodide 0.26.1 WASM runtime**. The numbers under "Expected result" are measured, not predicted.

Your job is **mechanical application, not design.**

---

## PRECONDITION — read first

This task assumes the P0–P2 fixes are already in `analysis_engine.py`. Verify before starting:

```bash
grep -c "itertools\." apps/web/src/stats/analysis_engine.py   # must print 0
grep -c "psturng"      apps/web/src/stats/analysis_engine.py   # must print 3
grep -c "_use_pairwise" apps/web/src/stats/analysis_engine.py  # must print >= 1
wc -l apps/web/src/stats/analysis_engine.py                    # must print 2928
```
If any check fails, **STOP** — you are on the wrong base revision. Do not proceed, do not "fix"
the base, report what you found.

---

## NON-NEGOTIABLE RULES

1. **Only these two files may change:**
   - `apps/web/src/stats/analysis_engine.py` (LF line endings)
   - `apps/web/src/components/workspace/TestOptionsDialog.tsx` (**CRLF line endings — preserve them**)
2. **If a FIND string does not match: STOP and report.** Do not fuzzy-match, do not re-implement your
   own version, do not regenerate the file. A mismatch means the base drifted and I need to know.
3. Occurrence counts are exact. One block is intentionally replaced **twice** (D3) — it appears
   identically in Welch's ANOVA and Brown-Forsythe ANOVA. Both must be replaced.
4. **Do not reformat, re-indent, reorder imports, or "improve" adjacent code.** Python indentation
   here is significant.
5. **Never silently substitute a different post-hoc test.** If a method is unavailable, raise a clear
   error. Returning a *different* test than the user asked for is the exact bug this task fixes.
6. **Do not offer "compare to control" for table types where the engine does not implement it**
   (Grouped / Nested / Survival / Three-way). The UI gate in A-UI-5 is load-bearing: without it the
   user would ask for Dunnett and silently receive all-pairs Tukey.
7. Additive JSON only: you may ADD `control_group` to the `post_hocs` dict. Do not rename existing keys.

---

## BACKGROUND — two findings you must not "optimise away"

**(a) `scipy.stats.dunnett` is NOT deterministic.** It integrates the multivariate t by quasi-Monte-Carlo.
Measured in Pyodide/WASM — five identical calls on the same data:

```
run 1: 2.110326e-5    run 2: 3.077101e-5    run 3: 6.993488e-5
run 4: 3.326094e-5    run 5: 2.541224e-5          <- a 3.3x spread
```

With `random_state=np.random.default_rng(DUNNETT_SEED)` it is bit-identical every run. Prism is
deterministic; StatLens must be. **Do not remove the seed.** (Noise is negligible near p≈0.05 —
0.02% at p≈0.69 — so decisions never flip; but a user re-running the same analysis must get the
same number.)

**(b) Dunnett is not "Tukey filtered to the control rows."** It uses its own distribution and gives
*different, less conservative* p-values because it makes k−1 comparisons rather than k(k−1)/2.
Filtering Tukey output would be wrong even though the numbers look plausible.

---

## PART 1 — ENGINE (`apps/web/src/stats/analysis_engine.py`)

### D1 — seed constant + make Dunnett's T3 comparison count parameterisable
**Exactly 1 occurrence.**

FIND:
```python
def dunnetts_t3_pvalue(t_stat, k, df):
    # Tamhane's T3 uses the Studentized Maximum Modulus over C = k(k-1)/2
    # comparisons (NOT the studentized range / Tukey).
    C = k * (k - 1) / 2.0
```
REPLACE:
```python
# scipy.stats.dunnett integrates the multivariate t by quasi-Monte-Carlo and is NOT
# deterministic without a seed. Verified in Pyodide/WASM: five identical calls returned
# p from 2.1e-05 to 7.0e-05. Prism is deterministic, so we pin the stream.
DUNNETT_SEED = 20260717


def dunnetts_t3_pvalue(t_stat, k, df, n_comparisons=None):
    # Tamhane's T3 uses the Studentized Maximum Modulus over C comparisons.
    # All-pairs -> C = k(k-1)/2. Compare-to-control -> C = k-1 (pass n_comparisons).
    C = float(n_comparisons) if n_comparisons else k * (k - 1) / 2.0
```

### D2 — Ordinary One-way ANOVA → real Dunnett
**Exactly 1 occurrence.**

FIND:
```python
                    _use_pairwise = (post_hoc_family == "specific_pairs") and ("Pairwise" in _pht)
                    ph_results = []

                    if _use_pairwise:
```
REPLACE:
```python
                    _use_pairwise = (post_hoc_family == "specific_pairs") and ("Pairwise" in _pht)
                    ph_results = []

                    if post_hoc_family == "control_vs_others":
                        # Prism: "Compare each column to a control column" -> Dunnett's test.
                        # Dunnett uses its own multivariate-t distribution; it is NOT Tukey
                        # filtered to the control rows.
                        if not hasattr(stats, "dunnett"):
                            raise RuntimeError(
                                "Dunnett's test requires scipy >= 1.11. Refusing to silently "
                                "substitute a different post-hoc test."
                            )
                        _ctrl = options.get("controlGroup") or ""
                        if _ctrl not in group_names:
                            _ctrl = group_names[0]
                        _others = [g for g in group_names if g != _ctrl]
                        if not _others:
                            raise ValueError("Dunnett's test needs a control group and at least one other group.")
                        _cd = np.asarray(df[_ctrl].dropna().values, dtype=float)
                        _od = [np.asarray(df[g].dropna().values, dtype=float) for g in _others]
                        _dres = stats.dunnett(*_od, control=_cd,
                                              random_state=np.random.default_rng(DUNNETT_SEED))
                        _dci = _dres.confidence_interval()
                        _dp = np.ravel(_dres.pvalue); _dlo = np.ravel(_dci.low); _dhi = np.ravel(_dci.high)
                        for _i, _g in enumerate(_others):
                            # Orientation is scipy's: treatment - control. Do NOT force the
                            # difference positive here; direction vs control is meaningful and
                            # the CI must stay consistent with it.
                            _diff = float(np.mean(_od[_i]) - np.mean(_cd))
                            _p = float(_dp[_i])
                            ph_results.append({
                                "group1": col_id_to_name.get(_g, _g),
                                "group2": col_id_to_name.get(_ctrl, _ctrl),
                                "mean_diff": get_clean_float(_diff),
                                "p_value": get_clean_float(_p),
                                "ci_lower": get_clean_float(float(_dlo[_i])),
                                "ci_upper": get_clean_float(float(_dhi[_i])),
                                "significant": bool(_p < 0.05),
                            })
                        _cname = col_id_to_name.get(_ctrl, _ctrl)
                        result["post_hocs"] = {"method": "Dunnett's multiple comparisons test",
                                               "control_group": _cname,
                                               "comparisons": ph_results}
                        report += (f"Post-hoc comparisons using **Dunnett's test** were conducted, "
                                   f"comparing each group to the control ({_cname}). ")
                    elif _use_pairwise:
```

### D3 — Welch's + Brown-Forsythe: restrict Dunnett's T3 to control comparisons (C = k−1)
**Exactly 2 occurrences** — identical text in Welch's ANOVA and Brown-Forsythe ANOVA. Replace both.

FIND (×2):
```python
                        for idx, row in ph.iterrows():
                            g1 = row['A']
                            g2 = row['B']
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            
                            t_stat = row['T']
                            df_welch = row['df']
                            p_val = dunnetts_t3_pvalue(t_stat, k_groups, df_welch)
```
REPLACE (×2):
```python
                        _ctrl_t3 = options.get("controlGroup") or ""
                        if _ctrl_t3 not in group_names:
                            _ctrl_t3 = group_names[0] if group_names else ""
                        _ncomp_t3 = (len(group_names) - 1) if post_hoc_family == "control_vs_others" else None
                        for idx, row in ph.iterrows():
                            g1 = row['A']
                            g2 = row['B']
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            elif post_hoc_family == "control_vs_others":
                                if g1 != _ctrl_t3 and g2 != _ctrl_t3:
                                    continue
                            
                            t_stat = row['T']
                            df_welch = row['df']
                            p_val = dunnetts_t3_pvalue(t_stat, k_groups, df_welch, n_comparisons=_ncomp_t3)
```

> The `continue` in the `elif` drops non-control pairs; `_ncomp_t3` shrinks the SMM correction from
> k(k−1)/2 to k−1. Both are required — dropping rows without shrinking C leaves the p-values
> over-conservative.

### D4 — Kruskal-Wallis → Dunn's vs control, Bonferroni over k−1
**Exactly 1 occurrence.**

FIND:
```python
                if post_hoc_family != "none" and post_hoc_test == "Dunn's test":
                    ph = sp.posthoc_dunn(df.melt(value_vars=group_names).dropna(), val_col='value', group_col='variable', p_adjust='bonferroni')
                    
                    ph_results = []
                    for i in range(len(ph.columns)):
                        for j in range(i+1, len(ph.columns)):
                            g1 = ph.columns[i]
                            g2 = ph.columns[j]
                            p_val = ph.iloc[i, j]
                            
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in:
                                    continue
                                    
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                    result["post_hocs"] = {"method": "Dunn's test (Bonferroni correction)", "comparisons": ph_results}
                    report += "Post-hoc comparisons using Dunn's test with Bonferroni correction were conducted."
```
REPLACE:
```python
                if post_hoc_family != "none" and post_hoc_test == "Dunn's test":
                    _melted_kw = df.melt(value_vars=group_names).dropna()
                    if post_hoc_family == "control_vs_others":
                        # Bonferroni must span ONLY the k-1 control comparisons, not all pairs.
                        _ph_raw = sp.posthoc_dunn(_melted_kw, val_col='value', group_col='variable', p_adjust=None)
                        _ctrl_kw = options.get("controlGroup") or ""
                        _cols_kw = list(_ph_raw.columns)
                        if _ctrl_kw not in _cols_kw:
                            _ctrl_kw = group_names[0]
                        _others_kw = [g for g in _cols_kw if g != _ctrl_kw]
                        _m_kw = max(1, len(_others_kw))
                        ph_results = []
                        for _g in _others_kw:
                            _p_un = float(_ph_raw.loc[_ctrl_kw, _g])
                            _p_adj = min(1.0, _p_un * _m_kw)
                            ph_results.append({
                                "group1": col_id_to_name.get(_g, _g),
                                "group2": col_id_to_name.get(_ctrl_kw, _ctrl_kw),
                                "p_value": get_clean_float(_p_adj),
                                "significant": bool(_p_adj < 0.05)
                            })
                        _cname_kw = col_id_to_name.get(_ctrl_kw, _ctrl_kw)
                        result["post_hocs"] = {"method": "Dunn's test vs control (Bonferroni)",
                                               "control_group": _cname_kw,
                                               "comparisons": ph_results}
                        report += (f"Post-hoc comparisons using Dunn's test with Bonferroni correction "
                                   f"were conducted against the control ({_cname_kw}).")
                    else:
                        ph = sp.posthoc_dunn(_melted_kw, val_col='value', group_col='variable', p_adjust='bonferroni')

                        ph_results = []
                        for i in range(len(ph.columns)):
                            for j in range(i+1, len(ph.columns)):
                                g1 = ph.columns[i]
                                g2 = ph.columns[j]
                                p_val = ph.iloc[i, j]

                                if post_hoc_family == "specific_pairs":
                                    is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                    if not is_in:
                                        continue

                                ph_results.append({
                                    "group1": col_id_to_name.get(g1, g1),
                                    "group2": col_id_to_name.get(g2, g2),
                                    "p_value": get_clean_float(p_val),
                                    "significant": bool(p_val < 0.05)
                                })
                        result["post_hocs"] = {"method": "Dunn's test (Bonferroni correction)", "comparisons": ph_results}
                        report += "Post-hoc comparisons using Dunn's test with Bonferroni correction were conducted."
```

---

## PART 2 — UI (`apps/web/src/components/workspace/TestOptionsDialog.tsx`)

**This file uses CRLF (`\r\n`). Preserve CRLF.** If your exact-match tooling fails on line endings,
match on the visible text — but do not convert the file to LF.

### A-UI-1 — widen the exported type. **1 occurrence.**
FIND:
```tsx
export interface TestOptions {
  testId: string
  postHocFamily: "all_pairwise" | "specific_pairs" | "none"
  postHocTest: string
  specificPairs: Array<[string, string]>
  transformOptions?: any
}
```
REPLACE:
```tsx
export interface TestOptions {
  testId: string
  postHocFamily: "all_pairwise" | "specific_pairs" | "control_vs_others" | "none"
  postHocTest: string
  specificPairs: Array<[string, string]>
  /** Column-group id of the control column. Only set when postHocFamily === "control_vs_others". */
  controlGroup?: string
  transformOptions?: any
}
```

### A-UI-2 — state. **1 occurrence.**
FIND:
```tsx
  const [postHocFamily, setPostHocFamily] = useState<"all_pairwise" | "specific_pairs">("all_pairwise")
```
REPLACE:
```tsx
  const [postHocFamily, setPostHocFamily] = useState<"all_pairwise" | "specific_pairs" | "control_vs_others">("all_pairwise")
  const [controlGroup, setControlGroup] = useState<string>("")
```

### A-UI-3 — recommend the right method for the control family. **1 occurrence.**
FIND:
```tsx
    if (postHocFamily === "all_pairwise") {
      if (equalVar) {
        return "Tukey's HSD"
      } else {
        return maxN < 50 ? "Dunnett's T3 test" : "Games-Howell test"
      }
    } else {
      return equalVar ? "Pairwise t-tests with Holm correction" : "Pairwise Welch t-tests with Holm correction"
    }
```
REPLACE:
```tsx
    if (postHocFamily === "control_vs_others") {
      // Equal variance -> true Dunnett. Unequal -> Dunnett's T3 restricted to the k-1
      // control comparisons. (Non-parametric already returned "Dunn's test" above.)
      return equalVar ? "Dunnett's multiple comparisons test" : "Dunnett's T3 test"
    }
    if (postHocFamily === "all_pairwise") {
      if (equalVar) {
        return "Tukey's HSD"
      } else {
        return maxN < 50 ? "Dunnett's T3 test" : "Games-Howell test"
      }
    } else {
      return equalVar ? "Pairwise t-tests with Holm correction" : "Pairwise Welch t-tests with Holm correction"
    }
```

> Placement matters: this must sit **after** the existing `if (!isParametric) return "Dunn's test"`
> early return, so Kruskal-Wallis + control still routes to Dunn's (which D4 handles).

### A-UI-4 — send the control group. **1 occurrence.**
FIND:
```tsx
      specificPairs: postHocFamily === "specific_pairs" ? selectedPairs : [],
```
REPLACE:
```tsx
      specificPairs: postHocFamily === "specific_pairs" ? selectedPairs : [],
      controlGroup: postHocFamily === "control_vs_others" ? (controlGroup || validGroups[0] || "") : undefined,
```

### A-UI-5 — the radio option, **gated to Column tables only**. **1 occurrence.**
FIND:
```tsx
                  {recommendedTestId !== "Three-way ANOVA" && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specific_pairs" id="specific_pairs" />
                      <Label htmlFor="specific_pairs" className="font-normal">
                        Compare specific pairs of columns
                      </Label>
                    </div>
                  )}
                </RadioGroup>
```
REPLACE:
```tsx
                  {recommendedTestId !== "Three-way ANOVA" && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specific_pairs" id="specific_pairs" />
                      <Label htmlFor="specific_pairs" className="font-normal">
                        Compare specific pairs of columns
                      </Label>
                    </div>
                  )}
                  {/* Compare-to-control is only offered for Column tables, because that is the
                      only table type where the engine implements it. Offering it elsewhere would
                      silently return all-pairwise results instead. */}
                  {sheet.type === "Column" && recommendedTestId !== "Three-way ANOVA" && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="control_vs_others" id="control_vs_others" />
                      <Label htmlFor="control_vs_others" className="font-normal">
                        Compare each group to a control group
                      </Label>
                    </div>
                  )}
                </RadioGroup>
```

### A-UI-6 — the control picker. **1 occurrence.**
FIND:
```tsx
              {postHocFamily === "specific_pairs" && recommendedTestId !== "Three-way ANOVA" && (
                <div className="pl-6 border-l-2 ml-2 space-y-3">
                  <h5 className="text-sm font-medium">Select Pairs to Compare</h5>
```
REPLACE:
```tsx
              {postHocFamily === "control_vs_others" && sheet.type === "Column" && (
                <div className="pl-6 border-l-2 ml-2 space-y-3">
                  <h5 className="text-sm font-medium">Select the Control Group</h5>
                  <RadioGroup
                    value={controlGroup || validGroups[0] || ""}
                    onValueChange={(v: any) => setControlGroup(v)}
                    className="space-y-2"
                  >
                    {validGroups.map(gId => {
                      const gName = sheet.columnGroups.find(g => g.id === gId)?.name || gId
                      return (
                        <div key={gId} className="flex items-center space-x-2">
                          <RadioGroupItem value={gId} id={`ctrl-${gId}`} />
                          <Label htmlFor={`ctrl-${gId}`} className="font-normal">{gName}</Label>
                        </div>
                      )
                    })}
                  </RadioGroup>
                </div>
              )}

              {postHocFamily === "specific_pairs" && recommendedTestId !== "Three-way ANOVA" && (
                <div className="pl-6 border-l-2 ml-2 space-y-3">
                  <h5 className="text-sm font-medium">Select Pairs to Compare</h5>
```

---

## VERIFICATION — must pass before you report success

Save as `apps/web/scratch/verify_dunnett.py` and run from `apps/web`:

```python
import re, io, contextlib, numpy as np, scipy.stats as ss, sys
P = "src/stats/analysis_engine.py"
src = re.sub(r"\n\s*run\(\)\s*$", "\n", open(P).read())
NS = {"__name__": "eng"}; exec(compile(src, P, "exec"), NS)
def call(sheet, opt):
    NS["sheet_data"] = sheet; NS["options"] = opt; NS["post_progress"] = lambda *a: None
    with contextlib.redirect_stdout(io.StringIO()): return NS["run"]()
def col(d):
    cg = [{"id": f"c{i}", "name": n} for i, n in enumerate(d)]; idb = {g["name"]: g["id"] for g in cg}
    L = max(len(v) for v in d.values()); data = []
    for r in range(L):
        row = {}
        for n, v in d.items():
            if r < len(v): row[idb[n]] = v[r]
        data.append(row)
    return {"type": "Column", "config": {}, "columnGroups": cg, "data": data}

CTRL=[10.0,11.2,9.5,10.8,10.1,9.9]; T1=[13.8,14.5,13.0,14.2,13.5,13.9]; T2=[10.2,11.0,10.5,10.1,10.7,10.3]
SH = col({"Control":CTRL,"DrugA":T1,"DrugB":T2}); ok = True

O = {"testId":"Ordinary One-way ANOVA","postHocFamily":"control_vs_others",
     "postHocTest":"Dunnett's multiple comparisons test","controlGroup":"c0"}
r = call(SH, O); ph = r.get("post_hocs") or {}; comps = ph.get("comparisons", [])
t = (r.get("error") is None and "Dunnett" in str(ph.get("method")) and len(comps) == 2
     and all("Control" in (c["group1"], c["group2"]) for c in comps))
print("D2 Dunnett method/count:", "PASS" if t else f"FAIL {ph.get('method')} n={len(comps)}"); ok &= t

ref = ss.dunnett(np.array(T1), np.array(T2), control=np.array(CTRL),
                 random_state=np.random.default_rng(NS["DUNNETT_SEED"]))
rp = [float(x) for x in np.ravel(ref.pvalue)]; got = [c["p_value"] for c in comps]
t = all(abs(a-b) < 1e-12 for a, b in zip(sorted(got), sorted(rp)))
print("D2 p == scipy ref     :", "PASS" if t else f"FAIL got={got} ref={rp}"); ok &= t

p1 = [c["p_value"] for c in (call(SH, O).get("post_hocs") or {}).get("comparisons", [])]
p2 = [c["p_value"] for c in (call(SH, O).get("post_hocs") or {}).get("comparisons", [])]
t = p1 == p2
print("D2 deterministic      :", "PASS" if t else f"FAIL {p1} != {p2}"); ok &= t

r = call(SH, {"testId":"Kruskal-Wallis test","postHocFamily":"control_vs_others",
              "postHocTest":"Dunn's test","controlGroup":"c0"})
ph = r.get("post_hocs") or {}
t = "vs control" in str(ph.get("method")) and len(ph.get("comparisons", [])) == 2
print("D4 Dunn vs control    :", "PASS" if t else f"FAIL {ph.get('method')}"); ok &= t

r = call(SH, {"testId":"Welch's ANOVA","postHocFamily":"control_vs_others",
              "postHocTest":"Dunnett's T3 test","controlGroup":"c0"})
ph = r.get("post_hocs") or {}
t = r.get("error") is None and len(ph.get("comparisons", [])) == 2
print("D3 T3 control-only    :", "PASS" if t else f"FAIL n={len(ph.get('comparisons', []))}"); ok &= t

for fam, pht, want, n in [("all_pairwise", "Tukey's HSD", "Tukey", 3),
                          ("specific_pairs", "Pairwise t-tests with Holm correction", "Holm", 1)]:
    r = call(SH, {"testId":"Ordinary One-way ANOVA","postHocFamily":fam,"postHocTest":pht,
                  "specificPairs":[["c0","c1"]]})
    ph = r.get("post_hocs") or {}
    t = want in str(ph.get("method")) and len(ph.get("comparisons", [])) == n
    print(f"REG {fam:15s}   :", "PASS" if t else f"FAIL {ph.get('method')}"); ok &= t

print("\nALL CHECKS:", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
```

**Expected (measured on the reference implementation):**
- `DrugA vs Control: diff=3.5667, CI=[2.8456, 4.2878], p=2.768463e-11`
- `DrugB vs Control: diff=0.2167, CI=[-0.5044, 0.9378], p=6.907811e-01`
- Exactly **2** comparisons — no DrugA-vs-DrugB row.
- Dunn vs control: `DrugA p=0.002127`, `DrugB p=0.963710` (= raw Dunn × 2).

Then:
```bash
cd apps/web && npx tsc -p tsconfig.app.json --noEmit     # must exit 0
cd apps/web && python3 scratch/posthoc_matrix.py         # must print 11/11 (see Task B)
```

---

## ACCEPTANCE CHECKLIST — report each line

- [ ] Precondition greps matched (0 / 3 / ≥1 / 2928) before starting
- [ ] D1, D2, D4 applied (1× each); **D3 applied 2×**
- [ ] A-UI-1 … A-UI-6 applied (1× each); file still CRLF
- [ ] `verify_dunnett.py` prints **ALL CHECKS: PASS**
- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0
- [ ] `git diff --stat` shows **exactly 2 modified files** (+ new scratch files)
- [ ] Manual check: open a Column table with 3+ groups → "Compare each group to a control group"
      appears with a group picker. Open a **Grouped** table → the option is **absent**.

Do not weaken any assertion to make a check pass. Do not regenerate either file from scratch.
If something cannot be ticked, stop and report it.

---

## EXPLICITLY OUT OF SCOPE
- Compare-to-control for Grouped / Nested / Three-way / Survival tables.
- Changing `AnalysisResultsView.tsx` (it already renders `ci_lower`/`ci_upper` from the P0–P2 work).
- Any other statistical method or refactor.
