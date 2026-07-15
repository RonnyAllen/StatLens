"""
StatLens runtime capability audit (tests).
"""
import json, re, io, contextlib, os

ENGINE = "apps/web/src/stats/analysis_engine.py"
RECO   = "apps/web/src/stats/engine.ts"
GOLDEN = "apps/web/src/stats/__tests__/golden_values.json"
OUT    = "docs/AUDIT_MATRIX.md"

def load_engine():
    src = open(ENGINE, encoding="utf-8").read()
    src = re.sub(r"\n\s*run\(\)\s*$", "\n", src)
    ns = {}
    exec(compile(src, ENGINE, "exec"), ns)
    return ns

def get_recommender_code():
    src = open(RECO, encoding="utf-8").read()
    code_match = re.search(r'async analyzeSheet.*?const code = `(.*?)`\n    return this\.runPython', src, re.DOTALL)
    return code_match.group(1)

def run_recommender(dataset):
    code = get_recommender_code()
    ns = {"sheet_data": dataset}
    exec(compile(code, "engine.ts_reco", "exec"), ns)
    res = ns["analyze"]()
    reco = res.get("recommendation", {})
    tests = []
    if reco.get("testId") and reco.get("testId") != "None":
        tests.append(reco.get("testId"))
    tests.extend(reco.get("alternatives", []))
    return tests

def engine_dispatched_tests():
    src = open(ENGINE, encoding="utf-8").read()
    ids = set(re.findall(r'test_id == "([^"]+)"', src))
    for blk in re.findall(r'test_id\.lower\(\) in \[(.*?)\]', src, re.DOTALL):
        ids.update(re.findall(r'"([^"]+)"', blk))
    for blk in re.findall(r'test_id in \[(.*?)\]', src, re.DOTALL):
        ids.update(re.findall(r'"([^"]+)"', blk))
    for blk in re.findall(r'test_id in \((.*?)\)', src, re.DOTALL):
        ids.update(re.findall(r'"([^"]+)"', blk))
    return ids

def recommended_tests():
    src = open(RECO, encoding="utf-8").read()
    ids = set(re.findall(r'"testId":\s*"([^"]+)"', src))
    for blk in re.findall(r'"alternatives":\s*\[(.*?)\]', src, re.DOTALL):
        ids.update(re.findall(r'"([^"]+)"', blk))
    ids.discard("None")
    return ids

def run_one(ns, dataset, options):
    ns["sheet_data"] = dataset; ns["options"] = options
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            res = ns["run"]()
        if not isinstance(res, dict):
            return "invalid", "run() did not return a dict"
        err = res.get("error")
        if err:
            return "clean_error", str(err)
        rep = (res.get("report_markdown") or "").strip()
        has_result = any(res.get(k) not in (None, "", [], {})
                         for k in ("statistic", "p_value", "coefficients",
                                   "confidence_intervals", "effect_size", "post_hocs", "descriptives"))
        if rep == "Test not fully implemented yet." or (not rep and not has_result):
            return "not_impl", "engine returned the 'not implemented' shell (no error)"
        return "runs", ""
    except Exception as e:
        return "crash", f"{type(e).__name__}: {e}"

def generate_samples(golden):
    by_type = {}
    for name, case in golden.items():
        tt = case["dataset"].get("type", "")
        if tt not in by_type:
            by_type[tt] = case
            
    # Add Nested sample
    by_type["Nested"] = {
        "dataset": {
            "type": "Nested",
            "columnGroups": [{"id": "Col1", "name": "Treatment A"}, {"id": "Col2", "name": "Treatment B"}],
            "config": {"config": {"subcolumns": 2}},
            "data": [
                {"rowTitle": "A", "Col1_1": 1, "Col1_2": 2, "Col2_1": 3, "Col2_2": 4},
                {"rowTitle": "B", "Col1_1": 2, "Col1_2": 3, "Col2_1": 4, "Col2_2": 5},
                {"rowTitle": "C", "Col1_1": 1, "Col1_2": 2, "Col2_1": 3, "Col2_2": 4},
            ]
        },
        "options": {}
    }
    return by_type

def main():
    ns = load_engine()
    golden = json.load(open(GOLDEN, encoding="utf-8"))
    reco   = recommended_tests()
    dispatched = engine_dispatched_tests()
    disp_lower = {d.lower() for d in dispatched}

    by_type = generate_samples(golden)

    all_tests = sorted(reco | set(golden.keys()) | dispatched)
    rows = []
    for t in all_tests:
        if t in golden:
            t_opts = golden[t]["options"]
            test_id = t_opts.get("testId", t)
            status, msg = run_one(ns, golden[t]["dataset"], {**t_opts, "testId": test_id})
            used = golden[t]["dataset"].get("type", "?") + " (golden)"
        else:
            best = ("crash", "no runnable sample", "?")
            rank = {"runs": 4, "clean_error": 3, "not_impl": 2, "invalid": 1, "crash": 0}
            for tt, case in by_type.items():
                s, m = run_one(ns, case["dataset"], {**case["options"], "testId": t})
                if rank[s] > rank[best[0]]:
                    best = (s, m, tt)
                if s == "runs":
                    break
            status, msg, used = best
        rows.append((t, status, msg, used,
                     t in reco, t in golden, t.lower() in disp_lower))

    icon = {"runs": "✅ Runs", "clean_error": "⚠️ Clean error", "not_impl": "🚫 Not implemented (silent)", "crash": "❌ Crash", "invalid": "❌ Invalid"}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("# StatLens Runtime Audit Matrix (tests)\n\n")
        f.write("| Test ID | Runtime status | Payload | Recommended | Golden | Engine path |\n")
        f.write("|---|---|---|---|---|---|\n")
        for t, s, m, used, rec, gold, disp in rows:
            note = f" — {m[:60]}" if s in ("clean_error", "crash") else ""
            f.write(f"| {t} | {icon[s]}{note} | {used} | {'✅' if rec else '❌'} | {'✅' if gold else '❌'} | {'✅' if disp else '❌'} |\n")

    runs = [r for r in rows if r[1] == "runs"]
    crash = [r for r in rows if r[1] == "crash"]
    cerr = [r for r in rows if r[1] == "clean_error"]
    print(f"tests audited: {len(rows)}  |  runs: {len(runs)}  clean-error: {len(cerr)}  crash: {len(crash)}")

    # Consistency pass
    print("\n--- Recommender consistency ---")
    consistency_failures = 0
    for tt, case in by_type.items():
        try:
            tests = run_recommender(case["dataset"])
            for t in tests:
                s, m = run_one(ns, case["dataset"], {**case["options"], "testId": t})
                if s != "runs":
                    print(f"[{tt}] Offers '{t}' but it does NOT run: {icon[s]} {m}")
                    consistency_failures += 1
        except Exception as e:
            print(f"[{tt}] Recommender crash: {e}")
            consistency_failures += 1
            
    if consistency_failures == 0:
        print("Empty! (Consistency passed)")

if __name__ == "__main__":
    main()
