import re, io, contextlib, numpy as np, sys
P = "src/stats/analysis_engine.py"          # adjust path if run from elsewhere
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
t5 = m == "Pairwise t-tests, pooled SD (Holm-adjusted, selected pairs)" and len(comps) == 1 and abs(comps[0]["p_value"]-4.0167574e-07) < 1e-10
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

print("\nALL CHECKS:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
