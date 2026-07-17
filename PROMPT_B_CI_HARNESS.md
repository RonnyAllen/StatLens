# TASK B: Build the statistics regression harness and wire it into CI

Right now StatLens has one ad-hoc script (`apps/web/scratch/verify_fixes.py`) that runs by hand and
covers 5 of the 7 fixes. Nothing runs automatically. This task creates a real safety net and wires it
into GitHub Actions so a regression fails the build instead of shipping.

**This is additive.** You are creating new files and one workflow. Do not modify
`analysis_engine.py` or any component while doing it.

---

## WHY THIS SHAPE — do not "simplify" it

The existing `docs/AUDIT_MATRIX.md` marks every test "✅ Runs" and `PROGRESS.md` claims a blind audit
"to 0.001 tolerance". Both were green while the engine contained two hard crashes and a silent
wrong-test substitution. The audit asked *"did it run?"* and *"is the number self-consistent?"* —
both were **yes** for a user who asked for Dunnett and silently received Tukey.

So this harness asserts **three separate things**, and all three are load-bearing:

1. **Golden values** — the number matches an independent reference.
2. **The contract** — the returned method label is the method that was *requested*, and the number of
   comparisons matches the *family* (this is the check that catches wrong-test substitution).
3. **Every option permutation the UI can emit** — bugs live in combinations, not in single tests.
   All three serious bugs found so far lived in a specific `postHocFamily × postHocTest` cell.

A test that only checks p-values would have passed the entire time these bugs were live.

---

## FILE 1 — `apps/web/scratch/posthoc_matrix.py` (NEW)

The contract matrix. Create it exactly as below.

