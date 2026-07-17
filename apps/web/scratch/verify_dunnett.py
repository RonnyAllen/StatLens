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
