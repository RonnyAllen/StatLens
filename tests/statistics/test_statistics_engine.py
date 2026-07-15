"""
StatLens statistical-engine safety net.

Runs the REAL analysis_engine.py in CPython against:
  1. the frozen golden_values.json oracle (regression tripwire), and
  2. a set of property-based invariants that must hold regardless of exact numbers.

Why CPython and not only the vitest/Pyodide harness: it lets CI catch library
version drift (the underscore-vs-hyphen column bugs, numpy 2.x removals,
statsmodels separation behaviour) against real numpy/scipy/statsmodels/pingouin.

Run:
    python -m pytest tests/statistics/test_statistics_engine.py -q
    # or, with no pytest installed:
    python tests/statistics/test_statistics_engine.py

Requires: numpy pandas scipy statsmodels pingouin scikit-posthocs lifelines scikit-learn
"""
import json
import io
import re
import os
import math
import contextlib
import unittest

# ---------------------------------------------------------------- path discovery
_HERE = os.path.dirname(os.path.abspath(__file__))


def _find(rel_candidates):
    """Walk up from this file to locate a repo asset by trying candidate suffixes."""
    d = _HERE
    for _ in range(8):
        for rel in rel_candidates:
            p = os.path.join(d, rel)
            if os.path.exists(p):
                return p
        d = os.path.dirname(d)
    raise FileNotFoundError(f"Could not locate any of {rel_candidates} above {_HERE}")


ENGINE_PATH = _find([
    os.path.join("apps", "web", "src", "stats", "analysis_engine.py"),
    os.path.join("src", "stats", "analysis_engine.py"),
])
GOLDEN_PATH = _find([
    os.path.join("apps", "web", "src", "stats", "__tests__", "golden_values.json"),
    os.path.join("src", "stats", "__tests__", "golden_values.json"),
])

# ---------------------------------------------------------------- engine loader
_SRC = open(ENGINE_PATH, encoding="utf-8").read()
# The engine calls run() at module scope (Pyodide sets globals first). Strip that
# single trailing invocation so we can import it and drive run() ourselves.
_SRC = re.sub(r"\n\s*run\(\)\s*$", "\n", _SRC)
_ENGINE_NS = {}
exec(compile(_SRC, ENGINE_PATH, "exec"), _ENGINE_NS)


def run_engine(dataset, options):
    """Execute the engine on one (sheet_data, options) pair; return the result dict."""
    _ENGINE_NS["sheet_data"] = dataset
    _ENGINE_NS["options"] = options
    with contextlib.redirect_stdout(io.StringIO()):
        return _ENGINE_NS["run"]()


# ---------------------------------------------------------------- comparison helpers
def _to_float(x):
    if x is None:
        return None
    if isinstance(x, bool):
        return float(x)
    if isinstance(x, (int, float)):
        return float(x)
    if isinstance(x, str):
        m = re.findall(r"-?\d+\.?\d*(?:[eE][-+]?\d+)?", x)
        if m:
            return float(m[0])
    return None


def _floats_in(x):
    if isinstance(x, (int, float)):
        return [float(x)]
    if isinstance(x, str):
        return [float(t) for t in re.findall(r"-?\d+\.?\d*(?:[eE][-+]?\d+)?", x)]
    return []


def _close(a, b, tol):
    if a is None or b is None:
        return a == b
    return abs(a - b) <= tol * max(1.0, abs(b)) + tol