```python
"""Post-hoc CONTRACT MATRIX.

Golden-value tests catch wrong numbers. They do NOT catch "user asked for Dunnett and
silently got Tukey" - the p-values were all internally consistent, just for the wrong test.
So this harness asserts the *contract* for every option permutation the UI can emit:

  1. no error
  2. the returned method label matches the method that was REQUESTED
  3. the number of comparisons matches the FAMILY
       all_pairwise      -> k(k-1)/2
       control_vs_others -> k-1        (and the control must appear in every row)
       specific_pairs    -> len(specificPairs)

Run:  python3 scratch/posthoc_matrix.py        (from apps/web)
Exit code 0 = all pass, 1 = at least one failure (so CI fails).
"""
import re, io, contextlib, sys

ENGINE = "src/stats/analysis_engine.py"
src = re.sub(r"\n\s*run\(\)\s*$", "\n", open(ENGINE).read())
NS = {"__name__": "eng"}
exec(compile(src, ENGINE, "exec"), NS)

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

# 3 groups, unequal variance on purpose so the robust paths are exercised too
CTRL = [10.0, 11.2, 9.5, 10.8, 10.1, 9.9]
T1   = [13.8, 14.5, 13.0, 14.2, 13.5, 13.9]
T2   = [10.2, 11.0, 10.5, 10.1, 10.7, 10.3]
SHEET = col({"Control": CTRL, "DrugA": T1, "DrugB": T2})
K = 3

# (test_id, postHocTest, family, expected_substring_in_returned_method)
# The postHocTest strings are exactly what TestOptionsDialog.recommendedPostHoc emits.
# If you add a branch there, add the matching row here.
CASES = [
    ("Ordinary One-way ANOVA", "Tukey's HSD",                           "all_pairwise",      "Tukey"),
    ("Ordinary One-way ANOVA", "Pairwise t-tests with Holm correction", "specific_pairs",    "Holm"),
    ("Ordinary One-way ANOVA", "Dunnett's multiple comparisons test",   "control_vs_others", "Dunnett"),
    ("Welch's ANOVA",          "Games-Howell test",                     "all_pairwise",      "Games-Howell"),
    ("Welch's ANOVA",          "Dunnett's T3 test",                     "all_pairwise",      "T3"),
    ("Welch's ANOVA",          "Dunnett's T3 test",                     "control_vs_others", "T3"),
    ("Brown-Forsythe ANOVA",   "Games-Howell test",                     "all_pairwise",      "Games-Howell"),
    ("Brown-Forsythe ANOVA",   "Dunnett's T3 test",                     "control_vs_others", "T3"),
    ("Kruskal-Wallis test",    "Dunn's test",                           "all_pairwise",      "Dunn"),
    ("Kruskal-Wallis test",    "Dunn's test",                           "control_vs_others", "Dunn"),
    ("Kruskal-Wallis test",    "Dunn's test",                           "specific_pairs",    "Dunn"),
]

def expected_n(family):
    if family == "all_pairwise":      return K * (K - 1) // 2
    if family == "control_vs_others": return K - 1
    if family == "specific_pairs":    return 1
    return None

rows, failures = [], 0
for test_id, pht, family, want in CASES:
    opts = {"testId": test_id, "postHocFamily": family, "postHocTest": pht,
            "specificPairs": [["c0", "c1"]] if family == "specific_pairs" else [],
            "controlGroup": "c0"}
    try:
        r = call(SHEET, opts)
    except Exception as e:
        rows.append((test_id, family, "EXCEPTION", f"{type(e).__name__}: {e}", "FAIL")); failures += 1; continue

    err = r.get("error"); ph = r.get("post_hocs") or {}
    method = ph.get("method"); comps = ph.get("comparisons", [])
    exp_n = expected_n(family)

    problems = []
    if err: problems.append(f"error={err[:50]}")
    if method is None:
        problems.append("no post_hocs returned")
    else:
        if want.lower() not in str(method).lower():
            problems.append(f"METHOD MISMATCH: asked '{pht}' got '{method}'")
        if exp_n is not None and len(comps) != exp_n:
            problems.append(f"COUNT: expected {exp_n} got {len(comps)}")
        if family == "control_vs_others":
            bad = [c for c in comps if "Control" not in (c.get("group1"), c.get("group2"))]
            if bad: problems.append(f"{len(bad)} comparison(s) omit the control group")
    status = "PASS" if not problems else "FAIL"
    if problems: failures += 1
    rows.append((test_id, family, method or "-", "; ".join(problems) or "ok", status))

w = max(len(r[0]) for r in rows)
print(f"{'TEST':{w}}  {'FAMILY':17}  {'RETURNED METHOD':38}  STATUS  NOTES")
print("-" * 130)
for t, fam, method, note, status in rows:
    print(f"{t:{w}}  {fam:17}  {str(method)[:38]:38}  {status:6}  {note if status == 'FAIL' else ''}")
print("-" * 130)
print(f"{len(rows) - failures}/{len(rows)} permutations pass")
# ---- Determinism guard ------------------------------------------------------------
# scipy.stats.dunnett integrates the multivariate t by quasi-Monte-Carlo. Without a
# pinned seed it returns a DIFFERENT p-value on every run (measured in Pyodide/WASM:
# 2.1e-05 to 7.0e-05 across five identical calls -- a 3.3x spread). A user re-running
# the same analysis must get the same number, so the engine pins the stream via
# DUNNETT_SEED. This guard fails if that seed is ever removed as a "cleanup".
# It SKIPS on revisions where Dunnett is not implemented, so this harness can land
# before Task A.
#
# NOTE: the contract matrix above CANNOT catch a missing seed -- with the seed removed
# it still reports 11/11, because the method label and comparison count stay correct.
# Only this guard catches it. Do not delete it.
def _dunnett_determinism():
    o = {"testId": "Ordinary One-way ANOVA", "postHocFamily": "control_vs_others",
         "postHocTest": "Dunnett's multiple comparisons test", "controlGroup": "c0"}
    try:
        a = call(SHEET, o); b = call(SHEET, o)
    except Exception as e:
        return "SKIP", f"engine raised {type(e).__name__}"
    method = str((a.get("post_hocs") or {}).get("method", ""))
    if "Dunnett" not in method:
        return "SKIP", "Dunnett not implemented on this revision"
    pa = [c["p_value"] for c in (a.get("post_hocs") or {}).get("comparisons", [])]
    pb = [c["p_value"] for c in (b.get("post_hocs") or {}).get("comparisons", [])]
    if pa != pb:
        return "FAIL", f"p changed between identical runs -- is DUNNETT_SEED gone? {pa} != {pb}"
    return "PASS", "identical across two runs"

_st, _note = _dunnett_determinism()
print()
print(f"Dunnett determinism: {_st}  {_note}")
if _st == "FAIL":
    failures += 1

sys.exit(1 if failures else 0)
```

**Measured expectations:**
- Against the engine **with** the P0–P2 fixes but **without** Task A (Dunnett): **7/11 pass**. The 4
  failures are all `control_vs_others` — this is correct and expected, and is exactly what the
  harness exists to catch.
- Against the engine **with** Task A applied: **11/11 pass**, determinism guard `PASS`.
- Before Task A the determinism guard prints `SKIP` (not a failure) — verified.
- With `DUNNETT_SEED` deliberately removed: the matrix **still prints 11/11** but the guard prints
  `FAIL` and the script exits 1 — verified. This is exactly why the guard exists.

If you run this before Task A, do not "fix" the 4 failures here. They are the finding.

---

## FILE 2 — extend `apps/web/scratch/verify_fixes.py` (EDIT)

The current script covers FIX 1, 2, 4, 5, 6 and three regressions. **FIX 3 and FIX 7 are not
covered.** Add them. Insert the two blocks below immediately before the final
`print("\nALL CHECKS:", ...)` line, and do not change any existing threshold.

