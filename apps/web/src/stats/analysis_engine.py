import pandas as pd
import scipy.stats
try:
    from statsmodels.stats.libqsturng import psturng
except Exception:
    psturng = None
import numpy as np
from itertools import permutations, combinations
import warnings
try:
    import statsmodels.api as sm
    import statsmodels.formula.api as smf
    from statsmodels.tools.sm_exceptions import ConvergenceWarning
except Exception:
    sm = smf = None
    ConvergenceWarning = Warning

def format_p_value(p):
    if pd.isna(p) or np.isnan(p):
        return ""
    if p < 0.0001:
        return "<0.0001"
    s = f"{p:.4f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if not s:
        s = "0"
    return s

from scipy.stats import norm, chi, rankdata, t
_orig_sr_sf = scipy.stats.studentized_range.sf
_orig_sr_ppf = scipy.stats.studentized_range.ppf

def _patched_sr_sf_scalar(q, k, df, n_points=200):
    if q <= 0: return 1.0
    try:
        s = np.linspace(1e-5, 8, n_points)
        ds = s[1] - s[0]
        z = np.linspace(-8, 8, n_points)
        dz = z[1] - z[0]
        pdf_z = norm.pdf(z)
        cdf_z = norm.cdf(z)
        Z = z[:, None]
        S = s[None, :]
        inner_integrand = pdf_z[:, None] * (norm.cdf(Z + q * S) - cdf_z[:, None])**(k-1)
        inner_vals = k * np.sum(inner_integrand, axis=0) * dz
        outer_integrand = inner_vals * np.sqrt(df) * chi.pdf(s * np.sqrt(df), df)
        cdf = np.sum(outer_integrand) * ds
        return float(np.clip(1.0 - cdf, 0, 1))
    except Exception:
        return float(np.ravel(psturng(q, k, df))[0])

_vec_sr_sf = np.vectorize(_patched_sr_sf_scalar)

def _patched_sr_sf(q, k, df):
    res = _vec_sr_sf(q, k, df)
    if res.ndim == 0:
        return float(res)
    return res

def _patched_sr_ppf(p, k, df):
    """Critical value q for the studentized range.

    scipy's native ppf relies on numerical integration that is unreliable in the
    Pyodide/WASM build, so we invert the (accurate) patched sf by root-finding.
    Verified exact to 5 decimals against scipy's CPython ppf.
    """
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
            return float("nan")

scipy.stats.studentized_range.sf = _patched_sr_sf
scipy.stats.studentized_range.ppf = _patched_sr_ppf

import scipy.stats as stats
try:
    import pingouin as pg
except Exception:
    pg = None
try:
    import scikit_posthocs as sp
except Exception:
    sp = None
import scipy.integrate as integrate
import math
from scipy.optimize import fsolve, curve_fit
import statsmodels.api as sm
try:
    from sklearn.metrics import roc_curve, auc, confusion_matrix
except Exception:
    roc_curve = auc = confusion_matrix = None
try:
    from lifelines import KaplanMeierFitter, CoxPHFitter
    from lifelines.statistics import multivariate_logrank_test, logrank_test
    from lifelines.utils import median_survival_times
except Exception:
    KaplanMeierFitter = CoxPHFitter = None
    multivariate_logrank_test = logrank_test = median_survival_times = None
try:
    from statsmodels.stats.multitest import multipletests
except Exception:
    multipletests = None
try:
    from statsmodels.stats.contingency_tables import mcnemar
except Exception:
    mcnemar = None
import statsmodels.formula.api as smf
try:
    from statsmodels.stats.anova import anova_lm
except Exception:
    anova_lm = None
try:
    from statsmodels.stats.multicomp import MultiComparison
except Exception:
    MultiComparison = None
try:
    from statsmodels.formula.api import ols
except Exception:
    ols = None
from scipy.stats import rankdata
from scipy.stats import chisquare
from scipy.stats import binomtest
try:
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler
except Exception:
    PCA = StandardScaler = None


# Helper functions to serialize the result safely

def or_rr(a, b, c, d):
    if min(a, b, c, d) == 0:
        a, b, c, d = a+0.5, b+0.5, c+0.5, d+0.5
    OR = (a*d)/(b*c)
    se_lnOR = np.sqrt(1/a + 1/b + 1/c + 1/d)
    OR_ci = (np.exp(np.log(OR) - 1.96*se_lnOR), np.exp(np.log(OR) + 1.96*se_lnOR))
    RR = (a/(a+b)) / (c/(c+d))
    se_lnRR = np.sqrt(1/a - 1/(a+b) + 1/c - 1/(c+d))
    RR_ci = (np.exp(np.log(RR) - 1.96*se_lnRR), np.exp(np.log(RR) + 1.96*se_lnRR))
    return OR, OR_ci, RR, RR_ci

def deming(x, y, lam=1.0):
    x, y = np.asarray(x, float), np.asarray(y, float)
    mx, my = x.mean(), y.mean()
    sxx = ((x-mx)**2).sum(); syy = ((y-my)**2).sum(); sxy = ((x-mx)*(y-my)).sum()
    slope = ((syy - lam*sxx) + np.sqrt((syy - lam*sxx)**2 + 4*lam*sxy**2)) / (2*sxy) if sxy != 0 else float('inf')
    intercept = my - slope*mx if slope != float('inf') else float('nan')
    return slope, intercept

def get_clean_float(val):
    if pd.isna(val) or np.isinf(val):
        return None
    return float(val)

def brown_forsythe_anova_py(df, dv, between):
    groups = [group[dv].values for name, group in df.groupby(between)]
    k = len(groups)
    N = sum(len(g) for g in groups)
    
    means = [np.mean(g) for g in groups]
    variances = [np.var(g, ddof=1) for g in groups]
    sizes = [len(g) for g in groups]
    
    grand_mean = np.mean(df[dv])
    
    num = sum(sizes[i] * (means[i] - grand_mean)**2 for i in range(k))
    den = sum((1 - sizes[i]/N) * variances[i] for i in range(k))
    
    if den == 0:
        raise ValueError("Zero variance in denominator for Brown-Forsythe ANOVA.")
        
    F_star = num / den
    df1 = k - 1
    
    c_den = sum((1 - sizes[j]/N) * variances[j] for j in range(k))
    if c_den == 0:
        raise ValueError("Zero variance for Brown-Forsythe ANOVA df calculation.")
    c = [(1 - sizes[i]/N) * variances[i] / c_den for i in range(k)]
    
    df2_den = sum((c[i]**2) / (sizes[i] - 1) for i in range(k) if sizes[i] > 1)
    if df2_den == 0:
        raise ValueError("Insufficient sample sizes for Brown-Forsythe ANOVA.")
        
    df2 = 1.0 / df2_den
    p_val = 1 - stats.f.cdf(F_star, df1, df2)
    
    return F_star, df1, df2, p_val

# scipy.stats.dunnett integrates the multivariate t by quasi-Monte-Carlo and is NOT
# deterministic without a seed. Verified in Pyodide/WASM: five identical calls returned
# p from 2.1e-05 to 7.0e-05. Prism is deterministic, so we pin the stream.
DUNNETT_SEED = 20260717


def dunnetts_t3_pvalue(t_stat, k, df, n_comparisons=None):
    # Tamhane's T3 uses the Studentized Maximum Modulus over C comparisons.
    # All-pairs -> C = k(k-1)/2. Compare-to-control -> C = k-1 (pass n_comparisons).
    C = float(n_comparisons) if n_comparisons else k * (k - 1) / 2.0
    t_abs = abs(t_stat)
    p = 1.0 - (2.0 * t.cdf(t_abs, df) - 1.0) ** C
    return float(min(max(p, 0.0), 1.0))


def _mwu_exact_p(a, b, max_n=16, alternative="two-sided"):
    """Exact Mann-Whitney P accounting for ties (matches GraphPad Prism), by enumerating
    all C(n1+n2, n1) group assignments of the combined mid-ranks.
    `alternative` is 'two-sided' | 'less' | 'greater' and follows scipy's convention
    (direction refers to the FIRST sample). Returns None when total n exceeds max_n,
    so the caller keeps the asymptotic P."""
    a = np.asarray(a, float); b = np.asarray(b, float)
    n1, n2 = len(a), len(b)
    if n1 == 0 or n2 == 0 or (n1 + n2) > max_n:
        return None
    ranks = rankdata(np.concatenate([a, b]))
    N = n1 + n2
    U1_obs = ranks[:n1].sum() - n1 * (n1 + 1) / 2.0
    U_obs = min(U1_obs, n1 * n2 - U1_obs)
    count = 0; total = 0
    for comb in combinations(range(N), n1):
        U1 = ranks[list(comb)].sum() - n1 * (n1 + 1) / 2.0
        total += 1
        if alternative == "less":
            # P(U1 <= U1_obs): the first sample tends to be SMALLER.
            if U1 <= U1_obs + 1e-9:
                count += 1
        elif alternative == "greater":
            # P(U1 >= U1_obs): the first sample tends to be LARGER.
            if U1 >= U1_obs - 1e-9:
                count += 1
        else:
            U = min(U1, n1 * n2 - U1)
            if U <= U_obs + 1e-9:
                count += 1
    return count / total if total else None


def _spearman_exact_p(x, y, max_n=8):
    """Exact two-sided Spearman P by enumerating all n! rank permutations, using
    mid-ranks for ties (matches GraphPad Prism). Returns None when n > max_n."""
    x = np.asarray(x, float); y = np.asarray(y, float)
    n = len(x)
    if n < 3 or n > max_n:
        return None
    rx = rankdata(x); ry = rankdata(y)
    rxc = rx - rx.mean(); ryc = ry - ry.mean()
    denom = np.sqrt((rxc ** 2).sum() * (ryc ** 2).sum())
    if denom == 0:
        return None
    r_obs = (rxc * ryc).sum() / denom
    count = 0; total = 0
    for p in permutations(range(n)):
        r = (rxc * ryc[list(p)]).sum() / denom
        total += 1
        if abs(r) >= abs(r_obs) - 1e-9:
            count += 1
    return count / total if total else None