def _check_case(case):
    """Return list of failure strings for one golden case ([] == pass)."""
    tol = float(str(case.get("tolerance", "1e-3")))
    exp = case["expected"]
    res = run_engine(case["dataset"], case["options"])
    if res.get("error"):
        return [f"engine error: {res['error']}"]

    fails = []
    for key in ("statistic", "p_value"):
        if exp.get(key) is not None:
            a, b = _to_float(res.get(key)), _to_float(exp[key])
            if not _close(a, b, tol):
                fails.append(f"{key}: got {a} exp {b}")

    if exp.get("degrees_of_freedom") is not None:
        ga, gb = _floats_in(res.get("degrees_of_freedom")), _floats_in(exp["degrees_of_freedom"])
        if len(ga) != len(gb) or any(not _close(x, y, max(tol, 1e-2)) for x, y in zip(ga, gb)):
            fails.append(f"dof: got {res.get('degrees_of_freedom')} exp {exp['degrees_of_freedom']}")

    if exp.get("confidence_interval") is not None:
        ci = res.get("confidence_intervals")
        if ci is None:
            fails.append("CI: got None")
        else:
            for x, y in zip(ci, exp["confidence_interval"]):
                if not _close(_to_float(x), _to_float(y), max(tol, 5e-2)):
                    fails.append(f"CI: got {ci} exp {exp['confidence_interval']}")
                    break

    if exp.get("effect_size") is not None:
        got = res.get("effect_size") or {}
        for k, v in exp["effect_size"].items():
            a = _to_float(got.get(k))
            if a is None:
                vals = [_to_float(x) for x in got.values()]
                if not any(av is not None and _close(av, _to_float(v), max(tol, 1e-2)) for av in vals):
                    fails.append(f"effect_size[{k}]: got {got} exp {v}")
            elif not _close(a, _to_float(v), max(tol, 1e-2)):
                fails.append(f"effect_size[{k}]: got {a} exp {v}")

    if exp.get("post_hocs"):
        comps = (res.get("post_hocs") or {}).get("comparisons", [])

        def find_p(pair):
            g1, g2 = [s.strip() for s in pair.split(" vs ")]
            for c in comps:
                if {str(c.get("group1")), str(c.get("group2"))} == {g1, g2}:
                    return c.get("p_value")
            return "MISSING"

        for pair, pexp in exp["post_hocs"].items():
            pgot = find_p(pair)
            if pgot == "MISSING":
                fails.append(f"posthoc[{pair}]: MISSING")
            elif isinstance(pgot, str) and "<" in pgot:
                if not (_to_float(pexp) <= _to_float(pgot)):
                    fails.append(f"posthoc[{pair}]: got {pgot} exp {pexp}")
            elif not _close(_to_float(pgot), _to_float(pexp), max(tol, 1e-3)):
                fails.append(f"posthoc[{pair}]: got {pgot} exp {pexp}")

    if exp.get("report_contains"):
        rep = res.get("report_markdown", "") or ""
        needles = exp["report_contains"]
        if isinstance(needles, str):
            needles = [needles]
        for nd in needles:
            if nd not in rep:
                fails.append(f"report missing '{nd}'")

    return fails


# ================================================================ golden regression
_GOLDEN = json.load(open(GOLDEN_PATH, encoding="utf-8"))

# Cases with a known, documented open issue may be listed here with a reason so the
# suite stays green while the decision is pending. Remove once resolved.
KNOWN_OPEN = {
    # Empty: Simple Logistic Regression separation handling is fixed and enforced.
    # Add entries here only for genuinely-pending decisions, with a reason.
}


class TestGoldenValues(unittest.TestCase):
    """Every frozen oracle case must reproduce under CPython + current libraries."""


def _make_golden_test(name, case):
    def test(self):
        fails = _check_case(case)
        if name in KNOWN_OPEN and fails:
            self.skipTest(f"{name}: KNOWN OPEN — {KNOWN_OPEN[name]} ({fails})")
        self.assertEqual(fails, [], msg=f"{name}: " + "; ".join(fails))
    return test


for _name, _case in _GOLDEN.items():
    _slug = re.sub(r"\W+", "_", _name).strip("_")
    setattr(TestGoldenValues, f"test_golden_{_slug}", _make_golden_test(_name, _case))