```python
# FIX 3 - psturng clamped p at 0.001; the accurate sf must go below that floor.
def grouped(rl, cl, cm, reps):
    cg = [{"id": f"c{i}", "name": n} for i, n in enumerate(cl)]
    idb = {n: g["id"] for n, g in zip(cl, cg)}; data = []
    for r in rl:
        for rep in range(reps):
            row = {"rowTitle": r}
            for c in cl:
                k = f"{idb[c]}_{rep+1}" if reps > 1 else idb[c]
                row[k] = cm[r][c][rep]
            data.append(row)
    return {"type": "Grouped", "config": {"replicates": reps}, "columnGroups": cg, "data": data}

cm = {"Low":  {"DrugA": [5.1, 5.3, 4.9, 5.0],     "DrugB": [6.1, 6.3, 5.9, 6.0]},
      "High": {"DrugA": [50.1, 50.0, 50.3, 49.9], "DrugB": [90.1, 90.0, 90.4, 89.8]}}
r = call(grouped(["Low", "High"], ["DrugA", "DrugB"], cm, 4),
         {"testId": "Two-way ANOVA", "postHocFamily": "all_pairwise", "postHocTest": "Tukey's HSD"})
_rep = r.get("report_markdown") or ""
t3 = "| 0.001 |" not in _rep and "<0.0001" in _rep
print("FIX3 psturng clamp     :", "PASS" if t3 else "FAIL (p-adj still floored at 0.001)"); ok &= t3

# FIX 7 - an engine bug must never be reported as a user data problem.
_bug = re.sub(r"res = pg\.anova\(data=df\.melt\(value_vars=group_names\)\.dropna\(\), dv='value', between='variable'\)",
              "raise NameError(\"name 'bogus' is not defined\")", src, count=1)
NS_B = {"__name__": "bug"}; exec(compile(_bug, "bug", "exec"), NS_B)
NS_B["sheet_data"] = col({"A": A, "B": B, "C": C}); NS_B["options"] = {"testId": "Ordinary One-way ANOVA", "postHocFamily": "none"}
NS_B["post_progress"] = lambda *a: None
with contextlib.redirect_stdout(io.StringIO()):
    rb = NS_B["run"]()
t7 = "Internal engine error" in (rb.get("error") or "") and bool(rb.get("error_detail"))
print("FIX7 engine-bug message:", "PASS" if t7 else f"FAIL {rb.get('error')}"); ok &= t7
```

Also add `import sys` at the top if absent, and make the last line exit non-zero on failure so CI can
see it:
```python
print("\nALL CHECKS:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
```

---

## FILE 3 — `.github/workflows/stats-tests.yml` (NEW)

Runs on every push and PR. **Separate from `deploy.yml`** — do not edit the deploy workflow.

```yaml
name: Statistics regression tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  stats:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      # Versions pinned to match what the Pyodide worker installs, so CI and the
      # browser agree. If you change the pins in pyodide.worker2.ts, change them here.
      - name: Install statistics stack
        run: |
          python -m pip install --upgrade pip
          pip install numpy scipy pandas statsmodels scikit-learn \
                      pingouin==0.5.4 scikit-posthocs==0.9.0 lifelines==0.29.0

      - name: Golden-value fixes
        working-directory: apps/web
        run: python3 scratch/verify_fixes.py

      - name: Post-hoc contract matrix (incl. Dunnett determinism guard)
        working-directory: apps/web
        run: python3 scratch/posthoc_matrix.py

      # Present only once Task A (Dunnett) has landed. Guarded so this workflow can be
      # merged first without breaking the build.
      - name: Dunnett verification (skipped until Task A lands)
        working-directory: apps/web
        run: |
          if [ -f scratch/verify_dunnett.py ]; then
            python3 scratch/verify_dunnett.py
          else
            echo "scratch/verify_dunnett.py not present yet - skipping"
          fi

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install
        working-directory: apps/web
        run: npm ci
      - name: Typecheck
        working-directory: apps/web
        run: npx tsc -p tsconfig.app.json --noEmit
```

---

## IMPORTANT CAVEAT — CI runs CPython, the app runs WASM

These tests execute `analysis_engine.py` under CPython. The app runs it under Pyodide/WASM. That gap
is real and has bitten this project before: the whole `studentized_range` monkey-patch exists because
scipy's native integration misbehaves under WASM.

CI catches logic and contract regressions. It does **not** prove WASM behaviour. Note this in the
workflow file, and keep a manual browser smoke test in the release routine.

(For reference, these have already been verified in real Pyodide 0.26.1:
`studentized_range.ppf(0.95,3,12)` → `3.77293`; `_patched_sr_sf_scalar(20,3,12)` → `2.138e-8`;
`scipy.stats.dunnett` works and is 0.06 s — but is **non-deterministic without a seed**.)

---

## ACCEPTANCE CHECKLIST

- [ ] `apps/web/scratch/posthoc_matrix.py` created; running it from `apps/web` prints a matrix and
      exits non-zero if any row fails
- [ ] `apps/web/scratch/verify_fixes.py` extended with FIX3 + FIX7; **no existing threshold changed**;
      still prints `ALL CHECKS: PASS`; now exits non-zero on failure
- [ ] `.github/workflows/stats-tests.yml` created; `deploy.yml` untouched
- [ ] `git diff --stat` shows: 1 modified (`verify_fixes.py`) + 2 new files
- [ ] The determinism guard is present in `posthoc_matrix.py` and its output line is visible
- [ ] Report the **full matrix output** so the pass count AND the determinism line are visible

Do not delete or weaken a failing check to make the suite green. If a permutation fails, that is a
finding — report it.