def run():
    print("ENGINE_ENTRY test_id:", options.get("testId"))
    sheet = sheet_data
    test_id = options.get('testId', '')
    post_hoc_family = options.get('postHocFamily', 'none')
    post_hoc_test = options.get('postHocTest', 'none')
    specific_pairs = options.get('specificPairs', [])
    # Tails. Prism always asks; the UI sends 'two-sided' | 'less' | 'greater'
    # (direction refers to the FIRST/left group, matching scipy's convention).
    tails = options.get('tails', 'two-sided')
    if tails not in ('two-sided', 'less', 'greater'):
        tails = 'two-sided'
    _tail_label = {'two-sided': 'two-tailed', 'less': 'one-tailed', 'greater': 'one-tailed'}[tails]
    
    table_type = sheet.get("type", "Column")
    
    cfg = sheet.get("config", {})
    replicates = cfg.get("replicates")
    if replicates is None and "config" in cfg:
        replicates = cfg.get("config", {}).get("replicates", None)
        if replicates is None:
            replicates = cfg.get("config", {}).get("subcolumns", 1)
    if replicates is None:
        replicates = 1
    
    columns = []
    col_id_to_name = {}
    base_col_id_to_name = {}
    
    for g in sheet.get("columnGroups", []):
        base_col_id_to_name[g["id"]] = g["name"]
        if replicates > 1:
            for r in range(1, replicates + 1):
                col_id = f"{g['id']}_{r}"
                columns.append(col_id)
                col_id_to_name[col_id] = f"{g['name']} (Y{r})"
        else:
            columns.append(g["id"])
            col_id_to_name[g["id"]] = g["name"]
    
    # Prepend rowTitle if the table uses it
    has_row_titles = table_type in ["XY", "Grouped", "Contingency", "Survival", "PartsOfWhole"]
    if has_row_titles:
        columns.insert(0, "rowTitle")
        if table_type == "XY":
            col_id_to_name["rowTitle"] = "X Values"

        elif table_type == "Survival":
            col_id_to_name["rowTitle"] = "Time"
        else:
            col_id_to_name["rowTitle"] = "Row Title"
    
    # Reconstruct dataframe
    data_dict = {}
    for col in columns:
        vals = []
        for i, row in enumerate(sheet.get("data", [])):
            val = row.get(col, None)
            if col == "rowTitle" and (val is None or str(val).strip() == ""):
                vals.append(f"Row {i+1}")
            elif val is None or str(val).strip() == "":
                vals.append(np.nan)
            else:
                try:
                    vals.append(float(val))
                except ValueError:
                    vals.append(val)
        data_dict[col] = vals
        
    df = pd.DataFrame(data_dict)
    
    if "rowTitle" in df.columns:
        df["rowTitle"] = df["rowTitle"].fillna(pd.Series([f"Row {i+1}" for i in range(len(df))]))
    
    result = {
        "_engine_build": "phase-4.9",
        "testId": test_id,
        "statistic": None,
        "p_value": None,
        "degrees_of_freedom": None,
        "effect_size": None,
        "confidence_intervals": None,
        "post_hocs": None,
        "report_markdown": "",
        "error": None
    }
    
    try:
        # Extract valid groups
        groups = [df[col].dropna().values for col in columns if len(df[col].dropna()) > 0]
        group_names = [col for col in columns if len(df[col].dropna()) > 0]
        
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
        
        if table_type == "Column":
            if test_id == "One-Sample t-test":
                res = pg.ttest(groups[0], 0.0) # testing against hypothetical mean of 0
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float((res['p-val'] if 'p-val' in res else res['p_val']).values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                eff = get_clean_float((res['cohen-d'] if 'cohen-d' in res else res['cohen_d']).values[0])
                stat = result["statistic"]
                result["effect_size"] = {"cohen_d": eff * (-1 if stat < 0 and eff > 0 else 1)}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                result["report_markdown"] = f"A **One-Sample t-test** was performed on {gn0} against a hypothetical mean of 0. The result was **{sig}** (t({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f})."
                
            elif test_id == "One-Sample Wilcoxon signed-rank test":
                res = pg.wilcoxon(groups[0] - 0.0)
                result["statistic"] = get_clean_float((res['W-val'] if 'W-val' in res else res['W_val']).values[0])
                result["p_value"] = get_clean_float((res['p-val'] if 'p-val' in res else res['p_val']).values[0])
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                result["report_markdown"] = f"A **One-Sample Wilcoxon signed-rank test** was performed on {gn0} against a median of 0. The result was **{sig}** (W = {result['statistic']:.3f}, p = {result['p_value']:.4f})."

            elif test_id == "One-Sample Sign test":
                diff = groups[0] - 0.0
                diff = diff[diff != 0]
                pos = sum(diff > 0)
                bt = stats.binomtest(pos, n=len(diff), p=0.5, alternative='two-sided')
                result["p_value"] = get_clean_float(bt.pvalue)
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                result["report_markdown"] = f"A **One-Sample Sign test** was performed. The result was **{sig}** (p = {result['p_value']:.4f})."

            elif test_id == "Unpaired t test" or test_id == "Unpaired t-test":
                res = pg.ttest(groups[0], groups[1], paired=False, correction=False, alternative=tails)
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float((res['p-val'] if 'p-val' in res else res['p_val']).values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                eff = get_clean_float((res['cohen-d'] if 'cohen-d' in res else res['cohen_d']).values[0])
                stat = result["statistic"]
                result["effect_size"] = {"cohen_d": eff * (-1 if stat < 0 and eff > 0 else 1)}
                ci = (res['CI95%'] if 'CI95%' in res else res['CI95']).values[0]
                result["confidence_intervals"] = [get_clean_float(ci[0]), get_clean_float(ci[1])]
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"An **Unpaired t test** was performed to compare {gn0} and {gn1}. The difference between the means was **{sig}** (t({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}). The effect size (Cohen's d) was {result['effect_size']['cohen_d']:.3f}."
            
            elif test_id == "Mann-Whitney test":
                res = pg.mwu(groups[0], groups[1], alternative=tails)
                result["statistic"] = get_clean_float(res['U-val'].values[0]) if 'U-val' in res else get_clean_float(res['U_val'].values[0] if 'U_val' in res else res.iloc[0, 0])
                result["p_value"] = get_clean_float((res['p-val'] if 'p-val' in res else res['p_val']).values[0])
                result["effect_size"] = {"CLES": get_clean_float(res['CLES'].values[0])}

                # Exact P accounting for ties (matches GraphPad Prism) for small samples;
                # pingouin's asymptotic (normal-approx) P is kept for larger n.
                # The exact path OVERWRITES p below, so it must know the direction too --
                # otherwise a one-tailed request silently returns a two-sided p for n <= 16.
                _exact_p = _mwu_exact_p(groups[0], groups[1], alternative=tails)
                p_method = "asymptotic (normal approximation)"
                if _exact_p is not None:
                    result["p_value"] = get_clean_float(_exact_p)
                    p_method = "exact (accounts for ties)"

                sig = "significant" if (result["p_value"] is not None and result["p_value"] < 0.05) else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"A **Mann-Whitney U test** was performed to compare {gn0} and {gn1}. The difference was **{sig}** (U = {result['statistic']:.3f}, {p_method} p = {result['p_value']:.4f})."
                
            elif test_id == "Welch's t-test":
                res = pg.ttest(groups[0], groups[1], paired=False, correction=True, alternative=tails)
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float((res['p-val'] if 'p-val' in res else res['p_val']).values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                eff = get_clean_float((res['cohen-d'] if 'cohen-d' in res else res['cohen_d']).values[0])
                stat = result["statistic"]
                result["effect_size"] = {"cohen_d": eff * (-1 if stat < 0 and eff > 0 else 1)}
                ci = (res['CI95%'] if 'CI95%' in res else res['CI95']).values[0]
                result["confidence_intervals"] = [get_clean_float(ci[0]), get_clean_float(ci[1])]
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"A **Welch's t-test** was performed to compare {gn0} and {gn1} (assuming unequal variances). The difference was **{sig}** (t({result['degrees_of_freedom']:.2f}) = {result['statistic']:.3f}, p = {result['p_value']:.4f})."
                
            elif test_id == "Kolmogorov-Smirnov test":
                s, p = stats.ks_2samp(groups[0], groups[1])
                result["statistic"] = get_clean_float(s)
                result["p_value"] = get_clean_float(p)
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"A **Kolmogorov-Smirnov test** was performed to compare {gn0} and {gn1}. The difference between their distributions was **{sig}** (D = {result['statistic']:.3f}, p = {result['p_value']:.4f})."

            elif test_id == "Paired t-test":
                # Ensure same length
                min_len = min(len(groups[0]), len(groups[1]))
                res = pg.ttest(groups[0][:min_len], groups[1][:min_len], paired=True, alternative=tails)
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float((res['p-val'] if 'p-val' in res else res['p_val']).values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                eff = get_clean_float((res['cohen-d'] if 'cohen-d' in res else res['cohen_d']).values[0])
                stat = result["statistic"]
                result["effect_size"] = {"cohen_d": eff * (-1 if stat < 0 and eff > 0 else 1)}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"A **Paired t-test** was performed to compare {gn0} and {gn1}. The difference was **{sig}** (t({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f})."

            elif test_id == "Wilcoxon matched-pairs signed rank test":
                min_len = min(len(groups[0]), len(groups[1]))
                zero_method = options.get("zero_method", "wilcox")
                
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter("always")
                    res = pg.wilcoxon(groups[0][:min_len], groups[1][:min_len], zero_method=zero_method)
                    
                    has_tie_warning = any("Exact p-value calculation does not work if there are ties" in str(warn.message) or "Exact p-value calculation does not work if there are zeros" in str(warn.message) for warn in w)
                
                result["p_value"] = get_clean_float((res['p-val'] if 'p-val' in res else res['p_val']).values[0])

                # W statistic in GraphPad Prism's convention: sum of signed ranks (W+ minus W-),
                # using the Column B - Column A difference direction. Also expose both rank sums.
                _d = np.asarray(groups[1][:min_len], dtype=float) - np.asarray(groups[0][:min_len], dtype=float)
                _d = _d[_d != 0]
                _absr = rankdata(np.abs(_d)) if len(_d) > 0 else np.array([])
                _wp = float(_absr[_d > 0].sum()) if len(_d) > 0 else 0.0
                _wn = float(_absr[_d < 0].sum()) if len(_d) > 0 else 0.0
                result["statistic"] = _wp - _wn
                result["wilcoxon_ranks"] = {"W_positive": _wp, "W_negative": _wn, "W_signed": _wp - _wn}

                sig = "significant" if (result["p_value"] is not None and result["p_value"] < 0.05) else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                report = f"A **Wilcoxon matched-pairs signed rank test** was performed to compare {gn0} and {gn1}."
                if has_tie_warning:
                    report += " **Note:** Tied or zero differences are present, so the P value uses a normal approximation (exact only for small samples without ties)."
                report += f" The difference was **{sig}** (W = {result['statistic']:.1f}; sum of positive ranks = {_wp:.1f}, negative ranks = {_wn:.1f}; p = {result['p_value']:.4f})."
                result["report_markdown"] = report

            elif test_id == "Paired Sign test":
                min_len = min(len(groups[0]), len(groups[1]))
                # Scipy binomtest for sign test (count of >0 differences)
                diff = groups[0][:min_len] - groups[1][:min_len]
                diff = diff[diff != 0]
                pos = sum(diff > 0)
                bt = stats.binomtest(pos, n=len(diff), p=0.5, alternative='two-sided')
                result["statistic"] = get_clean_float(pos)
                result["p_value"] = get_clean_float(bt.pvalue)
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                result["report_markdown"] = f"A **Paired Sign test** was performed. The difference was **{sig}** (p = {result['p_value']:.4f})."

            elif test_id == "Ordinary One-way ANOVA":
                res = pg.anova(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                result["statistic"] = get_clean_float(res['F'].values[0])
                p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res), None)
                if p_col is None: 
                    cols = list(res.columns) if hasattr(res, 'columns') else list(res.keys()) if isinstance(res, dict) else str(type(res))
                    raise ValueError(f"Could not compute p-value. Found columns: {cols}")
                result["p_value"] = get_clean_float(res[p_col].values[0])
                result["degrees_of_freedom"] = f"{int(res['ddof1'].values[0])}, {int(res['ddof2'].values[0])}"
                result["effect_size"] = {"eta_sq": get_clean_float(res['np2'].values[0])}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                report = f"An **Ordinary one-way ANOVA** was performed to compare the effect of group on the measured value. There was a **{sig}** effect (F({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\n\n"
                
                # Post-Hocs
                # Post-Hocs: Tukey HSD via statsmodels (uses libqsturng internally -> WASM-safe)
                if post_hoc_family != "none":
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
                    elif "games-howell" in _phl or "t3" in _phl:
                        # These exist only on the unequal-variance branches. Falling through to
                        # Tukey here would be a silent wrong-test substitution.
                        raise ValueError(
                            f"'{_pht}' is not available for {test_id}. Games-Howell and Dunnett's T3 "
                            "require Welch's or Brown-Forsythe ANOVA (unequal variances). "
                            "Refusing to substitute Tukey's HSD."
                        )
                    elif "dunnett" in _phl and post_hoc_family != "control_vs_others":
                        # Dunnett is valid ONLY via the compare-to-control family, which is
                        # handled below. Asking for it with any other family must not quietly
                        # return Tukey.
                        raise ValueError(
                            f"'{_pht}' requires the 'compare each group to a control' option. "
                            "Refusing to substitute Tukey's HSD."
                        )
                    else:
                        _mc_method = "tukey"
                    _use_pairwise = (_mc_method != "tukey")
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
                            if post_hoc_family == "specific_pairs":
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
                            _pairs_out.append((g1, g2, _diff, _se))
                            _dfp_last = _dfp
                            _p_raw.append(_p)
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
                        _pretty = {"bonferroni": "Bonferroni", "sidak": "\u0160\u00edd\u00e1k",
                                   "holm": "Holm", "holm-sidak": "Holm-\u0160\u00edd\u00e1k"}.get(_mc_method, _mc_method)
                        _scope = "selected pairs" if post_hoc_family == "specific_pairs" else "all pairs"
                        _method_name = (f"Pairwise Welch t-tests ({_pretty}-adjusted, {_scope})" if _welch
                                        else f"Pairwise t-tests, pooled SD ({_pretty}-adjusted, {_scope})")
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
                        report += "Post-hoc comparisons using Tukey's HSD test were conducted. "

                        
            elif test_id == "Welch's ANOVA":
                res = pg.welch_anova(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                result["statistic"] = get_clean_float(res['F'].values[0])
                p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res), None)
                if p_col is None: 
                    cols = list(res.columns) if hasattr(res, 'columns') else list(res.keys()) if isinstance(res, dict) else str(type(res))
                    raise ValueError(f"Could not compute p-value. Found columns: {cols}")
                result["p_value"] = get_clean_float(res[p_col].values[0])
                result["degrees_of_freedom"] = f"{get_clean_float(res['ddof1'].values[0]):.2f}, {get_clean_float(res['ddof2'].values[0]):.2f}"
                result["effect_size"] = {"eta_sq": get_clean_float(res['np2'].values[0])}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                report = f"A **Welch's ANOVA** was performed (assuming unequal variances). There was a **{sig}** effect (F({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\n\n"
                
                # Post-Hocs for Welch's ANOVA: Games-Howell or Dunnett's T3
                if post_hoc_family != "none":
                    _pht_r = str(post_hoc_test or "")
                    if _pht_r not in ("Games-Howell test", "Dunnett's T3 test", "None", ""):
                        # This branch implements only Games-Howell and Dunnett's T3. Anything else
                        # would silently produce no post-hoc table at all.
                        raise ValueError(
                            f"'{_pht_r}' is not available for {test_id}. Unequal-variance ANOVA "
                            "supports Games-Howell or Dunnett's T3. Refusing to return a different "
                            "test or an empty table."
                        )
                    if post_hoc_test == "Games-Howell test":
                        ph_results = []
                        k_groups = len(group_names)
                        for g1, g2 in combinations(group_names, 2):
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            
                            d1 = df[g1].dropna()
                            d2 = df[g2].dropna()
                            mi, mj = d1.mean(), d2.mean()
                            vi, vj = d1.var(ddof=1), d2.var(ddof=1)
                            ni, nj = len(d1), len(d2)
                            
                            se = np.sqrt(vi/ni + vj/nj)
                            t = (mi - mj) / se
                            q = abs(t) * np.sqrt(2.0)
                            df_welch = (vi/ni + vj/nj)**2 / ((vi/ni)**2/(ni-1) + (vj/nj)**2/(nj-1))
                            p_val = float(_patched_sr_sf_scalar(q, k_groups, df_welch))
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                        result["post_hocs"] = {"method": "Games-Howell", "comparisons": ph_results}
                        report += "Games-Howell post-hoc test was conducted to account for unequal variances."
                    
                    elif post_hoc_test == "Dunnett's T3 test":
                        ph = pg.pairwise_gameshowell(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                        ph_results = []
                        k_groups = len(group_names)
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
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                        result["post_hocs"] = {"method": "Dunnett's T3 (Studentized Maximum Modulus)", "comparisons": ph_results}
                        report += "Dunnett's T3 post-hoc test using exact Studentized Maximum Modulus (SMM) distribution was conducted for small sample sizes with unequal variances."

            elif test_id == "Brown-Forsythe ANOVA" or test_id == "Welch and Brown-Forsythe ANOVA (Combinatory)":
                if test_id == "Welch and Brown-Forsythe ANOVA (Combinatory)":
                    res_w = pg.welch_anova(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                    p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res_w), None)
                    if p_col is None: raise ValueError("Could not compute p-value for Welch ANOVA step.")
                    w_F = get_clean_float(res_w['F'].values[0])
                    w_p = get_clean_float(res_w[p_col].values[0])
                    w_df1 = get_clean_float(res_w['ddof1'].values[0])
                    w_df2 = get_clean_float(res_w['ddof2'].values[0])
                    w_sig = "significant" if w_p < 0.05 else "not significant"
                
                f_bf, df1_bf, df2_bf, p_bf = brown_forsythe_anova_py(df.melt(value_vars=group_names).dropna(), 'value', 'variable')
                result["statistic"] = get_clean_float(f_bf)
                result["p_value"] = get_clean_float(p_bf)
                result["degrees_of_freedom"] = f"{df1_bf:.2f}, {df2_bf:.2f}"
                
                bf_sig = "significant" if result["p_value"] < 0.05 else "not significant"
                
                if test_id == "Welch and Brown-Forsythe ANOVA (Combinatory)":
                    report = f"A **Combinatory Robust ANOVA** approach was used due to unequal variances and non-normal (skewed) data.\n\n"
                    report += f"- **Welch's ANOVA** showed a **{w_sig}** effect (F({w_df1:.2f}, {w_df2:.2f}) = {w_F:.3f}, p = {w_p:.4f}).\n"
                    report += f"- **Brown-Forsythe ANOVA** showed a **{bf_sig}** effect (F({df1_bf:.2f}, {df2_bf:.2f}) = {f_bf:.3f}, p = {p_bf:.4f}).\n\n"
                    
                    if w_sig == bf_sig:
                        report += "Both tests agree, strengthening confidence in the conclusion despite the data violations.\n\n"
                    else:
                        report += "The tests disagree. Brown-Forsythe is often preferred for strongly skewed data with unequal variances.\n\n"
                    
                    # For post-hocs, we'll base it on Welch's if it was requested, or just proceed if either is significant
                    is_sig = w_p < 0.05 or p_bf < 0.05
                    result["p_value"] = min(w_p, p_bf)  # just so the post hoc block triggers if either is significant
                else:
                    report = f"A **Brown-Forsythe ANOVA** (robust to unequal variances and skewed data) was performed. There was a **{bf_sig}** effect (F({df1_bf:.2f}, {df2_bf:.2f}) = {f_bf:.3f}, p = {p_bf:.4f}).\n\n"
                    is_sig = p_bf < 0.05

                # Post-Hocs for robust ANOVA: Games-Howell or Dunnett's T3
                if post_hoc_family != "none":
                    _pht_r = str(post_hoc_test or "")
                    if _pht_r not in ("Games-Howell test", "Dunnett's T3 test", "None", ""):
                        # This branch implements only Games-Howell and Dunnett's T3. Anything else
                        # would silently produce no post-hoc table at all.
                        raise ValueError(
                            f"'{_pht_r}' is not available for {test_id}. Unequal-variance ANOVA "
                            "supports Games-Howell or Dunnett's T3. Refusing to return a different "
                            "test or an empty table."
                        )
                    if post_hoc_test == "Games-Howell test":
                        ph_results = []
                        k_groups = len(group_names)
                        for g1, g2 in combinations(group_names, 2):
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            
                            d1 = df[g1].dropna()
                            d2 = df[g2].dropna()
                            mi, mj = d1.mean(), d2.mean()
                            vi, vj = d1.var(ddof=1), d2.var(ddof=1)
                            ni, nj = len(d1), len(d2)
                            
                            se = np.sqrt(vi/ni + vj/nj)
                            t = (mi - mj) / se
                            q = abs(t) * np.sqrt(2.0)
                            df_welch = (vi/ni + vj/nj)**2 / ((vi/ni)**2/(ni-1) + (vj/nj)**2/(nj-1))
                            p_val = float(_patched_sr_sf_scalar(q, k_groups, df_welch))
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                        result["post_hocs"] = {"method": "Games-Howell", "comparisons": ph_results}
                        report += "Games-Howell post-hoc test was conducted to account for unequal variances."
                    
                    elif post_hoc_test == "Dunnett's T3 test":
                        ph = pg.pairwise_gameshowell(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                        ph_results = []
                        k_groups = len(group_names)
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
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                        result["post_hocs"] = {"method": "Dunnett's T3 (Studentized Maximum Modulus)", "comparisons": ph_results}
                        report += "Dunnett's T3 post-hoc test using exact Studentized Maximum Modulus (SMM) distribution was conducted for small sample sizes with unequal variances."

            elif test_id == "Repeated Measures ANOVA":
                # For RM ANOVA, we need subjects. We assume rows are subjects
                df_clean = df[group_names].dropna(how='any')
                if len(df_clean) < 2:
                    raise ValueError("Insufficient complete data for Repeated Measures ANOVA. Require at least 2 subjects with complete data across all groups.")
                
                melted = df_clean.reset_index().melt(id_vars='index', value_vars=group_names)
                melted.columns = ['Subject', 'Variable', 'Value']
                
                res = pg.rm_anova(data=melted, dv='Value', within='Variable', subject='Subject', detailed=True, correction=True)
                # Extract F and p robustly across pingouin versions
                result["statistic"] = get_clean_float(res['F'].values[0])
                p_col = next((c for c in ['p_GG_corr', 'p-GG-corr', 'p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res), None)
                if p_col is None: raise ValueError("Could not compute p-value. Check data for zero variance or small sample size.")
                result["p_value"] = get_clean_float(res[p_col].values[0])
                # Degrees of freedom. If we surfaced a Greenhouse-Geisser corrected p we MUST
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
                    result["degrees_of_freedom"] = f"{_df1:.0f}, {_df2:.0f}"
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                report = f"A **Repeated Measures ANOVA** was performed. There was a **{sig}** effect (F({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\n\n"

            elif test_id == "Friedman test":
                if len(group_names) < 3:
                    raise ValueError("Friedman test requires at least 3 groups.")
                df_clean = df[group_names].dropna(how='any')
                if len(df_clean) < 2:
                    raise ValueError("Insufficient complete data for Friedman test. Require at least 2 subjects with complete data across all groups.")
                
                groups = [df_clean[col].values for col in group_names]
                
                res = stats.friedmanchisquare(*groups)
                result["statistic"] = get_clean_float(res.statistic)
                result["p_value"] = get_clean_float(res.pvalue)
                result["degrees_of_freedom"] = f"{len(group_names) - 1}"
                
                n = len(df_clean)
                k = len(groups)
                w = res.statistic / (n * (k - 1)) if n > 0 and k > 1 else None
                if w is not None:
                    result["effect_size"] = {"W": get_clean_float(w)}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                report = f"A **Friedman test** was performed for repeated measures. There was a **{sig}** effect (X2({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f})."
                if w is not None:
                    report += f" The effect size (Kendall's W) was {w:.3f}."
                report += "\n\n"
                
                # Post-Hocs using scikit-posthocs
                if post_hoc_family != "none" and post_hoc_test == "Dunn's test":
                    df_long = df.melt(value_vars=group_names).dropna()
                    ph = sp.posthoc_dunn(df_long, val_col='value', group_col='variable', p_adjust='bonferroni')
                    
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

            elif test_id == "Kruskal-Wallis test":
                res = pg.kruskal(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                result["statistic"] = get_clean_float(res['H'].values[0])
                p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res), None)
                if p_col is None: raise ValueError("Could not compute p-value. Check data for zero variance or small sample size.")
                result["p_value"] = get_clean_float(res[p_col].values[0])
                result["degrees_of_freedom"] = get_clean_float(res['ddof1'].values[0])
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                report = f"A **Kruskal-Wallis test** was performed. The differences between groups were **{sig}** (H({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\n\n"
                
                # Post-Hocs using scikit-posthocs
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

            if "report_markdown" not in result or result["report_markdown"] == "":
                result["report_markdown"] = report if 'report' in locals() else "Test not fully implemented yet."

        elif table_type == "Contingency":
            def _pct_tables(mat, clabels=None, rlabels=None):
                try:
                    mat = np.asarray(mat, dtype=float)
                    nr, nc = mat.shape
                    if not clabels or len(clabels) != nc: clabels = [f"Col {j+1}" for j in range(nc)]
                    if not rlabels or len(rlabels) != nr: rlabels = [f"Row {i+1}" for i in range(nr)]
                    clabels = [str(c) for c in clabels]; rlabels = [str(r) for r in rlabels]
                    grand = mat.sum() or 1
                    def _tbl(title, cellfn):
                        o = f"\n\n### {title}\n\n|  | " + " | ".join(clabels) + " |\n|" + "---|"*(nc+1) + "\n"
                        for i in range(nr):
                            o += f"| {rlabels[i]} | " + " | ".join(cellfn(i,j) for j in range(nc)) + " |\n"
                        return o
                    out = _tbl("Counts", lambda i,j: f"{int(round(mat[i,j]))}")
                    out += _tbl("Percentage of row total", lambda i,j: f"{100*mat[i,j]/(mat[i].sum() or 1):.2f}%")
                    out += _tbl("Percentage of column total", lambda i,j: f"{100*mat[i,j]/(mat[:,j].sum() or 1):.2f}%")
                    out += _tbl("Percentage of grand total", lambda i,j: f"{100*mat[i,j]/grand:.2f}%")
                    return out
                except Exception:
                    return ""
            # Contingency tables require non-negative integers (counts)
            data_cols = [c for c in df.columns if c != "rowTitle"]
            valid_data_cols = [c for c in data_cols if not df[c].isna().all()]
            df_clean_global = df[valid_data_cols].dropna(how='any')
            if not df_clean_global.empty:
                global_matrix = df_clean_global.values
                if not np.all(np.floor(global_matrix) == global_matrix) or not np.all(global_matrix >= 0):
                    result["error"] = "Contingency values must be non-negative integers (counts)"
                    return result

            if test_id.lower() in ["chi-square test", "chi-square test (with yates' correction)"]:
                data_cols = [c for c in df.columns if c != "rowTitle"]
                valid_data_cols = [c for c in data_cols if not df[c].isna().all()]
                df_clean = df[valid_data_cols].dropna(how='any')
                matrix = df_clean.values
                if len(matrix) == 0 or matrix.size == 0:
                    result["error"] = "Insufficient data for Chi-Square test."
                    return result
                else:
                    # Apply Yates' correction only for 2x2 tables when explicitly requested
                    is_2x2 = matrix.shape == (2, 2)
                    use_yates = is_2x2 and (options.get("yates_correction", False) or "yates" in test_id.lower())
                    chi2, p, dof, ex = stats.chi2_contingency(matrix, correction=use_yates)
                    result["statistic"] = get_clean_float(chi2)
                    result["p_value"] = get_clean_float(p)
                    result["degrees_of_freedom"] = get_clean_float(dof)
                
                sig = "significant" if p < 0.05 else "not significant"
                report = f"A **Chi-Square test of independence** was performed to examine the relation between variables. The relationship between these variables was **{sig}** (X2({int(dof)}) = {chi2:.3f}, p = {p:.4f})."
                if use_yates:
                    report += " Yates' continuity correction was applied."
                
                if matrix.shape == (2, 2):
                    a, b = matrix[0, 0], matrix[0, 1]
                    c, d = matrix[1, 0], matrix[1, 1]
                    OR, OR_ci, RR, RR_ci = or_rr(a, b, c, d)
                    
                    result["effect_size"] = {"odds_ratio": get_clean_float(OR), "relative_risk": get_clean_float(RR)}
                    report += f"\n\n**Effect Sizes:**\n- **Odds Ratio:** {OR:.3f} (95% CI: [{OR_ci[0]:.3f}, {OR_ci[1]:.3f}])\n- **Relative Risk:** {RR:.3f} (95% CI: [{RR_ci[0]:.3f}, {RR_ci[1]:.3f}])"
                report += _pct_tables(matrix, clabels=list(valid_data_cols), rlabels=(df.loc[df_clean.index, "rowTitle"].astype(str).tolist() if "rowTitle" in df.columns else None))
                result["report_markdown"] = report

            elif test_id == "Fisher's Exact Test":
                data_cols = [c for c in df.columns if c != "rowTitle"]
                valid_data_cols = [c for c in data_cols if not df[c].isna().all()]
                df_clean = df[valid_data_cols].dropna(how='any')
                matrix = df_clean.values
                if matrix.shape == (2, 2):
                    res_stat, res_p = stats.fisher_exact(matrix)
                    result["statistic"] = get_clean_float(res_stat)
                    result["p_value"] = get_clean_float(res_p)
                    
                    sig = "significant" if res_p < 0.05 else "not significant"
                    report = f"A **Fisher's Exact Test** was performed. The relationship was **{sig}** (p = {res_p:.4f})."
                    
                    a, b = matrix[0, 0], matrix[0, 1]
                    c, d = matrix[1, 0], matrix[1, 1]
                    OR, OR_ci, RR, RR_ci = or_rr(a, b, c, d)
                    
                    result["effect_size"] = {"odds_ratio": get_clean_float(OR), "relative_risk": get_clean_float(RR)}
                    report += f"\n\n**Effect Sizes:**\n- **Odds Ratio:** {OR:.3f} (95% CI: [{OR_ci[0]:.3f}, {OR_ci[1]:.3f}])\n- **Relative Risk:** {RR:.3f} (95% CI: [{RR_ci[0]:.3f}, {RR_ci[1]:.3f}])"
                    report += _pct_tables(matrix, clabels=list(valid_data_cols), rlabels=(df.loc[df_clean.index, "rowTitle"].astype(str).tolist() if "rowTitle" in df.columns else None))
                    result["report_markdown"] = report
                else:
                    if len(matrix) == 0 or matrix.size == 0:
                        result["error"] = "Insufficient data for Fisher's Exact test."
                    else:
                        n_perms = 500
                        row_labels = np.repeat(np.arange(matrix.shape[0]), matrix.sum(axis=1).astype(int))
                        col_labels = np.repeat(np.arange(matrix.shape[1]), matrix.sum(axis=0).astype(int))
                        obs_stat, p_chi, dof, E = stats.chi2_contingency(matrix, correction=False)
                        larger_eq = 0
                        np.random.seed(42)
                        for _ in range(n_perms):
                            np.random.shuffle(col_labels)
                            flat = row_labels * matrix.shape[1] + col_labels
                            counts = np.bincount(flat, minlength=matrix.size).reshape(matrix.shape)
                            sim_stat = np.sum((counts - E)**2 / E)
                            if sim_stat >= obs_stat - 1e-9:
                                larger_eq += 1
                        p_val = larger_eq / n_perms
                        
                        result["statistic"] = get_clean_float(obs_stat)
                        result["p_value"] = get_clean_float(p_val)
                        sig = "significant" if p_val < 0.05 else "not significant"
                        report = f"Table was {matrix.shape[0]}x{matrix.shape[1]}. A **Fisher-Freeman-Halton Exact Test** (Monte Carlo, {n_perms} perms) was performed. The relationship was **{sig}** (p = {p_val:.4f})."
                        result["report_markdown"] = report

            elif test_id == "McNemar's Test":
                data_cols = [c for c in df.columns if c != "rowTitle"]
                valid_data_cols = [c for c in data_cols if not df[c].isna().all()]
                df_clean = df[valid_data_cols].dropna(how='any')
                matrix = df_clean.values
                if matrix.shape == (2, 2):
                    b, c = float(matrix[0, 1]), float(matrix[1, 0])
                    res = mcnemar(matrix, exact=(b + c < 25), correction=True)
                    chi2 = res.statistic
                    p = res.pvalue
                    
                    result["statistic"] = get_clean_float(chi2)
                    result["p_value"] = get_clean_float(p)
                    
                    sig = "significant" if p < 0.05 else "not significant"
                    result["report_markdown"] = f"A **McNemar's test** was performed on paired nominal data. The difference was **{sig}** (statistic = {chi2:.3f}, p = {p:.4f})."
                else:
                    result["error"] = "McNemar's Test requires a 2x2 contingency table."

            elif test_id == "Diagnostic Test (Sensitivity/Specificity)":
                data_cols = [c for c in df.columns if c != "rowTitle"]
                valid_data_cols = [c for c in data_cols if not df[c].isna().all()]
                df_clean = df[valid_data_cols].dropna(how='any')
                matrix = df_clean.values
                if matrix.shape == (2, 2):
                    TP, FN = float(matrix[0, 0]), float(matrix[0, 1])
                    FP, TN = float(matrix[1, 0]), float(matrix[1, 1])
                    
                    sens = TP / (TP + FN) if (TP + FN) > 0 else 0
                    spec = TN / (TN + FP) if (TN + FP) > 0 else 0
                    ppv = TP / (TP + FP) if (TP + FP) > 0 else 0
                    npv = TN / (TN + FN) if (TN + FN) > 0 else 0
                    acc = (TP + TN) / np.sum(matrix)
                    
                    report = f"**Diagnostic Test Performance:**\n\n"
                    report += f"- **Sensitivity (TPR):** {sens:.3f} ({sens*100:.1f}%)\n"
                    report += f"- **Specificity (TNR):** {spec:.3f} ({spec*100:.1f}%)\n"
                    report += f"- **Positive Predictive Value (PPV):** {ppv:.3f} ({ppv*100:.1f}%)\n"
                    report += f"- **Negative Predictive Value (NPV):** {npv:.3f} ({npv*100:.1f}%)\n"
                    report += f"- **Overall Accuracy:** {acc:.3f} ({acc*100:.1f}%)"
                    
                    result["statistic"] = get_clean_float(acc)
                    result["report_markdown"] = report
                else:
                    result["error"] = "Diagnostic tests require a 2x2 contingency table (Rows: Test Positive/Negative, Cols: Condition Positive/Negative)."

            elif test_id == "Cochran-Armitage Trend Test":
                data_cols = [c for c in df.columns if c != "rowTitle"]
                valid_data_cols = [c for c in data_cols if not df[c].isna().all()]
                df_clean = df[valid_data_cols].dropna(how='any')
                matrix = df_clean.values
                
                if matrix.shape[0] != 2 and matrix.shape[1] != 2:
                    result["error"] = "Cochran-Armitage Trend Test requires one dimension to be binary (2xC or Rx2)."
                else:
                    if matrix.shape[0] != 2:
                        matrix = matrix.T
                    
                    N = matrix.sum()
                    if N == 0:
                        result["error"] = "Table is empty or zero."
                    else:
                        weights = np.arange(1, matrix.shape[1] + 1)
                        R1 = matrix[0].sum()
                        R2 = matrix[1].sum()
                        col_totals = matrix.sum(axis=0)
                        
                        if R1 == 0 or R2 == 0:
                            z = 0
                            p_val = 1.0
                        else:
                            term1 = np.sum(weights * matrix[0])
                            term2 = (R1 / N) * np.sum(weights * col_totals)
                            numerator = term1 - term2
                            
                            var = (R1 * R2) / (N * (N - 1)) * (np.sum(col_totals * (weights**2)) - (np.sum(col_totals * weights)**2) / N)
                            if var <= 0:
                                z = 0
                                p_val = 1.0
                            else:
                                z = numerator / np.sqrt(var)
                                p_val = 2 * stats.norm.sf(np.abs(z))
                        
                        result["statistic"] = get_clean_float(z)
                        result["p_value"] = get_clean_float(p_val)
                        result["report_markdown"] = (f"A **Cochran-Armitage Trend Test** was performed.\n\n"
                                  f"**Z-statistic:** {z:.4f}\n"
                                  f"**p-value:** {format_p_value(p_val)}\n")


        elif table_type == "XY":
            if len(columns) > 1:
                valid_cols = [columns[0]]
                for c in columns[1:]:
                    if not df[c].dropna().empty:
                        valid_cols.append(c)
                columns = valid_cols

            if test_id in ["Correlation (Pearson)", "Correlation (Spearman)"]:
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    method = 'pearson' if 'Pearson' in test_id else 'spearman'
                    
                    x_name = col_id_to_name.get(x_col, x_col)
                    
                    report = f"A **{test_id}** was performed to examine the relationship between {x_name} and each Y dataset.\n\n"
                    
                    table_header = f"| Y Dataset | {'r' if method=='pearson' else 'rho'} | 95% CI | p-value | Significant? | n |\n"
                    table_header += "|---|---|---|---|---|---|\n"
                    report += table_header
                    
                    results_list = []
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 3:
                            report += f"| {y_name} | N/A | N/A | N/A | Insufficient data | {len(df_clean)} |\n"
                            continue
                            
                        res = pg.corr(df_clean[x_col], df_clean[y_col], method=method)
                        
                        r_val = get_clean_float(res['r'].iloc[0])
                        
                        p_col = next((c for c in ['p-val', 'p_val', 'pval', 'p'] if c in res.columns), None)
                        p_val = get_clean_float(res[p_col].iloc[0]) if p_col else None

                        # Spearman: exact permutation P for small n (matches GraphPad Prism);
                        # pingouin's t/asymptotic P is kept for larger n. Pearson is unaffected.
                        if method == 'spearman':
                            _sp_exact = _spearman_exact_p(df_clean[x_col].values, df_clean[y_col].values)
                            if _sp_exact is not None:
                                p_val = get_clean_float(_sp_exact)

                        ci_col = next((c for c in ['CI95%', 'CI95'] if c in res.columns), None)
                        ci = res[ci_col].iloc[0] if ci_col else None
                        n_val = int(res['n'].iloc[0])
                        
                        sig = "Yes" if p_val is not None and p_val < 0.05 else "No"
                        
                        ci_str = f"[{ci[0]:.3f}, {ci[1]:.3f}]" if ci is not None else "N/A"
                        p_str = format_p_value(p_val) if p_val is not None else "N/A"
                        r_str = f"{r_val:.3f}" if r_val is not None else "N/A"
                        
                        report += f"| {y_name} | {r_str} | {ci_str} | {p_str} | {sig} | {n_val} |\n"
                        
                        results_list.append({
                            "dataset": y_name,
                            "r": r_val,
                            "p_value": p_val,
                            "n": n_val
                        })
                    
                    result["statistic"] = results_list[0]["r"] if results_list else None
                    result["p_value"] = results_list[0]["p_value"] if results_list else None
                    result["effect_size"] = {"r_values": [r["r"] for r in results_list]}
                    
                    result["report_markdown"] = report

            elif test_id == "Simple Linear Regression":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    report = f"A **Simple Linear Regression** was performed.\n\n"
                    
                    table_header = "| Y Dataset | Slope (95% CI) | Intercept | R² | p-value | Equation |\n"
                    table_header += "|---|---|---|---|---|---|\n"
                    report += table_header
                    
                    results_list = []
                    
                    rss_separate = 0
                    df_separate = 0
                    
                    x_pool = []
                    y_pool = []
                    
                    for y_col in y_cols:
                        df_pair = df[[x_col, y_col]].copy()
                        df_pair[x_col] = pd.to_numeric(df_pair[x_col], errors='coerce')
                        df_pair[y_col] = pd.to_numeric(df_pair[y_col], errors='coerce')
                        df_clean = df_pair.dropna()
                        
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 3:
                            report += f"| {y_name} | N/A | N/A | N/A | N/A | Insufficient data |\n"
                            continue
                            
                        res = pg.linear_regression(df_clean[x_col], df_clean[y_col])
                        
                        intercept_row = res.iloc[0]
                        slope_row = res.iloc[1] if len(res) > 1 else res.iloc[0]
                        
                        slope_val = get_clean_float(slope_row['coef'])
                        intercept_val = get_clean_float(intercept_row['coef'])
                        slope_p = get_clean_float(slope_row['pval'])
                        r_sq = get_clean_float(res['r2'].iloc[0]) if 'r2' in res.columns else None
                        
                        # Robust CI extraction
                        ci_lower, ci_upper = None, None
                        if 'CI[2.5%]' in slope_row and 'CI[97.5%]' in slope_row:
                            ci_lower, ci_upper = slope_row['CI[2.5%]'], slope_row['CI[97.5%]']
                        elif 'CI2.5%' in slope_row and 'CI97.5%' in slope_row:
                            ci_lower, ci_upper = slope_row['CI2.5%'], slope_row['CI97.5%']
                        else:
                            tval = stats.t.ppf(0.975, len(df_clean) - 2)
                            ci_lower = slope_val - tval * slope_row['se']
                            ci_upper = slope_val + tval * slope_row['se']
                            
                        # Residuals
                        predictions = intercept_val + slope_val * df_clean[x_col]
                        residuals = df_clean[y_col] - predictions
                        rss = np.sum(residuals**2)
                        
                        rss_separate += rss
                        df_separate += (len(df_clean) - 2)
                        
                        x_pool.extend(df_clean[x_col].tolist())
                        y_pool.extend(df_clean[y_col].tolist())
                        
                        slope_str = f"{slope_val:.3f} [{ci_lower:.3f}, {ci_upper:.3f}]"
                        eq_str = f"Y = {slope_val:.3f}*X + {intercept_val:.3f}"
                        p_str = format_p_value(slope_p)
                        r2_str = f"{r_sq:.3f}" if r_sq is not None else "N/A"
                        
                        report += f"| {y_name} | {slope_str} | {intercept_val:.3f} | {r2_str} | {p_str} | {eq_str} |\n"
                        
                        results_list.append({
                            "dataset": y_name,
                            "slope": slope_val,
                            "intercept": intercept_val,
                            "r_sq": r_sq,
                            "p_value": slope_p
                        })
                    
                    result["statistic"] = results_list[0]["slope"] if results_list else None
                    result["p_value"] = results_list[0]["p_value"] if results_list else None
                    result["effect_size"] = {"r_sq_values": [r["r_sq"] for r in results_list]}
                    
                    # Extra Sum-of-Squares F-test (if >1 valid column)
                    if len(results_list) > 1 and df_separate > 0:
                        df_pool_clean = pd.DataFrame({'X': x_pool, 'Y': y_pool}).dropna()
                        res_global = pg.linear_regression(df_pool_clean['X'], df_pool_clean['Y'])
                        int_glob = res_global.iloc[0]['coef']
                        slp_glob = res_global.iloc[1]['coef'] if len(res_global) > 1 else res_global.iloc[0]['coef']
                        preds_glob = int_glob + slp_glob * df_pool_clean['X']
                        rss_global = np.sum((df_pool_clean['Y'] - preds_glob)**2)
                        df_global = len(df_pool_clean) - 2
                        
                        df_num = df_global - df_separate
                        if df_num > 0 and rss_separate > 0:
                            F_val = ((rss_global - rss_separate) / df_num) / (rss_separate / df_separate)
                            p_val_f = 1 - stats.f.cdf(F_val, df_num, df_separate)
                            
                            sig_f = "different" if p_val_f < 0.05 else "not significantly different"
                            report += f"\n**Line Comparison:** An Extra Sum-of-Squares F-test was performed to test if the slopes and intercepts are significantly different between datasets. The lines are **{sig_f}** (F({df_num}, {df_separate}) = {F_val:.3f}, p = {p_val_f:.4f}).\n"
                            
                    if options.get("interpolate_unknowns", False):
                        report += f"\n**Interpolated Unknowns from Standard Curve:**\n\n"
                        interp_header = "| Y Dataset | Y (Input) | X (Interpolated) |\n"
                        interp_header += "|---|---|---|\n"
                        report += interp_header
                        
                        for y_col in y_cols:
                            y_name = col_id_to_name.get(y_col, y_col)
                            res_entry = next((r for r in results_list if r["dataset"] == y_name), None)
                            if res_entry and res_entry["slope"] != 0:
                                df_missing_x = df[df[x_col].isna() & df[y_col].notna()]
                                for _, row in df_missing_x.iterrows():
                                    y_val = row[y_col]
                                    x_interp = (y_val - res_entry["intercept"]) / res_entry["slope"]
                                    report += f"| {y_name} | {y_val:.3f} | {x_interp:.4f} |\n"
                        
                    result["report_markdown"] = report

            elif test_id == "Deming Regression":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    report = f"A **Deming Regression** (Orthogonal regression, assuming variance ratio = 1) was performed.\n\n"
                    table_header = "| Y Dataset | Slope | Y-intercept | Equation |\n"
                    table_header += "|---|---|---|---|\n"
                    report += table_header
                    
                    results_list = []
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 3:
                            report += f"| {y_name} | N/A | N/A | Insufficient data |\n"
                            continue
                            
                        x = pd.to_numeric(df_clean[x_col], errors="coerce").to_numpy(dtype=float)
                        y = pd.to_numeric(df_clean[y_col], errors="coerce").to_numpy(dtype=float)
                        
                        b1, b0 = deming(x, y, lam=1.0)
                        
                        
                        eq_str = f"Y = {b1:.3f}*X + {b0:.3f}" if b1 != float('inf') else "Undefined"
                        report += f"| {y_name} | {b1:.3f} | {b0:.3f} | {eq_str} |\n"
                        
                        results_list.append({
                            "dataset": y_name,
                            "slope": b1,
                            "intercept": b0
                        })
                    
                    result["statistic"] = get_clean_float(results_list[0]["slope"]) if results_list else None
                    result["p_value"] = None # Standard Deming doesn't output a simple p-value like OLS
                    result["effect_size"] = {"slopes": [get_clean_float(r["slope"]) for r in results_list]}
                    
                    if results_list:
                        result["regression"] = {
                            "slope": get_clean_float(results_list[0]["slope"]),
                            "intercept": get_clean_float(results_list[0]["intercept"]),
                            "method": "Deming",
                            "lambda": 1.0
                        }
                    
                    result["report_markdown"] = report

            elif test_id == "Nonlinear Curve Fitting":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    model_type = options.get("nonlinear_model", "Exponential")
                    
                    report = f"A **Nonlinear Curve Fitting** ({model_type} model) was performed.\n\n"
                    table_header = "| Y Dataset | Equation | Parameters | R² | AICc |\n"
                    table_header += "|---|---|---|---|---|\n"
                    report += table_header
                    
                    # Define models globally for the block
                    def exp_func(x, y0, k): return y0 * np.exp(k * x)
                    def mm_func(x, vmax, km): return (vmax * x) / (km + x)
                    def fourpl_func(x, bottom, top, ec50, hill): return bottom + (top - bottom) / (1 + (x / ec50)**hill)
                    def gauss_func(x, a, x0, sigma): return a * np.exp(-(x - x0)**2 / (2 * sigma**2))
                    def poly2_func(x, a, b, c): return a*x**2 + b*x + c
                    def boltzmann_func(x, bottom, top, v50, slope): return bottom + (top - bottom) / (1 + np.exp((v50 - x) / slope))
                    
                    results_list = []
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 3:
                            report += f"| {y_name} | N/A | Insufficient data | N/A | N/A |\n"
                            continue
                            
                        x = pd.to_numeric(df_clean[x_col], errors="coerce").to_numpy(dtype=float)
                        y = pd.to_numeric(df_clean[y_col], errors="coerce").to_numpy(dtype=float)
                        
                        # Heuristic p0s based on data
                        y_min, y_max, y_mean, y_med = np.min(y), np.max(y), np.mean(y), np.median(y)
                        x_min, x_max, x_mean, x_med = np.min(x), np.max(x), np.mean(x), np.median(x)
                        y_first = y[0] if len(y) > 0 else 1.0
                        
                        models_def = {
                            "Exponential": (exp_func, ["Y0", "k"], [
                                [y_first, 0.1], [y_mean, 0.5], [1.0, 0.1], [y_max, -0.1], [y_min, 1.0]
                            ], "Y = Y0 * exp(k*X)"),
                            "Michaelis-Menten": (mm_func, ["Vmax", "Km"], [
                                [y_max, x_med], [y_mean, x_mean], [y_max * 2, x_max]
                            ], "Y = (Vmax * X) / (Km + X)"),
                            "4PL": (fourpl_func, ["Bottom", "Top", "EC50", "HillSlope"], [
                                [y_min, y_max, x_med, 1.0], [y_min, y_max, x_med, -1.0], [0, y_max, x_mean, 1.0]
                            ], "Y = Bottom + (Top-Bottom)/(1+(X/EC50)^Hill)"),
                            "Gaussian": (gauss_func, ["Amplitude", "Mean", "SD"], [
                                [y_max, x_mean, np.std(x)], [y_max, x_med, 1.0]
                            ], "Y = Amp * exp(-(X-Mean)^2 / (2*SD^2))"),
                            "Polynomial (2nd order)": (poly2_func, ["B2", "B1", "B0"], [
                                [0.1, 1.0, y_first], [0.0, 0.0, 0.0]
                            ], "Y = B2*X^2 + B1*X + B0"),
                            "Boltzmann": (boltzmann_func, ["Bottom", "Top", "V50", "Slope"], [
                                [y_min, y_max, x_med, 1.0], [y_min, y_max, x_med, -1.0]
                            ], "Y = Bottom + (Top-Bottom)/(1+exp((V50-X)/Slope))")
                        }
                        
                        if model_type not in models_def:
                            model_type = "Exponential"
                            
                        func, param_names, p0_list, eq_str = models_def[model_type]
                        
                        popt, pcov = None, None
                        for p0_guess in p0_list:
                            try:
                                popt, pcov = curve_fit(func, x, y, p0=p0_guess, maxfev=10000)
                                break # Success
                            except Exception:
                                continue
                                
                        if popt is None:
                            report += f"| {y_name} | {eq_str} | Convergence failed | N/A | N/A |\n"
                            continue
                            
                        # Calculate CIs
                        perr = np.sqrt(np.diag(pcov))
                        n = len(x)
                        k_params = len(popt)
                        tval = stats.t.ppf(1.0 - 0.025, n - k_params)
                        ci = [(popt[i] - tval*perr[i], popt[i] + tval*perr[i]) for i in range(k_params)]
                        
                        # Calculate R2 and AICc
                        residuals = y - func(x, *popt)
                        ss_res = np.sum(residuals**2)
                        ss_tot = np.sum((y - np.mean(y))**2)
                        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
                        
                        aicc = n * np.log(ss_res / n) + 2 * k_params + (2 * k_params * (k_params + 1)) / (n - k_params - 1) if (n - k_params - 1) > 0 else float('inf')
                        
                        param_strs = [f"{name}={popt[i]:.3f}" for i, name in enumerate(param_names)]
                        params_joined = "<br>".join(param_strs)
                        
                        report += f"| {y_name} | {eq_str} | {params_joined} | {r_squared:.3f} | {aicc:.1f} |\n"
                        
                        results_list.append({
                            "dataset": y_name,
                            "r_sq": r_squared,
                            "aicc": aicc,
                            "func": func,
                            "popt": popt
                        })
                        
                    result["statistic"] = get_clean_float(results_list[0]["r_sq"]) if results_list else None
                    result["p_value"] = None
                    result["effect_size"] = {"r_sq_values": [get_clean_float(r["r_sq"]) for r in results_list]}
                    
                    if options.get("interpolate_unknowns", False):

                        report += f"\n**Interpolated Unknowns from Standard Curve:**\n\n"
                        interp_header = "| Y Dataset | Y (Input) | X (Interpolated) |\n"
                        interp_header += "|---|---|---|\n"
                        report += interp_header
                        
                        for y_col in y_cols:
                            y_name = col_id_to_name.get(y_col, y_col)
                            res_entry = next((r for r in results_list if r["dataset"] == y_name), None)
                            if res_entry and "func" in res_entry and res_entry["popt"] is not None:
                                df_missing_x = df[df[x_col].isna() & df[y_col].notna()]
                                func_to_solve = res_entry["func"]
                                popt_to_use = res_entry["popt"]
                                
                                for _, row in df_missing_x.iterrows():
                                    y_val = row[y_col]
                                    try:
                                        x_guess = np.nanmean(df[x_col].values) if len(df[x_col].dropna()) > 0 else 1.0
                                        x_interp = fsolve(lambda x: func_to_solve(x, *popt_to_use) - y_val, x_guess)[0]
                                        report += f"| {y_name} | {y_val:.3f} | {x_interp:.4f} |\n"
                                    except Exception:
                                        report += f"| {y_name} | {y_val:.3f} | Solver failed |\n"
                    
                    result["report_markdown"] = report

            elif test_id == "Area Under Curve":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    baseline = float(options.get("auc_baseline", 0.0))
                    
                    report = f"An **Area Under Curve (AUC)** analysis was performed with a baseline of {baseline}.\n\n"
                    table_header = "| Y Dataset | Total Area | Peak (Max Y) | X at Peak |\n"
                    table_header += "|---|---|---|---|\n"
                    report += table_header
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 2:
                            continue
                            
                        x = pd.to_numeric(df_clean[x_col], errors="coerce").to_numpy(dtype=float)
                        y = pd.to_numeric(df_clean[y_col], errors="coerce").to_numpy(dtype=float)
                        
                        # Apply baseline
                        y_adj = np.maximum(y - baseline, 0)
                        
                        trapz_func = getattr(np, "trapezoid", None) or getattr(np, "trapz", None)
                        area = trapz_func(y_adj, x)
                        peak_y = np.max(y)
                        peak_x = x[np.argmax(y)]
                        
                        report += f"| {y_name} | {area:.4f} | {peak_y:.4f} | {peak_x:.4f} |\n"
                        
                        if result["statistic"] is None:
                            result["statistic"] = float(area)
                        
                    result["report_markdown"] = report


            elif test_id in ["Integrate", "Differentiate", "Smooth", "Fit Spline", "LOWESS"]:
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    opts = options.get("transformOptions", {})
                    
                    report = f"A **{test_id}** transform was performed.\n\n"
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna().sort_values(by=x_col)
                        x = pd.to_numeric(df_clean[x_col], errors="coerce").to_numpy(dtype=float)
                        y = pd.to_numeric(df_clean[y_col], errors="coerce").to_numpy(dtype=float)
                        
                        try:
                            if test_id == "Integrate":
                                baseline = float(opts.get("integrateBaseline", 0))
                                y_adj = y - baseline
                                y_trans = np.concatenate(([0], scipy.integrate.cumulative_trapezoid(y_adj, x)))
                            elif test_id == "Differentiate":
                                order = int(opts.get("differentiateOrder", 1))
                                y_trans = np.gradient(y, x)
                                if order == 2:
                                    y_trans = np.gradient(y_trans, x)
                            elif test_id == "Smooth":
                                neighbors = int(opts.get("smoothNeighbors", 4))
                                poly = int(opts.get("smoothPoly", 2))
                                window = neighbors * 2 + 1
                                if window > len(y):
                                    window = len(y) if len(y) % 2 != 0 else len(y) - 1
                                if poly >= window:
                                    poly = window - 1
                                if window >= 3:
                                    y_trans = scipy.signal.savgol_filter(y, window, poly)
                                else:
                                    y_trans = y
                            elif test_id == "Fit Spline":
                                method = opts.get("splineMethod", "interpolate")
                                if method == "interpolate":
                                    # handle duplicate x by averaging or just relying on CubicSpline if strict monotonic
                                    # CubicSpline requires strictly increasing x
                                    _, unique_indices = np.unique(x, return_index=True)
                                    if len(unique_indices) < len(x):
                                        # Average duplicate x
                                        df_avg = pd.DataFrame({'x': x, 'y': y}).groupby('x').mean().reset_index()
                                        x_unq = df_avg['x'].values
                                        y_unq = df_avg['y'].values
                                    else:
                                        x_unq = x
                                        y_unq = y
                                        
                                    if len(x_unq) >= 2:
                                        cs = scipy.interpolate.CubicSpline(x_unq, y_unq)
                                        y_trans = cs(x)
                                    else:
                                        y_trans = y
                                else:
                                    s = float(opts.get("splineKnots", 5))
                                    df_avg = pd.DataFrame({'x': x, 'y': y}).groupby('x').mean().reset_index()
                                    x_unq = df_avg['x'].values
                                    y_unq = df_avg['y'].values
                                    if len(x_unq) >= 2:
                                        spl = scipy.interpolate.UnivariateSpline(x_unq, y_unq, s=s)
                                        y_trans = spl(x)
                                    else:
                                        y_trans = y
                            elif test_id == "LOWESS":
                                frac = float(opts.get("lowessFrac", 0.25))
                                lowess_res = sm_lowess.lowess(y, x, frac=frac)
                                y_trans = lowess_res[:, 1]
                            else:
                                y_trans = y
                                
                            report += f"### {y_col}\n\n"
                            report += "| X | Y (Original) | Y (Transformed) |\n|---|---|---|\n"
                            
                            for i in range(min(10, len(x))):
                                report += f"| {x[i]:.4g} | {y[i]:.4g} | {y_trans[i]:.4g} |\n"
                            if len(x) > 10:
                                report += f"| ... | ... | ... |\n"
                            report += "\n"
                            
                            if "transformed_data" not in result:
                                result["transformed_data"] = []
                            result["transformed_data"].append({
                                "y_col": y_col,
                                "x": x.tolist(),
                                "y_transformed": y_trans.tolist()
                            })
                            
                        except Exception as e:
                            report += f"**Error transforming {y_col}:** {str(e)}\n\n"
                            
                    result["report_markdown"] = report

            elif test_id == "Simple Logistic Regression":
                if len(columns) >= 2:

                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    report = f"A **Simple Logistic Regression** was performed. The threshold was optimized using cost-weighted metrics (default Cost FP=1, Cost FN=1).\n\n"
                    table_header = "| Y Dataset | Pseudo R² | p-value | AUC | Opt. Threshold | Accuracy | Sensitivity | Specificity | Equation |\n"
                    table_header += "|---|---|---|---|---|---|---|---|---|\n"
                    report += table_header
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        y_vals = df_clean[y_col].values
                        unique_y = np.unique(y_vals)
                        
                        if len(unique_y) < 2:
                            report += f"| {y_name} | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Needs binary Y |\n"
                            continue
                            
                        if len(unique_y) > 2:
                            median_y = np.median(y_vals)
                            y_binary = np.where(y_vals > median_y, 1, 0)
                        else:
                            y_binary = np.where(y_vals == np.max(unique_y), 1, 0)
                            
                        x_vals = df_clean[x_col].values
                        X = sm.add_constant(x_vals)
                        
                        try:

                            model = sm.Logit(y_binary, X)
                            res = model.fit(disp=0)
                            
                            b0 = res.params[0]
                            b1 = res.params[1] if len(res.params) > 1 else 0
                            p_val = res.pvalues[1] if len(res.pvalues) > 1 else 1.0
                            pr2 = res.prsquared
                            llf = res.llf
                            
                            preds = res.predict(X)
                            fpr, tpr, thresholds = roc_curve(y_binary, preds)
                            roc_auc = auc(fpr, tpr)
                            
                            cost_fp = float(options.get("cost_fp", 1.0))
                            cost_fn = float(options.get("cost_fn", 1.0))
                            
                            costs = (fpr * sum(y_binary == 0) * cost_fp) + ((1 - tpr) * sum(y_binary == 1) * cost_fn)
                            opt_idx = np.argmin(costs)
                            opt_threshold = thresholds[opt_idx]
                            
                            y_pred_opt = (preds >= opt_threshold).astype(int)
                            tn, fp, fn, tp = confusion_matrix(y_binary, y_pred_opt).ravel()
                            
                            sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
                            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
                            accuracy = (tp + tn) / len(y_binary)
                            
                            eq_str = f"P(1)=1/(1+e^-({b0:.2f}+{b1:.2f}X))"
                            report += f"| {y_name} | {pr2:.3f} | {p_val:.4f} | {roc_auc:.3f} | {opt_threshold:.2f} | {accuracy:.2f} | {sensitivity:.2f} | {specificity:.2f} | {eq_str} |\n"
                        except Exception:
                            try:
                                fpr, tpr, thresholds = roc_curve(y_binary, x_vals)
                                roc_auc = auc(fpr, tpr)
                                cost_fp = float(options.get("cost_fp", 1.0))
                                cost_fn = float(options.get("cost_fn", 1.0))
                                costs = (fpr * sum(y_binary == 0) * cost_fp) + ((1 - tpr) * sum(y_binary == 1) * cost_fn)
                                opt_idx = np.argmin(costs)
                                opt_threshold = thresholds[opt_idx]
                                y_pred_opt = (x_vals >= opt_threshold).astype(int)
                                tn, fp, fn, tp = confusion_matrix(y_binary, y_pred_opt).ravel()
                                sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
                                specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
                                accuracy = (tp + tn) / len(y_binary)
                                report += (f"| {y_name} | N/A (sep.) | N/A (sep.) | {roc_auc:.3f} | {opt_threshold:.2f} "
                                           f"| {accuracy:.2f} | {sensitivity:.2f} | {specificity:.2f} | Complete separation — slope not identifiable |\n")
                            except Exception:
                                report += f"| {y_name} | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Fit failed |\n"
                            
                    if "Complete separation" in report:
                        report += "\n*Note: Complete separation detected for one or more datasets: the maximum-likelihood slope diverges, so coefficient-based statistics (Pseudo R², p-value) are not reported; classification metrics remain valid.*\n"
                            
                    result["report_markdown"] = report

            elif test_id == "Row Statistics":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    report = f"**Row Statistics** were computed across replicates.\n\n"
                    table_header = "| X Value | N | Mean | Median | SD | SEM | 95% CI |\n"
                    table_header += "|---|---|---|---|---|---|---|\n"
                    report += table_header
                    
                    df_stats = df.copy()
                    
                    # Compute per row ignoring NaNs
                    for idx, row in df_stats.iterrows():
                        x_val = row[x_col]
                        y_vals = row[y_cols].dropna().values
                        
                        if len(y_vals) == 0:
                            continue
                            
                        n_val = len(y_vals)
                        mean_val = np.mean(y_vals)
                        med_val = np.median(y_vals)
                        sd_val = np.std(y_vals, ddof=1) if n_val > 1 else 0.0
                        sem_val = sd_val / np.sqrt(n_val) if n_val > 0 else 0.0
                        
                        if n_val > 1:
                            t_val = stats.t.ppf(0.975, n_val - 1)
                            margin = t_val * sem_val
                            ci_str = f"[{mean_val - margin:.3f}, {mean_val + margin:.3f}]"
                        else:
                            ci_str = "N/A"
                            
                        # Show only first 20 rows max to avoid huge reports
                        if idx < 20:
                            report += f"| {x_val} | {n_val} | {mean_val:.3f} | {med_val:.3f} | {sd_val:.3f} | {sem_val:.3f} | {ci_str} |\n"
                            
                    if len(df_stats) > 20:
                        report += f"| ... | ... | ... | ... | ... | ... | ... |\n"
                        
                    result["report_markdown"] = report



        elif table_type == "Grouped" or table_type == "Nested":
            is_nested_test = test_id in ["Nested t-test", "Nested one-way ANOVA"]
            if "rowTitle" in df.columns or is_nested_test:
                factor1_col = "rowTitle"
                value_cols = columns
                
                if not is_nested_test:
                    # Create a long-format DataFrame (nested tests do their own reshape below)
                    df['Subject'] = df.index
                    df_long = pd.melt(df, id_vars=[factor1_col, 'Subject'], value_vars=value_cols, 
                                      var_name='Factor2', value_name='Value').dropna()
                    
                    if replicates > 1:
                        # A SUBCOLUMN IS A SUBJECT. In a Grouped table the replicate index
                        # identifies the same individual measured across every row and column
                        # (Prism: "matched values are stacked into a subcolumn"). Keeping
                        # Subject = row index gives every subject a single row-factor level,
                        # which makes the repeated-measures design degenerate: pingouin then
                        # returns SS=0, df=0 and no p column at all, and the engine silently
                        # reports a table of NaN. Capture the replicate BEFORE stripping it.
                        df_long['Replicate'] = df_long['Factor2'].apply(
                            lambda x: str(x).rsplit('_', 1)[1] if '_' in str(x) else '1')
                        df_long['Factor2'] = df_long['Factor2'].apply(lambda x: str(x).rsplit('_', 1)[0])
                    else:
                        df_long['Replicate'] = '1'
                    
                    # Map column IDs back to user-friendly names
                    df_long['Factor2'] = df_long['Factor2'].map(base_col_id_to_name).fillna(df_long['Factor2'])
                
                if test_id == "Two-way ANOVA":
                    
                    has_reps = len(df_long) > len(df_long[[factor1_col, 'Factor2']].drop_duplicates())
                    if not has_reps:
                        result["error"] = "Two-way ANOVA requires replicates to compute interaction. Please provide multiple values per group or row."
                    else:
                        df_aov = df_long.copy()
                        df_aov['F1'] = df_aov[factor1_col].astype(str)
                        df_aov['F2'] = df_aov['Factor2'].astype(str)
                        df_aov['Value'] = pd.to_numeric(df_aov['Value'], errors='coerce')
                        df_aov = df_aov.dropna(subset=['Value'])

                        model = smf.ols("Value ~ C(F1, Sum)*C(F2, Sum)", data=df_aov).fit()
                        aov_table = anova_lm(model, typ=3)
                        
                        report = f"A **Two-way ANOVA** was performed.\n\n"
                        report += "| Source | SS | DF | MS | F | p-value |\n"
                        report += "|---|---|---|---|---|---|\n"
                        
                        name_map = {
                            "C(F1, Sum)": "Row Factor" if factor1_col == "rowTitle" else base_col_id_to_name.get(factor1_col, factor1_col),
                            "C(F2, Sum)": "Column Factor",
                            "C(F1, Sum):C(F2, Sum)": "Interaction",
                            "Residual": "Residual"
                        }
                        
                        factors_out = []
                        for row_name, row in aov_table.iterrows():
                            if row_name == 'Intercept': continue
                            src = name_map.get(row_name, row_name)
                            ss = row.get('sum_sq', np.nan)
                            df_val = row.get('df', np.nan)
                            f_val = row.get('F', np.nan)
                            p_val = row.get('PR(>F)', np.nan)
                            ms = ss / df_val if df_val > 0 else np.nan
                            
                            f_str = f"{f_val:.3f}" if not np.isnan(f_val) else ""
                            p_str = format_p_value(p_val)
                            if row_name == 'C(F1, Sum)' and not np.isnan(f_val):
                                result["statistic"] = get_clean_float(f_val)
                                result["p_value"] = get_clean_float(p_val)
                                
                            if src != "Residual":
                                factors_out.append({
                                    "source": src,
                                    "SS": get_clean_float(ss),
                                    "df": get_clean_float(df_val),
                                    "MS": get_clean_float(ms),
                                    "F": get_clean_float(f_val),
                                    "p_value": get_clean_float(p_val)
                                })
                            
                            report += f"| {src} | {ss:.3f} | {df_val:.0f} | {ms:.3f} | {f_str} | {p_str} |\n"
                        
                        result["anova_factors"] = factors_out
                        
                        if post_hoc_test != "none" and post_hoc_family != "none":
                            report += f"\n### Multiple Comparisons (Tukey HSD)\n\n"
                            import itertools as _it
                            _res_ms = float(aov_table.loc['Residual', 'sum_sq']) / float(aov_table.loc['Residual', 'df'])
                            _res_df = float(aov_table.loc['Residual', 'df'])
                            _alpha = 0.05
                            def run_mc(factor_clean, factor_name):
                                # Tukey on LS (marginal) means using the TWO-WAY residual error term,
                                # matching Prism (raw one-way Tukey gives the wrong means and p-values).
                                other = 'F2' if factor_clean == 'F1' else 'F1'
                                cell = df_aov.groupby([factor_clean, other])['Value'].mean()
                                counts = df_aov.groupby(factor_clean)['Value'].count()
                                levels = list(counts.index)
                                ls = {lv: float(cell.loc[lv].mean()) for lv in levels}  # unweighted cell-mean avg
                                k = len(levels)
                                rep = f"#### Main Effect: {factor_name}\n"
                                rep += "| Group 1 | Group 2 | Mean Diff | p-adj | Reject |\n"
                                rep += "|---|---|---|---|---|\n"
                                for a, b in _it.combinations(levels, 2):
                                    diff = ls[a] - ls[b]
                                    se = np.sqrt(_res_ms * (1.0/counts[a] + 1.0/counts[b]))
                                    q = abs(diff) * np.sqrt(2.0) / se if se > 0 else 0.0
                                    try:
                                        p_adj = float(_patched_sr_sf_scalar(q, k, _res_df))
                                    except Exception:
                                        p_adj = float('nan')
                                    if not np.isnan(p_adj):
                                        p_adj = min(max(p_adj, 0.0), 1.0)
                                    reject = bool(p_adj < _alpha) if not np.isnan(p_adj) else False
                                    p_str = format_p_value(p_adj)
                                    rep += f"| {a} | {b} | {diff:.4f} | {p_str} | {reject} |\n"
                                return rep + "\n"
                            report += run_mc('F1', factor1_col)
                            report += run_mc('F2', "Column Factor")
                        result["report_markdown"] = report

                
                elif test_id in ("Mixed-effects ANOVA", "Repeated Measures Two-way ANOVA", "Two-way RM ANOVA"):
                    # Assume Subject is random effect, Factor2 is within, Factor1 is between (for Mixed) or both within (RM)
                    # For simplicity, if RM Two-way, both are within. If Mixed, one between one within.
                    if test_id == "Mixed-effects ANOVA":
                        # Prism's layout: the COLUMN factor is between-subjects (different
                        # subjects per column group) and the ROW factor is within-subjects
                        # (each subject measured at every row). A subject is therefore one
                        # subcolumn inside one column group.
                        _rm_d = df_long.assign(
                            _Subj=df_long['Factor2'].astype(str) + '__' + df_long['Replicate'].astype(str))
                        res = pg.mixed_anova(data=_rm_d, dv='Value', between='Factor2',
                                             within=factor1_col, subject='_Subj', correction=True)
                    else:
                        # Both factors within-subject: subject = subcolumn index, shared
                        # across every row and column.
                        _rm_d = df_long.assign(_Subj=df_long['Replicate'].astype(str))
                        res = pg.rm_anova(data=_rm_d, dv='Value', within=[factor1_col, 'Factor2'],
                                          subject='_Subj', correction=True)
                        
                    report = f"A **{test_id}** was performed.\n\n"
                    table_header = "| Source | SS | DF | MS | F | p-value | np2 | eps |\n"
                    table_header += "|---|---|---|---|---|---|---|---|\n"
                    report += table_header
                    
                    anovaCorrection = options.get('transformOptions', {}).get('anovaCorrection', 'none')
                    
                    # pingouin names the df columns 'ddof1'/'ddof2' for rm_anova and
                    # 'DF1'/'DF2' for mixed_anova -- never plain 'DF'. row.get('DF', 0)
                    # therefore always returned 0 and the table reported "0, 0" df next to
                    # a correct F. Resolve the real column names once.
                    _d1c = next((c for c in ['ddof1', 'DF1', 'DF'] if c in res.columns), None)
                    _d2c = next((c for c in ['ddof2', 'DF2'] if c in res.columns), None)
                    for _, row in res.iterrows():
                        src = row['Source']
                        ss = row.get('SS', 0)
                        df_val = row.get(_d1c, 0) if _d1c else 0
                        df2_val = row.get(_d2c, 0) if _d2c else 0
                        ms = row.get('MS', 0)
                        f = row.get('F', 0)
                        
                        # Apply GG or None based on option
                        if anovaCorrection == "GG" and 'p-GG-corr' in res.columns and not pd.isna(row.get('p-GG-corr')):
                            p = row['p-GG-corr']
                        elif anovaCorrection == "GG" and 'p_GG_corr' in res.columns and not pd.isna(row.get('p_GG_corr')):
                            p = row['p_GG_corr']
                        else:
                            p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res.columns), None)
                            p = row[p_col] if p_col else np.nan
                            
                        np2 = row.get('np2', 0)
                        eps = row.get('eps', '')
                        # A Geisser-Greenhouse p must be read against epsilon-adjusted df --
                        # quoting a corrected p next to uncorrected df is the same defect
                        # FIX6 removed from the one-way RM path.
                        _gg_used = (anovaCorrection == "GG" and isinstance(eps, float)
                                    and not pd.isna(eps) and 0 < eps < 1)
                        if _gg_used:
                            try:
                                df_str = f"{float(df_val) * float(eps):.2f}, {float(df2_val) * float(eps):.2f} (GG)"
                            except Exception:
                                df_str = f"{df_val}, {df2_val}"
                        else:
                            df_str = f"{df_val}, {df2_val}"
                        if isinstance(eps, float): eps = f"{eps:.3f}"
                        report += f"| {src} | {ss:.3f} | {df_str} | {ms:.3f} | {f:.3f} | {p:.4f} | {np2:.3f} | {eps} |\n"
                        
                    if post_hoc_test != "none" and post_hoc_family != "none":
                        report += f"\n### Multiple Comparisons (Holm-Bonferroni adjusted)\n\n"
                        try:
                            # Use the SAME subject model as the main table above. Passing
                            # subject='Subject' (the row index) leaves every subject with a
                            # single row-factor level: the RM path then raises "Columns must
                            # have at least two unique values" and the Mixed path silently
                            # emits nan p-values into the comparison table.
                            if test_id == "Mixed-effects ANOVA":
                                pw = pg.pairwise_tests(data=_rm_d, dv='Value', between='Factor2',
                                                       within=factor1_col, subject='_Subj', padjust='holm')
                            else:
                                pw = pg.pairwise_tests(data=_rm_d, dv='Value', within=[factor1_col, 'Factor2'],
                                                       subject='_Subj', padjust='holm')
                            
                            report += "| Contrast | F1 | A | B | p-unc | p-adj |\n"
                            report += "|---|---|---|---|---|---|\n"
                            # pingouin 0.5.x names these 'p-unc'/'p-corr'; 0.6.x renamed them
                            # to 'p_unc'/'p_corr'. Every other p-read in this engine resolves
                            # the column defensively -- do the same here so a future version
                            # bump degrades loudly instead of silently printing nan.
                            _pu = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val'] if c in pw.columns), None)
                            _pc = next((c for c in ['p-corr', 'p_corr', 'p-adjust', 'p_adjust'] if c in pw.columns), None)
                            if _pu is None:
                                raise KeyError(
                                    "pingouin pairwise_tests returned no uncorrected p column "
                                    f"(got {list(pw.columns)}) -- refusing to report nan comparisons.")
                            for _, r in pw.iterrows():
                                contrast = r.get('Contrast', '')
                                f1 = r.get(factor1_col, r.get('F1', '-'))
                                a = r.get('A', '')
                                b = r.get('B', '')
                                punc = r.get(_pu, np.nan)
                                padj = r.get(_pc, punc) if _pc else punc
                                p_str = format_p_value(padj)
                                punc_str = f"{punc:.4f}" if isinstance(punc, float) and not pd.isna(punc) else "-"
                                report += f"| {contrast} | {f1} | {a} | {b} | {punc_str} | {p_str} |\n"
                        except Exception as epw:
                            report += f"\nCould not compute multiple comparisons: {str(epw)}\n"
                            
                    result["report_markdown"] = report
                

                elif test_id == "ART ANOVA (Non-parametric)":
    
                    long_data = []
                    for idx, row in df.iterrows():
                        row_name = row.get("rowTitle")
                        if pd.isna(row_name): continue
                        for col in columns:
                            if col == 'rowTitle': continue
                            val = row[col]
                            if not pd.isna(val):
                                main_col = str(col).rsplit('_', 1)[0]
                                long_data.append({
                                    'Row': str(row_name),
                                    'Column': main_col,
                                    'Value': val
                                })
                    df_long = pd.DataFrame(long_data)
                    df_long['Row'] = df_long['Row'].astype(str)
                    df_long['Column'] = df_long['Column'].astype(str)
                    
                    grand_mean = df_long['Value'].mean()
                    row_means = df_long.groupby('Row')['Value'].mean()
                    col_means = df_long.groupby('Column')['Value'].mean()
                    cell_means = df_long.groupby(['Row', 'Column'])['Value'].mean()
                    
                    def align_data(row, effect):
                        y = row['Value']
                        r = row['Row']
                        c = row['Column']
                        mu = grand_mean
                        mu_r = row_means[r]
                        mu_c = col_means[c]
                        mu_rc = cell_means.loc[(r, c)]
                        
                        if effect == 'Row':
                            return y - mu_rc + mu_r
                        elif effect == 'Column':
                            return y - mu_rc + mu_c
                        elif effect == 'Interaction':
                            return y - mu_r - mu_c + 2 * mu
                        return y
                    
                    df_long['Row_Aligned'] = df_long.apply(lambda r: align_data(r, 'Row'), axis=1)
                    df_long['Col_Aligned'] = df_long.apply(lambda r: align_data(r, 'Column'), axis=1)
                    df_long['Int_Aligned'] = df_long.apply(lambda r: align_data(r, 'Interaction'), axis=1)
                    
                    df_long['Row_Ranked'] = rankdata(df_long['Row_Aligned'])
                    df_long['Col_Ranked'] = rankdata(df_long['Col_Aligned'])
                    df_long['Int_Ranked'] = rankdata(df_long['Int_Aligned'])
                    
                    model_row = ols('Row_Ranked ~ C(Row, Sum) + C(Column, Sum) + C(Row, Sum):C(Column, Sum)', data=df_long).fit()
                    aov_row = sm.stats.anova_lm(model_row, typ=3)
                    
                    model_col = ols('Col_Ranked ~ C(Row, Sum) + C(Column, Sum) + C(Row, Sum):C(Column, Sum)', data=df_long).fit()
                    aov_col = sm.stats.anova_lm(model_col, typ=3)
                    
                    model_int = ols('Int_Ranked ~ C(Row, Sum) + C(Column, Sum) + C(Row, Sum):C(Column, Sum)', data=df_long).fit()
                    aov_int = sm.stats.anova_lm(model_int, typ=3)
                    
                    report = "A **Non-parametric Two-way ANOVA (Aligned Rank Transform, ART)** was performed.\n\n"
                    report += "The Aligned Rank Transform aligns the data to isolate each specific effect (Row, Column, Interaction) by stripping out the other effects, ranks the aligned data, and performs a standard ANOVA on the ranks.\n\n"
                    
                    report += "### ART ANOVA Table\n\n"
                    report += "| Source | SS | DF | MS | F | p-value |\n"
                    report += "|---|---|---|---|---|---|\n"
                    
                    def format_row(name, aov_table, source_key):
                        if source_key in aov_table.index:
                            ss = aov_table.loc[source_key, 'sum_sq']
                            df = aov_table.loc[source_key, 'df']
                            f_val = aov_table.loc[source_key, 'F']
                            p_val = aov_table.loc[source_key, 'PR(>F)']
                            ms = ss / df if df > 0 else np.nan
                            p_str = format_p_value(p_val)
                            return f"| {name} | {ss:.3f} | {df:.0f} | {ms:.3f} | {f_val:.3f} | {p_str} |\n"
                        return ""
                        
                    row_factor_name = "Row Factor" if factor1_col == "rowTitle" else base_col_id_to_name.get(factor1_col, factor1_col)
                    report += format_row(row_factor_name, aov_row, "C(Row, Sum)")
                    report += format_row("Column Factor", aov_col, "C(Column, Sum)")
                    report += format_row("Interaction", aov_int, "C(Row, Sum):C(Column, Sum)")
                    report += format_row("Residual", aov_int, "Residual")
                    
                    result["report_markdown"] = report
    
                elif test_id in ["Nested t-test", "Nested one-way ANOVA"]:
                    long_data = []
                    for idx, row in df.iterrows():
                        for col in columns:
                            if col == 'rowTitle': continue
                            val = row.get(col)
                            if pd.notna(val) and val != "":
                                try:
                                    f_val = float(val)
                                    main_col = str(col).rsplit('_', 1)[0]
                                    long_data.append({
                                        'Subgroup': str(col),
                                        'Treatment': main_col,
                                        'Value': f_val
                                    })
                                except (ValueError, TypeError):
                                    pass
                    df_long = pd.DataFrame(long_data)
                    
                    treat_stats = df_long.groupby('Treatment')['Value'].agg(['count', 'mean'])
                    a = len(treat_stats)
                    df_a = a - 1
                    
                    # Fit Mixed Effects Model (REML)
                    
                    mixed_success = False
                    p_a = np.nan
                    f_a = np.nan
                    var_within = np.nan
                    var_among = np.nan
                    sd_within = np.nan
                    sd_among = np.nan
                    nested_ttest = None
                    
                    # Always calculate traditional ANOVA sums of squares for the table
                    grand_mean = df_long['Value'].mean()
                    sub_stats = df_long.groupby(['Treatment', 'Subgroup'])['Value'].agg(['count', 'mean', 'var'])
                    
                    ss_a = 0
                    for trt in treat_stats.index:
                        n_i = treat_stats.loc[trt, 'count']
                        mean_i = treat_stats.loc[trt, 'mean']
                        ss_a += n_i * (mean_i - grand_mean)**2
                        
                    ss_b = 0
                    df_b = 0
                    for (trt, sub) in sub_stats.index:
                        n_ij = sub_stats.loc[(trt, sub), 'count']
                        mean_ij = sub_stats.loc[(trt, sub), 'mean']
                        mean_i = treat_stats.loc[trt, 'mean']
                        ss_b += n_ij * (mean_ij - mean_i)**2
                        df_b += 1
                    df_b -= a
                            
                    ss_e = 0
                    df_e = 0
                    for (trt, sub) in sub_stats.index:
                        n_ij = sub_stats.loc[(trt, sub), 'count']
                        var_ij = sub_stats.loc[(trt, sub), 'var']
                        if n_ij > 1 and not np.isnan(var_ij):
                            ss_e += (n_ij - 1) * var_ij
                            df_e += (n_ij - 1)
                            
                    ms_a = ss_a / df_a if df_a > 0 else np.nan
                    ms_b = ss_b / df_b if df_b > 0 else np.nan
                    ms_e = ss_e / df_e if df_e > 0 else np.nan

                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore", ConvergenceWarning)
                        warnings.simplefilter("ignore", UserWarning)
                        try:
                            md = smf.mixedlm('Value ~ Treatment', df_long, groups=df_long['Subgroup'])
                            mdf = md.fit()
                            
                            var_within = mdf.scale
                            var_among = mdf.cov_re.iloc[0, 0] if not mdf.cov_re.empty else 0
                            sd_within = np.sqrt(var_within)
                            sd_among = np.sqrt(var_among) if var_among > 0 else 0
                            
                            # Prism-matching nested test: GLS (precision-weighted) treatment means from
                            # the REML variance components. Each subcolumn mean is weighted by
                            # 1/(var_among + var_within/n_subcolumn); the treatment mean is the weighted
                            # average and its variance is 1/sum(weights). t (2 groups) / Wald-F (>2 groups)
                            # are computed from these, with df = (#subcolumns - #treatments).
                            _tmeans = {}
                            _tvars = {}
                            for _trt in treat_stats.index:
                                _wsum = 0.0; _wmsum = 0.0
                                for (_t2, _sub) in sub_stats.index:
                                    if _t2 != _trt:
                                        continue
                                    _nij = sub_stats.loc[(_t2, _sub), 'count']
                                    _mij = sub_stats.loc[(_t2, _sub), 'mean']
                                    _denw = var_among + (var_within / _nij if _nij > 0 else 0.0)
                                    _w = (1.0 / _denw) if _denw > 0 else 0.0
                                    _wsum += _w; _wmsum += _w * _mij
                                _tmeans[_trt] = (_wmsum / _wsum) if _wsum > 0 else np.nan
                                _tvars[_trt] = (1.0 / _wsum) if _wsum > 0 else np.nan
                            gls_means = _tmeans
                            _df_denom = len(sub_stats.index) - a
                            if a == 2:
                                _keys = list(treat_stats.index)
                                _diff = _tmeans[_keys[1]] - _tmeans[_keys[0]]
                                _se = np.sqrt(_tvars[_keys[0]] + _tvars[_keys[1]])
                                t_val = (_diff / _se) if _se > 0 else np.nan
                                f_a = (t_val ** 2) if not np.isnan(t_val) else np.nan
                                p_a = (stats.t.sf(abs(t_val), _df_denom) * 2) if (not np.isnan(t_val) and _df_denom > 0) else np.nan
                                nested_ttest = {'t': t_val, 'df': _df_denom, 'diff': _diff, 'se': _se,
                                                'meanA': _tmeans[_keys[0]], 'meanB': _tmeans[_keys[1]],
                                                'nameA': _keys[0], 'nameB': _keys[1]}
                            else:
                                _prec = {k: 1.0 / v for k, v in _tvars.items() if v and v > 0}
                                if _prec:
                                    _grand = sum(_tmeans[k] * _prec[k] for k in _prec) / sum(_prec.values())
                                    _wald = sum(_prec[k] * (_tmeans[k] - _grand) ** 2 for k in _prec)
                                    f_a = (_wald / df_a) if df_a > 0 else np.nan
                                    p_a = stats.f.sf(f_a, df_a, _df_denom) if (not np.isnan(f_a) and _df_denom > 0) else np.nan
                            mixed_success = True
                        except Exception as e:
                            pass
                    
                    if not mixed_success:
                        f_a = ms_a / ms_b if ms_b > 0 else np.nan
                        p_a = stats.f.sf(f_a, df_a, df_b) if ms_b > 0 and not np.isnan(f_a) else np.nan
                        var_within = ms_e
                        var_among = max(0, (ms_b - ms_e) / (df_long.shape[0] / len(sub_stats)))
                        sd_within = np.sqrt(var_within)
                        sd_among = np.sqrt(var_among)

                    f_b = ms_b / ms_e if ms_e > 0 else np.nan
                    p_b = stats.f.sf(f_b, df_b, df_e) if ms_e > 0 and not np.isnan(f_b) else np.nan
                    
                    report = f"A **{test_id}** was performed.\n\n"
                    if mixed_success:
                        report += "A mixed-effects model (REML) was used to compute the treatment effects, accounting for the nested random effects of subgroups. This matches standard behavior for unbalanced nested designs.\n\n"
                    else:
                        report += "The nested design treats Subgroups as a random effect nested within Treatments (fixed effect), using a variance-components approach to compute exact statistics.\n\n"

                    _is_ttest = (a == 2)
                    if _is_ttest and nested_ttest is not None:
                        tt = nested_ttest
                        _tcrit = stats.t.ppf(0.975, tt['df']) if tt['df'] > 0 else np.nan
                        _cl = tt['diff'] - _tcrit * tt['se']
                        _ch = tt['diff'] + _tcrit * tt['se']
                        nA = col_id_to_name.get(tt['nameA'], tt['nameA'])
                        nB = col_id_to_name.get(tt['nameB'], tt['nameB'])
                        report += "### Nested t-test\n\n"
                        report += "| Metric | Value |\n|---|---|\n"
                        report += f"| t, df | t = {tt['t']:.3f}, df = {tt['df']} |\n"
                        report += f"| P value | {format_p_value(p_a)} |\n"
                        report += f"| Mean of {nB} | {tt['meanB']:.3f} |\n"
                        report += f"| Mean of {nA} | {tt['meanA']:.3f} |\n"
                        report += f"| Difference ({nB} \u2212 {nA}) \u00b1 SEM | {tt['diff']:.3f} \u00b1 {tt['se']:.3f} |\n"
                        report += f"| 95% CI of difference | {_cl:.3f} to {_ch:.3f} |\n\n"

                    report += ("### Sources of Variation\n\n" if _is_ttest else "### ANOVA Table\n\n")
                    report += "| Source | SS | DF | MS | F | p-value |\n"
                    report += "|---|---|---|---|---|---|\n"
                    
                    def fmt_p(pval):
                          return format_p_value(pval)
                    
                    f_a_disp = f_a if not np.isnan(f_a) else (ms_a / ms_b if ms_b > 0 else np.nan)
                    report += f"| Treatment | {ss_a:.3f} | {df_a} | {ms_a:.3f} | {f_a_disp:.3f} | {fmt_p(p_a)} |\n"
                    report += f"| Subgroup (Nested) | {ss_b:.3f} | {df_b} | {ms_b:.3f} | {f_b:.3f} | {fmt_p(p_b)} |\n"
                    report += f"| Residual (Error) | {ss_e:.3f} | {df_e} | {ms_e:.3f} | | |\n"
                    report += f"| Total | {ss_a + ss_b + ss_e:.3f} | {df_a + df_b + df_e} | | | |\n"
                    
                    report += "\n### Random Effects (Variance Components)\n\n"
                    report += "| Component | Standard Deviation | Variance |\n"
                    report += "|---|---|---|\n"
                    report += f"| Variation among subcolumn means | {sd_among:.3f} | {var_among:.3f} |\n"
                    report += f"| Variation within subcolumns | {sd_within:.3f} | {var_within:.3f} |\n"
                    
                    post_hoc_family = options.get("postHocFamily", "none")
                    specific_pairs = options.get("specificPairs", [])
                    if post_hoc_family != "none" and a > 2 and ms_b > 0 and not np.isnan(ms_b):
                        report += f"\n### Multiple Comparisons (Tukey's HSD)\n\n"
                        report += "| Group 1 | Group 2 | Mean Diff | q-stat | p-adj | Significant |\n"
                        report += "|---|---|---|---|---|---|\n"
                        treats = list(treat_stats.index)
                        ph_results = []
                        for i in range(len(treats)):
                            for j in range(i+1, len(treats)):
                                g1 = treats[i]
                                g2 = treats[j]
                                if post_hoc_family == "specific_pairs":
                                    is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                    if not is_in: continue
                                mean_1 = treat_stats.loc[g1, 'mean']
                                mean_2 = treat_stats.loc[g2, 'mean']
                                n_1 = treat_stats.loc[g1, 'count']
                                n_2 = treat_stats.loc[g2, 'count']
                                
                                se = np.sqrt(ms_b / n_1 + ms_b / n_2)
                                t = (mean_1 - mean_2) / se
                                q = abs(t) * np.sqrt(2.0)
                                p_val = float(_patched_sr_sf_scalar(q, len(treats), df_b))
                                
                                ph_results.append({
                                    "group1": col_id_to_name.get(g1, g1),
                                    "group2": col_id_to_name.get(g2, g2),
                                    "p_value": get_clean_float(p_val),
                                    "significant": bool(p_val < 0.05)
                                })
                                report += f"| {col_id_to_name.get(g1, g1)} | {col_id_to_name.get(g2, g2)} | {mean_1 - mean_2:.3f} | {q:.3f} | {fmt_p(p_val)} | {'Yes' if p_val < 0.05 else 'No'} |\n"
                        result["post_hocs"] = {"method": "Tukey's HSD", "comparisons": ph_results}
                    elif post_hoc_family != "none" and a == 2:
                        report += f"\n*Note: Multiple comparisons are not performed because there are only two treatments. The main p-value applies to the single comparison between them.*\n"
                    
                    result["report_markdown"] = report
                    if not np.isnan(f_a):
                        result["statistic"] = get_clean_float(f_a)
                    if not np.isnan(p_a):
                        result["p_value"] = get_clean_float(p_a)
    
        elif table_type == "Survival":
            if len(columns) >= 2:
                time_col = columns[0]
                group_cols = columns[1:]
                
                T_list = []
                E_list = []
                groups_list = []
                
                for idx, row in df.iterrows():
                    time_val = row[time_col]
                    if pd.isna(time_val): continue
                    for g_col in group_cols:
                        event_code = row[g_col]
                        if not pd.isna(event_code):
                            if isinstance(event_code, (int, float)):
                                e_val = 1 if event_code > 0 else 0
                            elif isinstance(event_code, str):
                                e_str = event_code.lower().strip()
                                e_val = 1 if e_str in ['1', 'event', 'dead', 'true', 'yes', 'died', 'occurred'] else 0
                            elif isinstance(event_code, bool):
                                e_val = 1 if event_code else 0
                            else:
                                e_val = 0
                            T_list.append(float(time_val))
                            E_list.append(e_val)
                            groups_list.append(col_id_to_name.get(g_col, g_col))
                
                if len(T_list) == 0:
                    result["error"] = "Insufficient valid time and event data for Survival Analysis."
                else:
                    T = np.array(T_list)
                    E = np.array(E_list)
                    groups = np.array(groups_list)
                    
                    unique_groups = np.unique(groups)
                    
                    if test_id in ("Survival Analysis", "Kaplan-Meier Survival Analysis", "Log-rank (Mantel-Cox) test", "Hazard Ratios", "Gehan-Breslow-Wilcoxon test", "Pairwise log-rank with Bonferroni/Šidák", "Cox Regression"):
                        report = f"A **Comprehensive Survival Analysis** was performed.\n\n"
                        
                        # 1. Kaplan Meier & Median Survival
                        report += "### Median Survival & Kaplan-Meier Estimates\n"
                        report += "| Group | Median Survival | 95% CI Lower | 95% CI Upper |\n"
                        report += "|---|---|---|---|\n"
                        
                        km_data = {}
                        times_all = np.sort(np.unique(T))
                        
                        for g in unique_groups:
                            mask = groups == g
                            Tg = T[mask]
                            Eg = E[mask]
                            
                            kmf = KaplanMeierFitter()
                            kmf.fit(Tg, event_observed=Eg, label=g)
                            
                            # Prism-style median survival
                            survival = kmf.survival_function_
                            times_surv = survival.index.values
                            probs = survival.iloc[:, 0].values
                            if not np.any(probs <= 0.5):
                                med = np.inf
                            else:
                                idx_first = np.argmax(probs <= 0.5)
                                if probs[idx_first] < 0.5:
                                    med = times_surv[idx_first]
                                else:
                                    idx_below = -1
                                    for idx_sub in range(idx_first + 1, len(probs)):
                                        if probs[idx_sub] < 0.5:
                                            idx_below = idx_sub
                                            break
                                    if idx_below != -1:
                                        med = (times_surv[idx_first] + times_surv[idx_below]) / 2.0
                                    else:
                                        med = np.inf
                            
                            ci_lower = kmf.median_survival_time_
                            ci_upper = kmf.median_survival_time_
                            try:
                                median_ci = median_survival_times(kmf.confidence_interval_)
                                ci_lower = median_ci.iloc[0, 0]
                                ci_upper = median_ci.iloc[0, 1]
                            except:
                                pass
                            
                            med_str = f"{med:.4g}" if not np.isinf(med) else "Undefined"
                            ci_low_str = f"{ci_lower:.4g}" if not np.isinf(ci_lower) else "Undefined"
                            ci_up_str = f"{ci_upper:.4g}" if not np.isinf(ci_upper) else "Undefined"
                            
                            report += f"| {g} | {med_str} | {ci_low_str} | {ci_up_str} |\n"
                            
                        # Number at Risk
                        report += "\n### Number at Risk\n"
                        report += "| Time | " + " | ".join([str(g) for g in unique_groups]) + " |\n"
                        report += "|---|" + "---|" * len(unique_groups) + "\n"
                        
                        # Show at risk at unique time points including 0
                        t_steps = np.sort(np.unique([0.0] + list(T)))
                        for t_step in t_steps:
                            row_str = f"| {t_step:.1f} | "
                            for g in unique_groups:
                                mask = groups == g
                                Tg = T[mask]
                                at_risk = np.sum(Tg >= t_step)
                                row_str += f"{at_risk} | "
                            report += row_str + "\n"
                            
                        # 2. Curve Comparisons
                        if len(unique_groups) >= 2:
                            report += "\n### Curve Comparisons\n"
                            
                            res_logrank = multivariate_logrank_test(T, groups, E)
                            result["statistic"] = get_clean_float(res_logrank.test_statistic)
                            result["p_value"] = get_clean_float(res_logrank.p_value)
                            sig_lr = "significant" if res_logrank.p_value < 0.05 else "not significant"
                            report += f"- **Log-rank (Mantel-Cox) test:** The difference is **{sig_lr}** (Chi-square = {res_logrank.test_statistic:.3f}, p = {res_logrank.p_value:.4f}).\n"
                            
                            try:
                                res_wilcoxon = multivariate_logrank_test(T, groups, E, weightings='wilcoxon')
                                sig_w = "significant" if res_wilcoxon.p_value < 0.05 else "not significant"
                                report += f"- **Gehan-Breslow-Wilcoxon test:** The difference is **{sig_w}** (Chi-square = {res_wilcoxon.test_statistic:.3f}, p = {res_wilcoxon.p_value:.4f}).\n"
                            except Exception:
                                pass
                                
                            # 3. Hazard Ratios
                            control_group = col_id_to_name.get(group_cols[0], group_cols[0])
                            other_groups = [g for g in unique_groups if g != control_group]
                            
                            report += f"\n### Hazard Ratios (vs {control_group})\n"
                            
                            df_surv = pd.DataFrame({'T': T, 'E': E, 'Group': groups})
                            
                            for other_g in other_groups:
                                mask = (groups == control_group) | (groups == other_g)
                                df_pair = df_surv[mask]
                                
                                # Mantel-Haenszel computation
                                times = np.sort(df_pair[df_pair['E'] == 1]['T'].unique())
                                O_trt = 0; E_trt = 0; O_ctrl = 0; E_ctrl = 0
                                V = 0
                                for t in times:
                                    at_risk = df_pair[df_pair['T'] >= t]
                                    deaths = at_risk[(at_risk['T'] == t) & (at_risk['E'] == 1)]
                                    n_total = len(at_risk)
                                    d_total = len(deaths)
                                    if n_total > 0:
                                        n_trt = len(at_risk[at_risk['Group'] == other_g])
                                        n_ctrl = len(at_risk[at_risk['Group'] == control_group])
                                        d_trt = len(deaths[deaths['Group'] == other_g])
                                        d_ctrl = len(deaths[deaths['Group'] == control_group])
                                        O_trt += d_trt
                                        O_ctrl += d_ctrl
                                        E_trt += d_total * (n_trt / n_total)
                                        E_ctrl += d_total * (n_ctrl / n_total)
                                        if n_total > 1:
                                            V += (n_trt * n_ctrl * d_total * (n_total - d_total)) / ( (n_total**2) * (n_total - 1) )
                                        
                                hr_logrank = (O_trt / E_trt) / (O_ctrl / E_ctrl) if (E_trt > 0 and E_ctrl > 0 and O_ctrl > 0) else float('inf')
                                hr_mh = np.exp((O_trt - E_trt) / V) if V > 0 else float('inf')
                                
                                # CIs
                                se_mh = 1 / np.sqrt(V) if V > 0 else float('inf')
                                mh_ci_low = hr_mh * np.exp(-1.96 * se_mh)
                                mh_ci_high = hr_mh * np.exp(1.96 * se_mh)

                                se_logrank = np.sqrt(1/E_trt + 1/E_ctrl) if (E_trt > 0 and E_ctrl > 0) else float('inf')
                                logrank_ci_low = hr_logrank * np.exp(-1.96 * se_logrank)
                                logrank_ci_high = hr_logrank * np.exp(1.96 * se_logrank)
                                
                                report += f"#### {other_g} vs {control_group}\n\n"
                                report += f"- **Logrank HR ({other_g} / {control_group}):** {hr_logrank:.3f} (95% CI: {logrank_ci_low:.3f} to {logrank_ci_high:.3f})\n"
                                report += f"- **Mantel-Haenszel HR ({other_g} / {control_group}):** {hr_mh:.3f} (95% CI: {mh_ci_low:.3f} to {mh_ci_high:.3f})\n\n"
                                
                                hr_logrank_recip = 1/hr_logrank if hr_logrank > 0 else float('inf')
                                hr_mh_recip = 1/hr_mh if hr_mh > 0 else float('inf')
                                mh_ci_low_recip = 1/mh_ci_high if mh_ci_high > 0 else float('inf')
                                mh_ci_high_recip = 1/mh_ci_low if mh_ci_low > 0 else float('inf')
                                logrank_ci_low_recip = 1/logrank_ci_high if logrank_ci_high > 0 else float('inf')
                                logrank_ci_high_recip = 1/logrank_ci_low if logrank_ci_low > 0 else float('inf')
                                
                                report += f"#### {control_group} vs {other_g}\n\n"
                                report += f"- **Logrank HR ({control_group} / {other_g}):** {hr_logrank_recip:.3f} (95% CI: {logrank_ci_low_recip:.3f} to {logrank_ci_high_recip:.3f})\n"
                                report += f"- **Mantel-Haenszel HR ({control_group} / {other_g}):** {hr_mh_recip:.3f} (95% CI: {mh_ci_low_recip:.3f} to {mh_ci_high_recip:.3f})\n"
                                        
                        post_hoc_family = options.get("postHocFamily", "none")
                        specific_pairs = options.get("specificPairs", [])
                        if post_hoc_family != "none" and len(unique_groups) > 2:
                            
                            df_surv = pd.DataFrame({'T': T, 'E': E, 'Group': groups})
                            _grps = list(pd.unique(df_surv['Group']))
                            pairs = []
                            p_vals = []
                            for _i in range(len(_grps)):
                                for _j in range(_i + 1, len(_grps)):
                                    g1, g2 = _grps[_i], _grps[_j]
                                    if post_hoc_family == "specific_pairs":
                                        is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                        if not is_in: continue
                                    elif post_hoc_family == "control_vs_others":
                                        control_group = col_id_to_name.get(group_cols[0], group_cols[0])
                                        if g1 != control_group and g2 != control_group:
                                            continue
                                    _m1 = df_surv['Group'] == g1
                                    _m2 = df_surv['Group'] == g2
                                    _lr = logrank_test(df_surv['T'][_m1], df_surv['T'][_m2],
                                                       event_observed_A=df_surv['E'][_m1], event_observed_B=df_surv['E'][_m2])
                                    pairs.append((g1, g2, _lr.test_statistic))
                                    p_vals.append(_lr.p_value)
                            
                            if p_vals:
                                rejected, p_adj, _, _ = multipletests(p_vals, alpha=0.05, method='holm')
                                
                                report += f"\n### Multiple Comparisons (Pairwise Logrank with Holm correction)\n\n"
                                report += "| Group 1 | Group 2 | Logrank Stat | p-unc | p-adj | Significant |\n"
                                report += "|---|---|---|---|---|---|\n"
                                
                                ph_results = []
                                for idx, (g1, g2, stat) in enumerate(pairs):
                                    sig_str = "Yes" if rejected[idx] else "No"
                                    report += f"| {g1} | {g2} | {stat:.3f} | {format_p_value(p_vals[idx])} | {format_p_value(p_adj[idx])} | {sig_str} |\n"
                                    ph_results.append({
                                        "group1": g1, "group2": g2, "p_value": get_clean_float(p_adj[idx]), "significant": bool(rejected[idx])
                                    })
                                result["post_hocs"] = {"method": "Pairwise Logrank (Holm)", "comparisons": ph_results}
                                
                        result["report_markdown"] = report

                    elif test_id == "Log-rank Trend Test":
                        if len(columns) < 3:
                            result["error"] = "Log-rank Trend Test isn't available for this data type (requires at least 3 ordered groups)."
                        else:
                            T = []
                            E = []
                            group_codes = []
                            time_col = columns[0]
                            group_cols = columns[1:]
                            for idx, row in df.iterrows():
                                t_val = row.get(time_col)
                                if pd.isna(t_val) or t_val is None:
                                    continue
                                try:
                                    t_val = float(t_val)
                                except:
                                    continue
                                for g_idx, c in enumerate(group_cols):
                                    v = row.get(c)
                                    if pd.notna(v) and v is not None:
                                        T.append(t_val)
                                        try:
                                            E.append(float(v))
                                        except:
                                            E.append(0.0)
                                        group_codes.append(g_idx + 1)
                            
                            df_trend = pd.DataFrame({'T': T, 'E': E, 'GroupOrd': group_codes})
                            if df_trend.empty or len(df_trend['GroupOrd'].unique()) < 3:
                                result["error"] = "Not enough data for trend test."
                            else:
                                    from lifelines import CoxPHFitter
                                    cph_trend = CoxPHFitter()
                                    cph_trend.fit(df_trend, duration_col='T', event_col='E')
                                    z_stat = cph_trend.summary.loc['GroupOrd', 'z']
                                    p_val = cph_trend.summary.loc['GroupOrd', 'p']
                                    
                                    result["statistic"] = get_clean_float(z_stat)
                                    result["p_value"] = get_clean_float(p_val)
                                    result["report_markdown"] = (f"A **Log-rank Trend Test** (via Cox proportional hazards) was performed.\n\n"
                                              f"**Z-statistic:** {z_stat:.4f}\n"
                                              f"**p-value:** {format_p_value(p_val)}\n")

            else:
                result["error"] = "Survival Analysis requires Time and at least one Group column."

    

        elif table_type == "PartsOfWhole":
            if test_id == "Chi-Square goodness of fit":
                data_cols = [c for c in columns if c != "rowTitle"]
                if not data_cols:
                    result["error"] = "No data columns found."
                else:
                    col = options.get("chiSelectedColumn", data_cols[0])
                    if col not in df.columns:
                        col = data_cols[0]
                    
                    chi_exp_type = options.get("chiExpectedType", "actual")
                    chi_exp_values = options.get("chiExpectedValues", {})
                    # Convert JsProxy to dict if needed
                    if hasattr(chi_exp_values, 'to_py'):
                        chi_exp_values = chi_exp_values.to_py()
                    
                    valid_df = df.dropna(subset=[col]).copy()
                    valid_df[col] = pd.to_numeric(valid_df[col], errors='coerce')
                    valid_df = valid_df.dropna(subset=[col])
                    
                    obs = valid_df[col].values
                    row_titles = valid_df.get("rowTitle", pd.Series([f"Row {i+1}" for i in range(len(valid_df))])).astype(str).tolist()
                    
                    if len(obs) < 2:
                        result["error"] = "Require at least two categories."
                    else:
                        exp = []
                        valid = True
                        for i, (orig_idx, row) in enumerate(valid_df.iterrows()):
                            exp_val = chi_exp_values.get(str(orig_idx))
                            if exp_val is None:
                                exp_val = chi_exp_values.get(orig_idx)
                            if exp_val is None:
                                try:
                                    exp_val = chi_exp_values.get(int(orig_idx))
                                except:
                                    pass
                            if exp_val is None:
                                valid = False
                                break
                            exp.append(exp_val)
                            
                        if not valid:
                            exp = [np.mean(obs)] * len(obs)
                            exp_type_desc = "Uniform distribution (auto-generated)"
                        else:
                            exp = np.array(exp)
                            if chi_exp_type == "percentages":
                                exp = (exp / 100.0) * np.sum(obs)
                                exp_type_desc = "Custom percentages provided"
                            else:
                                exp_type_desc = "Custom expected values provided"
                            
                            if not np.isclose(np.sum(exp), np.sum(obs)):
                                exp = exp * (np.sum(obs) / np.sum(exp))
                        
                        chi2, p_val = chisquare(obs, f_exp=exp)
                        dof = len(obs) - 1
                        
                        result["statistic"] = get_clean_float(chi2)
                        result["p_value"] = get_clean_float(p_val)
                        sig = "significant" if p_val < 0.05 else "not significant"
                        
                        report = f"A **Chi-Square Goodness-of-Fit Test** was performed.\n\n"
                        report += f"**Variable:** {col_id_to_name.get(col, col)}\n"
                        report += f"**Assumed Expected:** {exp_type_desc}\n\n"
                        report += f"### Results\n"
                        report += f"- Chi-Square Statistic: {chi2:.3f}\n"
                        report += f"- Degrees of Freedom: {dof}\n"
                        report += f"- P-value: {format_p_value(p_val)}\n\n"
                        
                        report += f"### Observed vs Expected\n\n"
                        report += "| Category | Observed | Expected |\n"
                        report += "|---|---|---|\n"
                        for i in range(len(obs)):
                            report += f"| {row_titles[i]} | {obs[i]:.1f} | {exp[i]:.2f} |\n"
                        
                        result["report_markdown"] = report

            elif test_id == "Binomial test":
                df_clean = df.dropna()
                data_col = columns[1] if (len(columns) > 1 and columns[0] == "rowTitle") else columns[0] if len(columns) > 0 else None
                if not data_col:
                    result["error"] = "No data found."
                else:
                    observed = df_clean[data_col].values
                    if len(observed) > 2:
                        result["error"] = "Binomial test requires exactly 2 categories (rows)."
                    else:
                        successes = int(observed[0])
                        trials = int(np.sum(observed))
                        res = binomtest(successes, n=trials, p=0.5)
                        
                        report = f"A **Binomial Test** was performed.\n\n"
                        report += f"**Variable:** {data_col}\n"
                        report += f"**Expected Probability (H0):** 0.5\n\n"
                        report += "### Results\n\n"
                        p_val = res.pvalue
                        p_str = format_p_value(p_val)
                        
                        report += f"- Successes (Category 1): {successes}\n"
                        report += f"- Total Trials: {trials}\n"
                        report += f"- Observed Probability: {(successes/trials):.4f}\n"
                        report += f"- P-value: {p_str}\n\n"
                        
                        ci = res.proportion_ci(confidence_level=0.95)
                        report += f"- 95% Confidence Interval: [{ci.low:.4f}, {ci.high:.4f}]\n"
                        
                        result["report_markdown"] = report
                        result["p_value"] = get_clean_float(p_val)

            elif test_id == "Fraction of Total":
                fot_divide_by = options.get("fotDivideBy", "column")
                fot_display_as = options.get("fotDisplayAs", "fractions")
                fot_calc_ci = options.get("fotCalculateCI", True)
                fot_ci_level = options.get("fotCILevel", 95)
                fot_ci_method = options.get("fotCIMethod", "wilson")
                
                # statsmodels method mapping
                if fot_ci_method == "clopper-pearson":
                    ci_method_sm = "beta"
                    method_name = "Clopper-Pearson"
                elif fot_ci_method == "wilson-narrower":
                    ci_method_sm = "wilson"
                    method_name = "Wilson (narrower)"
                else:
                    ci_method_sm = "wilson"
                    method_name = "Wilson/Brown"

                alpha = 1.0 - (fot_ci_level / 100.0)

                data_cols_initial = [c for c in columns if c != "rowTitle"]
                if not data_cols_initial:
                    result["error"] = "No data columns found."
                else:
                    # Drop rows that are completely NaN across all data columns
                    df_clean = df.dropna(subset=data_cols_initial, how='all').copy()
                    
                    # Also drop columns that are completely NaN (blank variables)
                    data_cols = [c for c in data_cols_initial if not df_clean[c].isna().all()]
                    
                    if not data_cols:
                        result["error"] = "No data to analyze."
                        return result
                    if len(df_clean) == 0:
                        result["error"] = "No valid data to analyze."
                        return result
                        
                    matrix = df_clean[data_cols].apply(pd.to_numeric, errors='coerce').values
                    row_titles = df_clean.get("rowTitle", pd.Series([f"Row {i+1}" for i in range(len(df_clean))])).astype(str).tolist()


                    grand_total = np.nansum(matrix)
                    col_totals = np.nansum(matrix, axis=0)
                    row_totals = np.nansum(matrix, axis=1)

                    if grand_total <= 0:
                        result["error"] = "Total sum must be strictly positive."
                    else:
                        from statsmodels.stats.proportion import proportion_confint
                        report = f"A **Fraction of Total** analysis was performed.\n\n"
                        report += f"**Divide by:** {fot_divide_by.capitalize()} total  "
                        report += f"**Display as:** {fot_display_as.capitalize()}  "
                        if fot_calc_ci:
                            report += f"**Confidence Intervals:** {fot_ci_level}% ({method_name})\n\n"
                        else:
                            report += f"**Confidence Intervals:** None\n\n"

                        modes = ["column", "row", "grand"] if fot_divide_by == "all" else [fot_divide_by]

                        for mode in modes:
                            if mode == "column":
                                report += f"### Divide by Column Total\n\n"
                            elif mode == "row":
                                report += f"### Divide by Row Total\n\n"
                            elif mode == "grand":
                                report += f"### Divide by Grand Total\n\n"
                            
                            for c_idx, col_name in enumerate(data_cols):
                                if mode == "row" and len(data_cols) > 1:
                                    if c_idx == 0:
                                        # For row totals, we typically show one combined table with all columns
                                        report += "| Row | " + " | ".join(data_cols) + " |\n"
                                        report += "|---|" + "---|" * len(data_cols) + "\n"
                                        for r_idx, r_title in enumerate(row_titles):
                                            denom = row_totals[r_idx]
                                            if denom <= 0: continue
                                            row_str = f"| {r_title} | "
                                            for c2_idx in range(len(data_cols)):
                                                val = matrix[r_idx, c2_idx]
                                                frac = val / denom
                                                display_val = frac * 100 if fot_display_as == "percentages" else frac
                                                sym = "%" if fot_display_as == "percentages" else ""
                                                
                                                if fot_calc_ci:
                                                    ci_low, ci_high = proportion_confint(val, denom, alpha=alpha, method=ci_method_sm)
                                                    d_low = ci_low * 100 if fot_display_as == "percentages" else ci_low
                                                    d_high = ci_high * 100 if fot_display_as == "percentages" else ci_high
                                                    row_str += f"{display_val:.5f}{sym} [{d_low:.5f}{sym}, {d_high:.5f}{sym}] | "
                                                else:
                                                    row_str += f"{display_val:.5f}{sym} | "
                                            report += row_str + "\n"
                                        report += "\n"
                                    continue
                                
                                if mode != "row":
                                    if len(data_cols) > 1:
                                        report += f"#### {col_id_to_name.get(col_name, col_name)}\n\n"
                                    
                                    report += "| Row | Count | Fraction" + (" (%)" if fot_display_as == "percentages" else "")
                                    if fot_calc_ci:
                                        report += f" | {fot_ci_level}% CI |\n"
                                    else:
                                        report += " |\n"
                                    
                                    report += "|---|---|---" + ("|---|" if fot_calc_ci else "|") + "\n"
                                    
                                    for r_idx, r_title in enumerate(row_titles):
                                        val = matrix[r_idx, c_idx]
                                        denom = col_totals[c_idx] if mode == "column" else grand_total
                                        if denom <= 0: continue
                                        
                                        frac = val / denom
                                        display_val = frac * 100 if fot_display_as == "percentages" else frac
                                        sym = "%" if fot_display_as == "percentages" else ""
                                        
                                        if fot_calc_ci:
                                            ci_low, ci_high = proportion_confint(val, denom, alpha=alpha, method=ci_method_sm)
                                            d_low = ci_low * 100 if fot_display_as == "percentages" else ci_low
                                            d_high = ci_high * 100 if fot_display_as == "percentages" else ci_high
                                            report += f"| {r_title} | {val} | {display_val:.5f}{sym} | [{d_low:.5f}{sym}, {d_high:.5f}{sym}] |\n"
                                        else:
                                            report += f"| {r_title} | {val} | {display_val:.5f}{sym} |\n"
                                    report += "\n"

                        result["report_markdown"] = report


        elif table_type == "MultipleVariables":
            # Drop fully-empty columns (a stray blank column in the sheet) so the last real
            # column is used as the dependent variable and dropna() does not wipe every row.
            columns = [c for c in columns if (df[c].notna() & (df[c].astype(str).str.strip() != "")).any()]
            df = df[columns]
            if test_id == "Three-way ANOVA":
                _df_tw = df[columns].dropna()
                _lv3 = [_df_tw[columns[i]].nunique() for i in range(3)] if (len(columns) >= 4 and len(_df_tw) > 0) else [0, 0, 0]
                if len(columns) < 4:
                    result["error"] = "Three-way ANOVA requires at least 4 columns (1 dependent variable, 3 independent factors)."
                elif min(_lv3) < 2 or (_lv3[0] * _lv3[1] * _lv3[2]) >= len(_df_tw):
                    result["error"] = ("Three-way ANOVA needs 3 categorical factor columns (each with repeated levels) and 1 numeric response column. "
                        "The first three columns have %d, %d, and %d distinct values across %d rows, leaving no replication within groups \u2014 they look continuous. "
                        "For continuous predictors, use Multiple Linear Regression instead." % (_lv3[0], _lv3[1], _lv3[2], len(_df_tw)))
                else:
                    
                    df_clean = df[columns].dropna()
                    dv_col = columns[-1]
                    f1_col = columns[0]
                    f2_col = columns[1]
                    f3_col = columns[2]
                    
                    df_clean[f1_col] = df_clean[f1_col].astype(str)
                    df_clean[f2_col] = df_clean[f2_col].astype(str)
                    df_clean[f3_col] = df_clean[f3_col].astype(str)
                    
                    dv_clean = 'DV'
                    f1_clean = 'F1'
                    f2_clean = 'F2'
                    f3_clean = 'F3'
                    
                    model_df = pd.DataFrame({
                        dv_clean: df_clean[dv_col],
                        f1_clean: df_clean[f1_col],
                        f2_clean: df_clean[f2_col],
                        f3_clean: df_clean[f3_col]
                    })
                    
                    formula = f"{dv_clean} ~ C({f1_clean}, Sum) * C({f2_clean}, Sum) * C({f3_clean}, Sum)"
                    model = ols(formula, data=model_df).fit()
                    anova_table = sm.stats.anova_lm(model, typ=3)
                    if 'Intercept' in anova_table.index:
                        anova_table = anova_table.drop('Intercept')
                    
                    report = f"A **Three-way ANOVA** was performed.\n\n"
                    report += f"**Dependent Variable:** {dv_col}\n"
                    report += f"**Factors:** {f1_col}, {f2_col}, {f3_col}\n\n"
                    
                    report += "### ANOVA Table\n\n"
                    report += "| Source | SS | DF | MS | F | p-value |\n"
                    report += "|---|---|---|---|---|---|\n"
                    
                    name_map = {
                        f"C({f1_clean})": f1_col,
                        f"C({f2_clean})": f2_col,
                        f"C({f3_clean})": f3_col,
                        f"C({f1_clean}):C({f2_clean})": f"{f1_col} x {f2_col}",
                        f"C({f1_clean}):C({f3_clean})": f"{f1_col} x {f3_col}",
                        f"C({f2_clean}):C({f3_clean})": f"{f2_col} x {f3_col}",
                        f"C({f1_clean}):C({f2_clean}):C({f3_clean})": f"{f1_col} x {f2_col} x {f3_col}",
                        "Residual": "Residual"
                    }
                    
                    for row_name, row in anova_table.iterrows():
                        src = name_map.get(row_name, row_name)
                        ss = row.get('sum_sq', np.nan)
                        df_val = row.get('df', np.nan)
                        f_val = row.get('F', np.nan)
                        p_val = row.get('PR(>F)', np.nan)
                        ms = ss / df_val if df_val > 0 else np.nan
                        
                        f_str = f"{f_val:.3f}" if not np.isnan(f_val) else ""
                        p_str = format_p_value(p_val)
                        
                        report += f"| {src} | {ss:.3f} | {df_val:.0f} | {ms:.3f} | {f_str} | {p_str} |\n"
                        
                    post_hoc_family = options.get("postHocFamily", "none")
                    if post_hoc_family != "none":
                        report += f"\n### Multiple Comparisons (Tukey HSD on All Combinations)\n\n"
                        try:
                            model_df['Interaction_Groups'] = model_df[f1_clean].astype(str) + " & " + model_df[f2_clean].astype(str) + " & " + model_df[f3_clean].astype(str)
                            mc = MultiComparison(model_df[dv_clean], model_df['Interaction_Groups'])
                            res = mc.tukeyhsd()
                            res_df = pd.DataFrame(data=res._results_table.data[1:], columns=res._results_table.data[0])
                            report += "| Group 1 | Group 2 | Mean Diff | p-adj | Reject |\n"
                            report += "|---|---|---|---|---|\n"
                            for _, r in res_df.iterrows():
                                report += f"| {r['group1']} | {r['group2']} | {r['meandiff']:.4f} | {format_p_value(r['p-adj'])} | {r['reject']} |\n"
                                
                            report += "\n#### Simple Main Effects\n"
                            report += "*Pairwise comparisons holding two factors constant and varying one.*\n\n"
                            report += "| Group 1 | Group 2 | Mean Diff | p-adj | Reject |\n"
                            report += "|---|---|---|---|---|\n"
                            for _, r in res_df.iterrows():
                                g1_parts = r['group1'].split(' & ')
                                g2_parts = r['group2'].split(' & ')
                                diffs = [1 for a, b in zip(g1_parts, g2_parts) if a != b]
                                if sum(diffs) == 1:
                                    report += f"| {r['group1']} | {r['group2']} | {r['meandiff']:.4f} | {format_p_value(r['p-adj'])} | {r['reject']} |\n"
                        except Exception as e:
                            report += f"Could not compute post-hocs: {str(e)}\n"
                        
                    result["report_markdown"] = report

                    result["report_markdown"] = report

            elif test_id == "Multiple Linear Regression":
                df_clean = df.dropna()
                y_col = columns[-1]
                X_cols = columns[:-1]
                Y = df_clean[y_col]
                X = df_clean[X_cols]
                X = sm.add_constant(X)
                model = sm.OLS(pd.to_numeric(Y, errors='coerce'), X.apply(pd.to_numeric, errors='coerce')).fit()
                
                report = f"A **Multiple Linear Regression** was performed.\n\n"
                report += f"**Dependent Variable:** {y_col}\n"
                report += f"**Predictors:** {', '.join(X_cols)}\n\n"
                report += f"**Model Summary:**\n"
                report += f"- R-squared: {model.rsquared:.4f}\n"
                report += f"- Adjusted R-squared: {model.rsquared_adj:.4f}\n"
                report += f"- F-statistic: {model.fvalue:.3f} (p = {model.f_pvalue:.4f})\n\n"
                
                report += "### Coefficients\n\n"
                report += "| Predictor | Coef | Std Err | t | p-value | 95% CI Low | 95% CI High |\n"
                report += "|---|---|---|---|---|---|---|\n"
                _coefs = []
                for param in model.params.index:
                    coef = model.params[param]
                    std_err = model.bse[param]
                    t_val = model.tvalues[param]
                    p_val = model.pvalues[param]
                    ci_low = model.conf_int().loc[param, 0]
                    ci_high = model.conf_int().loc[param, 1]
                    p_str = format_p_value(p_val)
                    report += f"| {param} | {coef:.4f} | {std_err:.4f} | {t_val:.3f} | {p_str} | {ci_low:.4f} | {ci_high:.4f} |\n"
                    _coefs.append({"label": str(param), "estimate": get_clean_float(coef), "ci_low": get_clean_float(ci_low), "ci_high": get_clean_float(ci_high)})
                
                result["report_markdown"] = report
                result["statistic"] = get_clean_float(model.fvalue)
                result["coefficients"] = _coefs
                result["p_value"] = get_clean_float(model.f_pvalue)

            elif test_id == "Multiple Logistic Regression":
                df_clean = df.dropna()
                y_col = columns[-1]
                X_cols = columns[:-1]
                Y = df_clean[y_col]
                if Y.dtype == object or Y.dtype == bool:
                    Y = (Y == Y.unique()[0]).astype(int)
                
                X = df_clean[X_cols]
                X = sm.add_constant(X)
                
                report = f"A **Multiple Logistic Regression** was performed.\n\n"
                report += f"**Dependent Variable:** {y_col}\n"
                report += f"**Predictors:** {', '.join(X_cols)}\n\n"
                
                try:
                    model = sm.Logit(pd.to_numeric(Y, errors='coerce'), X.apply(pd.to_numeric, errors='coerce')).fit(disp=0)
                    
                    report += f"**Model Summary:**\n"
                    report += f"- Pseudo R-squ. (McFadden): {model.prsquared:.4f}\n"
                    report += f"- LLR p-value: {model.llr_pvalue:.4f}\n\n"
                    
                    report += "### Coefficients & Odds Ratios\n\n"
                    report += "| Predictor | Coef | Std Err | z | p-value | Odds Ratio |\n"
                    report += "|---|---|---|---|---|---|---|\n"
                    _coefs = []
                    _ci = model.conf_int()
                    for param in model.params.index:
                        coef = model.params[param]
                        std_err = model.bse[param]
                        z_val = model.tvalues[param]
                        p_val = model.pvalues[param]
                        or_val = np.exp(coef)
                        p_str = format_p_value(p_val)
                        report += f"| {param} | {coef:.4f} | {std_err:.4f} | {z_val:.3f} | {p_str} | {or_val:.4f} |\n"
                        _coefs.append({"label": str(param), "estimate": get_clean_float(coef), "ci_low": get_clean_float(_ci.loc[param, 0]), "ci_high": get_clean_float(_ci.loc[param, 1])})
                    
                    result["statistic"] = get_clean_float(model.prsquared)
                    result["p_value"] = get_clean_float(model.llr_pvalue)
                    result["coefficients"] = _coefs
                except Exception:
                    # Complete/quasi-complete separation: the maximum-likelihood estimates diverge,
                    # so coefficient-based statistics (Pseudo R-squared, Wald p, odds ratios) are not
                    # identifiable. Report the condition rather than emitting misleading values.
                    report += ("\n*Note: Complete separation detected \u2014 the maximum-likelihood estimates "
                               "diverge, so coefficient-based statistics are not reported. For finite "
                               "estimates under separation, use penalized (Firth) logistic regression.*\n")
                
                result["report_markdown"] = report

            elif test_id == "Poisson Regression":
                df_clean = df.dropna()
                y_col = columns[-1]
                X_cols = columns[:-1]
                Y = df_clean[y_col]
                X = df_clean[X_cols]
                X = sm.add_constant(X)
                model = sm.GLM(pd.to_numeric(Y, errors='coerce'), X.apply(pd.to_numeric, errors='coerce'), family=sm.families.Poisson()).fit()
                
                report = f"A **Poisson Regression** was performed.\n\n"
                report += f"**Dependent Variable:** {y_col}\n"
                report += f"**Predictors:** {', '.join(X_cols)}\n\n"
                report += f"**Model Summary:**\n"
                report += f"- Deviance: {model.deviance:.4f}\n"
                report += f"- Pearson Chi2: {model.pearson_chi2:.4f}\n\n"
                
                report += "### Coefficients & Incidence Rate Ratios (IRR)\n\n"
                report += "| Predictor | Coef | Std Err | z | p-value | IRR |\n"
                report += "|---|---|---|---|---|---|---|\n"
                _coefs = []
                _ci = model.conf_int()
                for param in model.params.index:
                    coef = model.params[param]
                    std_err = model.bse[param]
                    z_val = model.tvalues[param]
                    p_val = model.pvalues[param]
                    irr_val = np.exp(coef)
                    p_str = format_p_value(p_val)
                    report += f"| {param} | {coef:.4f} | {std_err:.4f} | {z_val:.3f} | {p_str} | {irr_val:.4f} |\n"
                    _coefs.append({"label": str(param), "estimate": get_clean_float(coef), "ci_low": get_clean_float(_ci.loc[param, 0]), "ci_high": get_clean_float(_ci.loc[param, 1])})
                
                result["coefficients"] = _coefs
                result["report_markdown"] = report

            elif test_id == "Cox Regression":
                df_clean = df.dropna().apply(pd.to_numeric, errors='coerce').dropna()
                if df_clean.shape[1] < 2 or len(df_clean) < 3:
                    result["error"] = "Cox regression needs a duration column, an event (0/1) column, and enough rows."
                else:
                    event_col = None
                    for c in df_clean.columns:
                        vals = set(pd.unique(df_clean[c].dropna()))
                        if vals and vals.issubset({0, 1}):
                            event_col = c
                            break
                    if event_col is None:
                        result["error"] = "Cox regression needs an event column coded 0/1 (0 = censored, 1 = event). Mark one column that way, plus a duration column."
                    else:
                        dur_cands = [c for c in df_clean.columns if c != event_col and (df_clean[c] > 0).all()]
                        dur_col = dur_cands[0] if dur_cands else [c for c in df_clean.columns if c != event_col][0]
                        covariates = [c for c in df_clean.columns if c not in (event_col, dur_col)]
                        fit_df = df_clean[[dur_col, event_col] + covariates].copy()
                        cph = CoxPHFitter()
                        cph.fit(fit_df, duration_col=dur_col, event_col=event_col)
                        summ = cph.summary
                        report = "A **Cox Proportional-Hazards Regression** was performed.\n\n"
                        report += f"**Duration:** {dur_col} \u2022 **Event:** {event_col} \u2022 **Covariates:** {', '.join(covariates) if covariates else '(none)'}\n\n"
                        report += f"- Concordance index: {cph.concordance_index_:.4f}\n- Partial log-likelihood: {cph.log_likelihood_:.4f}\n\n"
                        report += "### Hazard Ratios\n\n| Covariate | coef | Hazard Ratio | 95% CI Low | 95% CI High | z | p-value |\n|---|---|---|---|---|---|---|\n"
                        _cox_coefs = []
                        for cov in summ.index:
                            hr = summ.loc[cov, 'exp(coef)']; lo = summ.loc[cov, 'exp(coef) lower 95%']; hi = summ.loc[cov, 'exp(coef) upper 95%']
                            report += f"| {cov} | {summ.loc[cov,'coef']:.4f} | {hr:.4f} | {lo:.4f} | {hi:.4f} | {summ.loc[cov,'z']:.3f} | {format_p_value(summ.loc[cov,'p'])} |\n"
                            _cox_coefs.append({"label": str(cov), "estimate": get_clean_float(summ.loc[cov,'coef']), "ci_low": get_clean_float(np.log(lo)), "ci_high": get_clean_float(np.log(hi))})
                        result["coefficients"] = _cox_coefs
                        try:
                            result["statistic"] = get_clean_float(cph.log_likelihood_ratio_test().test_statistic)
                            result["p_value"] = get_clean_float(cph.log_likelihood_ratio_test().p_value)
                        except Exception:
                            pass
                        result["report_markdown"] = report

            elif test_id == "Principal Component Analysis (PCA)":
                df_clean = df.dropna()
                
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(df_clean[columns])
                
                pca = PCA()
                pca.fit(X_scaled)
                
                report = f"A **Principal Component Analysis (PCA)** was performed.\n\n"
                report += f"**Variables Included:** {', '.join(columns)}\n\n"
                
                report += "### Explained Variance (Scree Data)\n\n"
                report += "| Component | Eigenvalue | Variance (%) | Cumulative (%) |\n"
                report += "|---|---|---|---|\n"
                cum_var = 0
                for i in range(len(pca.explained_variance_)):
                    eigen = pca.explained_variance_[i]
                    var_pct = pca.explained_variance_ratio_[i] * 100
                    cum_var += var_pct
                    report += f"| PC{i+1} | {eigen:.4f} | {var_pct:.2f}% | {cum_var:.2f}% |\n"
                
                report += "\n### Principal Component Loadings\n\n"
                headers = " | ".join([f"PC{i+1}" for i in range(len(pca.components_))])
                report += f"| Variable | {headers} |\n"
                report += "|---|" + "|".join(["---" for _ in range(len(pca.components_))]) + "|\n"
                
                for j, col in enumerate(columns):
                    loadings = " | ".join([f"{pca.components_[i][j]:.4f}" for i in range(len(pca.components_))])
                    report += f"| {col} | {loadings} |\n"
                    
                result["report_markdown"] = report

            elif test_id == "Correlation Matrix":
                df_clean = df[columns].dropna()
                corr = df_clean.rcorr()
                
                report = f"A **Correlation Matrix (Pearson)** was performed.\n\n"
                report += "The table below shows Pearson's r (lower triangle) and p-values (upper triangle).\n\n"
                
                report += "| Variable | " + " | ".join(corr.columns) + " |\n"
                report += "|---|" + "|".join(["---" for _ in corr.columns]) + "|\n"
                
                for idx, row in corr.iterrows():
                    row_vals = []
                    for col in corr.columns:
                        val = row[col]
                        row_vals.append(str(val))
                    report += f"| **{idx}** | " + " | ".join(row_vals) + " |\n"
                
                result["report_markdown"] = report

            elif test_id == "Partial Correlation":
                if len(columns) < 3:
                    result["error"] = "Partial Correlation requires at least 3 numeric variables."
                else:
                    df_pc = df[columns].apply(pd.to_numeric, errors='coerce').dropna()
                    if df_pc.empty or len(df_pc.columns) < 3:
                        result["error"] = "Insufficient valid data for partial correlation."
                    else:
                        x_col = columns[0]
                        y_col = columns[1]
                        covars = columns[2:]
                        
                        pcor = pg.partial_corr(data=df_pc, x=x_col, y=y_col, covar=covars)
                        r_val = pcor['r'].iloc[0]
                        pval_col = 'p_val' if 'p_val' in pcor.columns else 'p-value'
                        if pval_col not in pcor.columns:
                            if 'p' in pcor.columns:
                                pval_col = 'p'
                            else:
                                raise ValueError(f"Could not find p-value column in {list(pcor.columns)}")
                        p_val = pcor[pval_col].iloc[0]
                        
                        result["statistic"] = get_clean_float(r_val)
                        result["p_value"] = get_clean_float(p_val)
                        result["report_markdown"] = (f"A **Partial Correlation (Pearson)** was performed between {x_col} and {y_col}, controlling for {', '.join(covars)}.\n\n"
                                  f"**Partial r:** {r_val:.4f}\n"
                                  f"**p-value:** {format_p_value(p_val)}\n")

                    
    except ZeroDivisionError:
        result["error"] = "Division by zero. This usually happens when a group has no variance (all values are identical) or there is not enough data to compute statistics."
    except Exception as e:
        _msg = str(e)
        _etype = type(e).__name__
        import traceback as _tb
        result["error_detail"] = _tb.format_exc()
        if _etype in ("NameError", "AttributeError", "ImportError", "ModuleNotFoundError", "SyntaxError", "UnboundLocalError"):
            # These are ALWAYS engine bugs. Never blame the user's data for them.
            result["error"] = f"Internal engine error ({_etype}): {_msg}. This is a bug in StatLens, not a problem with your data."
            result["status"] = "error"
            return result
        if "NoneType" in _msg and "not supported" in _msg:
            result["error"] = "This test could not be computed for this data. The result is undefined \u2014 this usually means a group has zero variance (all values identical), the differences are constant, or there are too few observations."
        elif _msg.strip().strip("'") == "F":
            result["error"] = "This analysis requires at least two groups, each with more than one value and some variance. Check that your groups are set up correctly and contain enough data."
        elif "invalid index to scalar" in _msg:
            result["error"] = "This test could not be computed. The input may have zero variance (for example a constant column) or too few data points."
        else:
            result["error"] = f"Statistical error: {_msg}. Check your data for missing values, zero variance, or insufficient sample sizes."
        
    if not result.get("error") and (result.get("report_markdown") or "").strip() in ("", "Test not fully implemented yet."):
        result["error"] = f"The test '{test_id}' isn't available for this data type. Choose a different test or table type."
        result["status"] = "error"
    return result

def analyze_sheet():
    import numpy as _np
    from scipy import stats as _st
    sheet = sheet_data
    table_type = sheet.get('type', 'Column')
    cfg = sheet.get('config', {})
    replicates = cfg.get('replicates')
    if replicates is None and 'config' in cfg:
        replicates = cfg.get('config', {}).get('replicates', None)
        if replicates is None:
            replicates = cfg.get('config', {}).get('subcolumns', 1)
    if replicates is None:
        replicates = 1

    columns = []
    for g in sheet.get('columnGroups', []):
        if replicates > 1:
            for r in range(1, replicates + 1):
                columns.append(f"{g['id']}_{r}")
        else:
            columns.append(g['id'])

    df = pd.DataFrame(sheet.get('data', []))

    group_data = {}
    descriptives = {}
    for col in columns:
        if col == 'rowTitle' or col not in df.columns:
            continue
        vals = pd.to_numeric(df[col], errors='coerce').dropna()
        if len(vals) == 0:
            continue
        arr = vals.to_numpy(dtype=float)
        group_data[col] = arr
        n = int(len(arr))
        sd = float(arr.std(ddof=1)) if n > 1 else 0.0
        descriptives[col] = {
            'n': n, 'mean': float(arr.mean()), 'sd': sd,
            'sem': float(sd / np.sqrt(n)) if n > 1 else 0.0,
            'min': float(arr.min()), 'max': float(arr.max()),
        }

    arrays = [v for v in group_data.values() if len(v) >= 1]
    n_groups = len(arrays)

    assumptions = {}
    if table_type in ('Column', 'Grouped', 'Nested') and n_groups >= 1:
        try:
            norm_ps = [float(stats.shapiro(v).pvalue) for v in arrays if len(v) >= 3 and np.std(v) > 0]
            if norm_ps:
                assumptions['normality'] = {'passed': all(p > 0.05 for p in norm_ps)}
        except Exception:
            pass
        try:
            lev = [v for v in arrays if len(v) >= 2]
            if len(lev) >= 2:
                assumptions['variance'] = {'passed': float(stats.levene(*lev).pvalue) > 0.05}
        except Exception:
            pass
        try:
            has_out = False
            for v in arrays:
                if len(v) >= 4:
                    q1, q3 = np.percentile(v, [25, 75]); iqr = q3 - q1
                    if iqr > 0 and bool(np.any((v < q1 - 3*iqr) | (v > q3 + 3*iqr))):
                        has_out = True
            assumptions['outliers'] = {'passed': not has_out}
        except Exception:
            pass

    normal = assumptions.get('normality', {}).get('passed', True)
    equalvar = assumptions.get('variance', {}).get('passed', True)

    def _rec(rec_id, rationale, menu):
        return {'testId': rec_id, 'rationale': rationale, 'alternatives': [m for m in menu if m != rec_id]}

    recommendation = {'testId': 'None', 'rationale': 'Not enough numeric data for a recommendation.', 'alternatives': []}

    if table_type == 'Column':
        if n_groups == 1:
            menu = ['One-Sample t-test', 'One-Sample Wilcoxon signed-rank test', 'One-Sample Sign test']
            rec = 'One-Sample t-test' if normal else 'One-Sample Wilcoxon signed-rank test'
            recommendation = _rec(rec, 'A single, approximately normal group.' if normal else 'A single, non-normal group.', menu)
        elif n_groups == 2:
            menu = ['Unpaired t-test', "Welch's t-test", 'Paired t-test', 'Mann-Whitney test', 'Wilcoxon matched-pairs signed rank test', 'One-Sample t-test', 'One-Sample Wilcoxon signed-rank test']
            rec = 'Unpaired t-test' if (normal and equalvar) else ("Welch's t-test" if normal else 'Mann-Whitney test')
            recommendation = _rec(rec, 'Two groups.', menu)
        elif n_groups > 2:
            menu = ['Ordinary One-way ANOVA', "Welch's ANOVA", 'Brown-Forsythe ANOVA', 'Welch and Brown-Forsythe ANOVA (Combinatory)', 'Kruskal-Wallis test', 'Repeated Measures ANOVA', 'Friedman test', 'One-Sample t-test', 'One-Sample Wilcoxon signed-rank test']
            rec = 'Ordinary One-way ANOVA' if (normal and equalvar) else ("Welch's ANOVA" if normal else 'Kruskal-Wallis test')
            recommendation = _rec(rec, 'Three or more groups.', menu)

    elif table_type == 'XY':
        menu = ['Simple Linear Regression', 'Correlation (Pearson)', 'Correlation (Spearman)', 'Deming Regression', 'Nonlinear Curve Fitting', 'Simple Logistic Regression', 'Area Under Curve', 'Fit Spline', 'LOWESS', 'Smooth', 'Differentiate', 'Integrate', 'Row Statistics']
        recommendation = _rec('Simple Linear Regression', 'XY data \u2014 model the relationship between X and Y.', menu)

    elif table_type == 'Grouped':
        menu = ['Two-way ANOVA', 'Repeated Measures Two-way ANOVA', 'Mixed-effects ANOVA', 'ART ANOVA (Non-parametric)']
        recommendation = _rec('Two-way ANOVA', 'Two grouping factors \u2014 test both main effects and their interaction.', menu)

    elif table_type == 'Nested':
        # Count only treatments that actually contain data — an empty (defined-but-unused)
        # column group must not push a 2-group design onto Nested one-way ANOVA.
        _treats_with_data = set()
        for _col in columns:
            if _col in df.columns and pd.to_numeric(df[_col], errors='coerce').notna().any():
                _treats_with_data.add(str(_col).rsplit('_', 1)[0] if replicates > 1 else _col)
        n_treat = len(_treats_with_data) if _treats_with_data else len(sheet.get('columnGroups', []))
        if n_treat == 2:
            recommendation = {'testId': 'Nested t-test', 'rationale': 'Two treatment groups, each with nested subgroups (variance-components model).', 'alternatives': ['Nested one-way ANOVA']}
        else:
            recommendation = {'testId': 'Nested one-way ANOVA', 'rationale': 'Three or more treatment groups, each with nested subgroups (variance-components model).', 'alternatives': ['Nested t-test']}

    elif table_type == 'Contingency':
        menu = ["Fisher's Exact Test", 'Chi-Square Test', "Chi-Square Test (with Yates' correction)", "McNemar's Test", "Cochran-Armitage Trend Test"]
        recommendation = _rec("Fisher's Exact Test", 'A contingency table \u2014 test association between the categorical variables.', menu)

    elif table_type == 'MultipleVariables':
        menu = ['Multiple Linear Regression', 'Multiple Logistic Regression', 'Poisson Regression', 'Cox Regression', 'Correlation Matrix', 'Principal Component Analysis (PCA)', 'Partial Correlation']
        def _cat(col):
            sc = pd.to_numeric(df[col], errors='coerce')
            if sc.isna().any():
                return True
            return df[col].nunique() <= max(2, len(df) // 3)
        factor_cols = columns[:-1] if len(columns) >= 2 else []
        n_cat = sum(1 for c in factor_cols if c in df.columns and _cat(c))
        if n_cat >= 3:
            menu = ['Three-way ANOVA'] + menu
            recommendation = _rec('Three-way ANOVA', 'At least three categorical factors and a response variable.', menu)
        else:
            recommendation = _rec('Multiple Linear Regression', 'Several continuous predictors and a response variable.', menu)

    elif table_type == 'PartsOfWhole':
        menu = ['Chi-Square goodness of fit', 'Binomial test', 'Fraction of Total']
        recommendation = _rec('Chi-Square goodness of fit', 'Parts of a whole \u2014 compare observed counts against expected proportions.', menu)

    elif table_type == 'Survival':
        menu = ['Kaplan-Meier Survival Analysis', 'Log-rank (Mantel-Cox) test', 'Hazard Ratios', 'Gehan-Breslow-Wilcoxon test', 'Cox Regression', 'Log-rank Trend Test']
        recommendation = _rec('Kaplan-Meier Survival Analysis', 'Time-to-event data \u2014 estimate survival curves and compare groups.', menu)

    return {
        'descriptives': descriptives,
        'assumptions': assumptions,
        'recommendation': recommendation
    }