# ================================================================ regression locks
class TestRegressionLocks(unittest.TestCase):
    """Pin previously-fixed bugs so they cannot silently return."""

    def test_two_way_anova_populates_scalar_pvalue(self):
        """Two-way ANOVA must set top-level statistic/p_value (row factor), not leave None.
        Regression for the `src == factor1_col` (display-name vs id) comparison bug."""
        case = _GOLDEN["Two-way ANOVA Type III Unbalanced"]
        res = run_engine(case["dataset"], case["options"])
        self.assertIsNotNone(res.get("p_value"), "two-way ANOVA left p_value=None")
        self.assertIsNotNone(res.get("statistic"), "two-way ANOVA left statistic=None")
        self.assertAlmostEqual(_to_float(res["p_value"]), 0.006682, places=4)
        self.assertAlmostEqual(_to_float(res["statistic"]), 14.4687, places=3)

    # ---- Prism-parity locks (values confirmed against real GraphPad Prism) ----

    def test_mann_whitney_exact_with_ties_matches_prism(self):
        """Small-n Mann-Whitney must use the exact-with-ties P (Prism = 0.2619),
        not scipy's asymptotic 0.2547. Lock for the _mwu_exact_p path."""
        ds = _column_dataset({"Control": [5, 7, 7, 9, 11, 8], "Treated": [7, 9, 9, 12, 10, 8]})
        res = run_engine(ds, {"testId": "Mann-Whitney test", "postHocFamily": "none", "postHocTest": "none"})
        self.assertAlmostEqual(_to_float(res["statistic"]), 10.5, places=3, msg="U must be 10.5")
        self.assertAlmostEqual(_to_float(res["p_value"]), 0.2619, places=4,
                               msg="MWU with ties must equal Prism's exact 0.2619, not the asymptotic 0.2547")

    def test_mann_whitney_large_n_stays_asymptotic(self):
        """Above the exact threshold (n>16) MWU must keep the asymptotic P — this both
        matches the frozen golden and guards against the exact enumeration firing on large n."""
        case = _GOLDEN["Mann-Whitney test"]  # n=20
        res = run_engine(case["dataset"], case["options"])
        self.assertAlmostEqual(_to_float(res["p_value"]), 0.06933, places=4,
                               msg="large-n MWU must remain on the asymptotic path (0.06933)")

    def test_spearman_exact_matches_prism(self):
        """Small-n Spearman must use the exact permutation P (Prism = 0.0009),
        not scipy's t-approximation 0.000124. Lock for the _spearman_exact_p path."""
        ds = _xy_dataset([1, 2, 2, 4, 5, 5, 7, 8], [2, 3, 3, 3, 6, 7, 7, 9])
        res = run_engine(ds, {"testId": "Correlation (Spearman)", "postHocFamily": "none", "postHocTest": "none"})
        self.assertAlmostEqual(_to_float(res["statistic"]), 0.9629, places=3, msg="rho must be 0.9629")
        self.assertAlmostEqual(_to_float(res["p_value"]), 0.0009, places=4,
                               msg="Spearman with ties must equal Prism's exact 0.0009, not the t-approx 0.000124")

    def test_wilcoxon_W_is_signed_rank_sum_prism_convention(self):
        """Wilcoxon W must be Prism's signed-rank sum (W+ - W-), not scipy's smaller rank sum.
        Case 1 (no ties): W+ = 26, W- = 10 -> W = 16."""
        ds = _column_dataset({"Before": [14, 11, 16, 13, 9, 15, 18, 12],
                              "After": [16, 14, 15, 20, 5, 21, 27, 7]})
        res = run_engine(ds, {"testId": "Wilcoxon matched-pairs signed rank test",
                              "postHocFamily": "none", "postHocTest": "none"})
        self.assertAlmostEqual(_to_float(res["statistic"]), 16.0, places=3,
                               msg="Wilcoxon W must be the signed-rank sum (16), Prism convention")
        ranks = res.get("wilcoxon_ranks") or {}
        self.assertAlmostEqual(_to_float(ranks.get("W_positive")), 26.0, places=3)
        self.assertAlmostEqual(_to_float(ranks.get("W_negative")), 10.0, places=3)
        self.assertAlmostEqual(_to_float(res["p_value"]), 0.3125, places=4, msg="P must stay 0.3125")

    def test_wilcoxon_golden_uses_signed_rank_convention(self):
        """The frozen Wilcoxon case must now report W = 45 (signed-rank sum).
        NOTE: golden_values.json must set this case's expected 'statistic' to 45 (was 0)."""
        case = _GOLDEN["Wilcoxon matched-pairs signed rank test"]
        res = run_engine(case["dataset"], case["options"])
        self.assertAlmostEqual(_to_float(res["statistic"]), 45.0, places=3,
                               msg="golden Wilcoxon W must be 45 (signed-rank sum); update golden_values.json to 45")

    def test_wilcoxon_p_matches_prism_with_ties(self):
        """Wilcoxon P with ties+zeros must match Prism exactly (Case 2b = 0.6250)."""
        ds = _column_dataset({"Before": [14, 11, 16, 13, 9, 15, 18, 12],
                              "After": [14, 13, 18, 11, 14, 15, 13, 15]})
        res = run_engine(ds, {"testId": "Wilcoxon matched-pairs signed rank test",
                              "postHocFamily": "none", "postHocTest": "none"})
        self.assertAlmostEqual(_to_float(res["p_value"]), 0.6250, places=4)

    def test_degenerate_inputs_return_clean_messages(self):
        """Undefined-for-this-data cases must return a clear error, never a leaked Python
        internal like \"'<' not supported between ... NoneType\" or a bare KeyError \"'F'\"."""
        cryptic = ("not supported between", "invalid index to scalar", "NoneType")
        cases = [
            ("n=1 vs n=1 t-test", _column_dataset({"A": [1], "B": [5]}),
             {"testId": "Unpaired t test", "postHocFamily": "none", "postHocTest": "none"}),
            ("both groups constant", _column_dataset({"A": [5, 5, 5], "B": [3, 3, 3]}),
             {"testId": "Unpaired t test", "postHocFamily": "none", "postHocTest": "none"}),
            ("one-way ANOVA k=1", _column_dataset({"A": [1, 2, 3, 4]}),
             {"testId": "Ordinary One-way ANOVA", "postHocFamily": "none", "postHocTest": "none"}),
        ]
        for label, ds, opt in cases:
            res = run_engine(ds, opt)
            err = res.get("error")
            self.assertIsNotNone(err, f"{label}: expected a clean error message, got none")
            for frag in cryptic:
                self.assertNotIn(frag, err, f"{label}: leaked cryptic internal '{frag}' in error")

    def test_multiple_linear_exposes_coefficients(self):
        """Multiple Linear Regression must expose structured coefficients for the CI-forest plot."""
        res = run_engine(_GOLDEN["Multiple Linear Regression"]["dataset"], _GOLDEN["Multiple Linear Regression"]["options"])
        coefs = res.get("coefficients")
        self.assertIsNotNone(coefs, "coefficients field missing")
        by = {c["label"]: c for c in coefs}
        self.assertIn("X1", by); self.assertIn("X2", by)
        self.assertAlmostEqual(_to_float(by["X1"]["estimate"]), 0.8333, places=3)
        self.assertAlmostEqual(_to_float(by["X2"]["estimate"]), 1.1667, places=3)
        self.assertAlmostEqual(_to_float(by["X2"]["ci_low"]), 0.2608, places=3)
        self.assertAlmostEqual(_to_float(by["X2"]["ci_high"]), 2.0725, places=3)

    def test_poisson_exposes_coefficients(self):
        """Poisson Regression must expose structured coefficients (log scale) with CIs."""
        res = run_engine(_GOLDEN["Poisson Regression"]["dataset"], _GOLDEN["Poisson Regression"]["options"])
        coefs = res.get("coefficients")
        self.assertIsNotNone(coefs)
        by = {c["label"]: c for c in coefs}
        self.assertIn("X", by)
        self.assertAlmostEqual(_to_float(by["X"]["estimate"]), 0.3587, places=3)
        self.assertAlmostEqual(_to_float(by["X"]["ci_low"]), 0.2113, places=3)
        self.assertAlmostEqual(_to_float(by["X"]["ci_high"]), 0.506, places=3)


