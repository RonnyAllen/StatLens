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
    ("Ordinary One-way ANOVA", "Bonferroni",  "all_pairwise",   "Bonferroni"),
    ("Ordinary One-way ANOVA", "Šídák",      "all_pairwise",   "Šídák"),
    ("Ordinary One-way ANOVA", "Holm-Šídák", "all_pairwise",   "Holm-Šídák"),
    ("Ordinary One-way ANOVA", "Bonferroni",  "specific_pairs", "Bonferroni"),
    ("Welch's ANOVA",          "Games-Howell test",                     "all_pairwise",      "Games-Howell"),
    ("Welch's ANOVA",          "Dunnett's T3 test",                     "all_pairwise",      "T3"),
    ("Welch's ANOVA",          "Dunnett's T3 test",                     "control_vs_others", "T3"),
    ("Brown-Forsythe ANOVA",   "Games-Howell test",                     "all_pairwise",      "Games-Howell"),
    ("Brown-Forsythe ANOVA",   "Dunnett's T3 test",                     "control_vs_others", "T3"),
    ("Kruskal-Wallis test",    "Dunn's test",                           "all_pairwise",      "Dunn"),
    ("Kruskal-Wallis test",    "Dunn's test",                           "control_vs_others", "Dunn"),
    ("Kruskal-Wallis test",    "Dunn's test",                           "specific_pairs",    "Dunn"),
    ("Welch and Brown-Forsythe ANOVA (Combinatory)", "Games-Howell test", "all_pairwise", "Games-Howell"),
    ("Welch and Brown-Forsythe ANOVA (Combinatory)", "Dunnett's T3 test", "all_pairwise", "T3"),
    ("Welch and Brown-Forsythe ANOVA (Combinatory)", "Dunnett's T3 test", "control_vs_others", "T3"),
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

sys.exit(1 if failures else 0)
