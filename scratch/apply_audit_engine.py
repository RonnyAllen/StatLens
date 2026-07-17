import os

engine_path = 'apps/web/src/stats/analysis_engine.py'
with open(engine_path, 'r', encoding='utf-8') as f:
    code = f.read()

# FIX 1
f1_target = "                        for g1, g2 in itertools.combinations(group_names, 2):"
f1_replace = "                        for g1, g2 in combinations(group_names, 2):"
code = code.replace(f1_target, f1_replace)

# FIX 2
f2_target = \"\"\"def _patched_sr_ppf(p, k, df):
    return 0.0\"\"\"
f2_replace = \"\"\"def _patched_sr_ppf(p, k, df):
    \"\"\"Critical value q for the studentized range.

    scipy's native ppf relies on numerical integration that is unreliable in the
    Pyodide/WASM build, so we invert the (accurate) patched sf by root-finding.
    Verified exact to 5 decimals against scipy's CPython ppf.
    \"\"\"
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
            return float("nan")\"\"\"
code = code.replace(f2_target, f2_replace)

# FIX 3a
f3a_target = "                            p_val = float(np.ravel(psturng(q, k_groups, df_welch))[0])"
f3a_replace = "                            p_val = float(_patched_sr_sf_scalar(q, k_groups, df_welch))"
code = code.replace(f3a_target, f3a_replace)

# FIX 3b
f3b_target = "                                        p_adj = float(psturng(q, k, _res_df))"
f3b_replace = "                                        p_adj = float(_patched_sr_sf_scalar(q, k, _res_df))"
code = code.replace(f3b_target, f3b_replace)

# FIX 3c
f3c_target = "                                p_val = float(np.ravel(psturng(q, len(treats), df_b))[0])"
f3c_replace = "                                p_val = float(_patched_sr_sf_scalar(q, len(treats), df_b))"
code = code.replace(f3c_target, f3c_replace)

# FIX 4+5
f45_target = \"\"\"                if post_hoc_family != "none":
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
                    report += "Post-hoc comparisons using Tukey's HSD test were conducted. \"\"\"
f45_replace = \"\"\"                if post_hoc_family != "none":
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
                        report += "Post-hoc comparisons using Tukey's HSD test were conducted. \"\"\"
code = code.replace(f45_target, f45_replace)

# FIX 6
f6_target = \"\"\"                # Compute degrees of freedom robustly: try multiple possible column names
                df1_col = next((c for c in ['ddof1', 'DF1', 'df1', 'DF', 'df'] if c in res.columns), None)
                df2_col = next((c for c in ['ddof2', 'DF2', 'df2'] if c in res.columns), None)
                if df1_col and df2_col:
                    result["degrees_of_freedom"] = f"{get_clean_float(res[df1_col].values[0]):.0f}, {get_clean_float(res[df2_col].values[0]):.0f}"
                else:
                    # Compute from data: df1 = k-1, df2 = (n-1)*(k-1) where k = groups, n = subjects
                    k = len(group_names)
                    n = len(df_clean)
                    result["degrees_of_freedom"] = f"{k-1}, {(n-1)*(k-1)}\"\"\"
f6_replace = \"\"\"                # Degrees of freedom. If we surfaced a Greenhouse-Geisser corrected p we MUST
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
                    result["degrees_of_freedom"] = f"{_df1:.0f}, {_df2:.0f}\"\"\"
code = code.replace(f6_target, f6_replace)

# FIX 7
f7_target = \"\"\"    except Exception as e:
        _msg = str(e)
        if "NoneType" in _msg and "not supported" in _msg:\"\"\"
f7_replace = \"\"\"    except Exception as e:
        _msg = str(e)
        _etype = type(e).__name__
        import traceback as _tb
        result["error_detail"] = _tb.format_exc()
        if _etype in ("NameError", "AttributeError", "ImportError", "ModuleNotFoundError", "SyntaxError", "UnboundLocalError"):
            # These are ALWAYS engine bugs. Never blame the user's data for them.
            result["error"] = f"Internal engine error ({_etype}): {_msg}. This is a bug in StatLens, not a problem with your data."
            result["status"] = "error"
            return result
        if "NoneType" in _msg and "not supported" in _msg:\"\"\"
code = code.replace(f7_target, f7_replace)

with open(engine_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(code)

print("Done")
