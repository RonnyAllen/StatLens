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
ui_methods = set(re.findall(r'"((?:Tukey|Dunnett|Games-Howell|Dunn\'s|Bonferroni|\u0160\u00edd\u00e1k|Holm|Pairwise)[^"\n]*)"', ui_text))
ui_methods = {m for m in ui_methods if len(m) > 3 and "Logrank" not in m}

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
    "Dunn's test":                          [("Kruskal-Wallis test", "all_pairwise"), ("Kruskal-Wallis test", "control_vs_others"), ("Kruskal-Wallis test", "specific_pairs")],
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