# ================================================================ property-based
def _column_dataset(groups_named):
    """Build a Column-table sheet_data from {name: [values]}."""
    names = list(groups_named)
    cols = [{"id": n, "name": n} for n in names]
    maxlen = max(len(v) for v in groups_named.values())
    rows = []
    for i in range(maxlen):
        row = {"rowTitle": str(i + 1)}
        for n in names:
            if i < len(groups_named[n]):
                row[n] = groups_named[n][i]
        rows.append(row)
    return {"type": "Column", "columnGroups": cols, "data": rows, "config": {"replicates": 1}}


def _contingency_dataset(matrix, col_names=("Out1", "Out2")):
    cols = [{"id": c, "name": c} for c in col_names]
    rows = []
    for i, r in enumerate(matrix):
        row = {"rowTitle": f"R{i+1}"}
        for c, v in zip(col_names, r):
            row[c] = v
        rows.append(row)
    return {"type": "Contingency", "columnGroups": cols, "data": rows, "config": {"replicates": 1}}


def _xy_dataset(xs, ys):
    """Build an XY-table sheet_data (rowTitle = X, single Y column)."""
    return {"type": "XY", "columnGroups": [{"id": "Y", "name": "Y"}],
            "data": [{"rowTitle": float(x), "Y": float(y)} for x, y in zip(xs, ys)],
            "config": {"replicates": 1}}


class TestProperties(unittest.TestCase):
    """Invariants that must hold irrespective of the exact frozen numbers."""

    A = [1.2, 1.4, 2.1, 0.9, 1.7]
    B = [2.0, 2.5, 1.8, 2.2, 2.1, 3.0]
    C = [3.1, 3.2, 3.3, 2.9, 3.4]

    def test_unpaired_t_sign_flips_on_group_swap(self):
        opt = {"testId": "Unpaired t test", "postHocFamily": "none", "postHocTest": "none"}
        ab = run_engine(_column_dataset({"A": self.A, "B": self.B}), opt)
        ba = run_engine(_column_dataset({"B": self.B, "A": self.A}), opt)
        self.assertAlmostEqual(ab["statistic"], -ba["statistic"], places=6,
                               msg="t statistic must negate when the two groups are swapped")
        self.assertAlmostEqual(ab["p_value"], ba["p_value"], places=9,
                               msg="two-sided p must be invariant to group order")

    def test_oneway_anova_invariant_to_group_order(self):
        opt = {"testId": "Ordinary One-way ANOVA", "postHocFamily": "none", "postHocTest": "none"}
        r1 = run_engine(_column_dataset({"A": self.A, "B": self.B, "C": self.C}), opt)
        r2 = run_engine(_column_dataset({"C": self.C, "A": self.A, "B": self.B}), opt)
        self.assertAlmostEqual(r1["statistic"], r2["statistic"], places=6,
                               msg="one-way ANOVA F must not depend on column order")
        self.assertAlmostEqual(r1["p_value"], r2["p_value"], places=9)

    def test_tukey_pvalue_symmetric_under_group_order(self):
        opt = {"testId": "Ordinary One-way ANOVA", "postHocFamily": "all_pairs", "postHocTest": "Tukey HSD"}
        r1 = run_engine(_column_dataset({"A": self.A, "B": self.B, "C": self.C}), opt)
        r2 = run_engine(_column_dataset({"C": self.C, "B": self.B, "A": self.A}), opt)

        def pmap(res):
            return {frozenset((c["group1"], c["group2"])): _to_float(c["p_value"])
                    for c in res["post_hocs"]["comparisons"]}
        m1, m2 = pmap(r1), pmap(r2)
        self.assertEqual(set(m1), set(m2), "same pairs must appear regardless of order")
        for k in m1:
            self.assertAlmostEqual(m1[k], m2[k], places=6,
                                   msg=f"Tukey p for {tuple(k)} must be order-invariant")

    def test_chi_square_invariant_to_row_permutation(self):
        opt = {"testId": "Chi-square test", "postHocFamily": "none", "postHocTest": "none"}
        m = [[18, 52], [40, 119], [58, 172], [81, 243]]
        r1 = run_engine(_contingency_dataset(m), opt)
        r2 = run_engine(_contingency_dataset(list(reversed(m))), opt)
        self.assertAlmostEqual(r1["statistic"], r2["statistic"], places=6,
                               msg="chi-square must be invariant to row ordering")
        self.assertAlmostEqual(r1["p_value"], r2["p_value"], places=9)

    def test_mann_whitney_invariant_pvalue_on_swap(self):
        opt = {"testId": "Mann-Whitney test", "postHocFamily": "none", "postHocTest": "none"}
        ab = run_engine(_column_dataset({"A": self.A, "B": self.B}), opt)
        ba = run_engine(_column_dataset({"B": self.B, "A": self.A}), opt)
        self.assertAlmostEqual(ab["p_value"], ba["p_value"], places=9,
                               msg="Mann-Whitney two-sided p must be invariant to group order")

    def test_deming_slope_sign_matches_covariance(self):
        # Positively-correlated XY -> positive Deming slope.
        xs = list(range(1, 9))
        ys = [1.0, 3.2, 2.8, 5.1, 4.4, 7.0, 6.1, 9.2]
        cols = [{"id": "Y", "name": "Y"}]
        rows = [{"rowTitle": str(x), "Y": y} for x, y in zip(xs, ys)]
        ds = {"type": "XY", "columnGroups": cols, "data": rows, "config": {"replicates": 1}}
        res = run_engine(ds, {"testId": "Deming Regression", "postHocFamily": "none", "postHocTest": "none"})
        # slope is reported in the markdown; pull the first number after "slope"
        rep = res.get("report_markdown", "")
        # Deming report renders "... Y = <slope>*X + <intercept>"; parse the equation.
        m = re.search(r"=\s*(-?\d+\.?\d*)\s*\*\s*X", rep)
        self.assertIsNotNone(m, f"could not find slope in report: {rep[:200]}")
        self.assertGreater(float(m.group(1)), 0, "Deming slope must be positive for positively-correlated data")


class TestThreeWayAnovaGuard(unittest.TestCase):
    """Three-way ANOVA must compute on categorical factors, and refuse continuous
    data with a clear, actionable message rather than a cryptic statsmodels f_test error."""

    def test_three_way_anova_computes_on_categorical(self):
        case = _GOLDEN["Three-way ANOVA"]
        res = run_engine(case["dataset"], case["options"])
        self.assertFalse(res.get("error"),
                         f"categorical three-way ANOVA should compute, got error: {res.get('error')}")

    def test_three_way_anova_rejects_continuous_with_clear_message(self):
        ds = {"type": "MultipleVariables",
              "columnGroups": [{"id": n, "name": n} for n in ["A", "B", "C", "Y"]],
              "data": [{"A": i, "B": i * 2, "C": i * 3, "Y": i + 0.5} for i in range(1, 13)]}
        res = run_engine(ds, {"testId": "Three-way ANOVA"})
        err = res.get("error", "") or ""
        self.assertTrue(err, "continuous data must be rejected with an error")
        self.assertIn("categorical", err.lower(),
                      f"error should explain the categorical requirement, got: {err}")
        self.assertIn("Multiple Linear Regression", err,
                      f"error should point to the right test, got: {err}")
        self.assertNotIn("r_matrix", err,
                         f"must not surface the raw statsmodels error, got: {err}")


if __name__ == "__main__":
    unittest.main(verbosity=2)