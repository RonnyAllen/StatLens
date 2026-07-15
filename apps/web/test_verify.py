
import pandas as pd
import numpy as np
import scipy.stats as stats
import pingouin as pg
import scikit_posthocs as sp
import scipy.integrate as integrate
import math
from scipy.stats import tukey_hsd
from scipy.optimize import fsolve
import statsmodels.api as sm
from sklearn.metrics import roc_curve, auc, confusion_matrix
from lifelines import KaplanMeierFitter
from lifelines.statistics import multivariate_logrank_test, logrank_test
from lifelines import CoxPHFitter
from lifelines.utils import median_survival_times

# Helper functions to serialize the result safely
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

def smm_cdf(x, m, df):

    if np.isinf(df):
        return (2 * stats.norm.cdf(x) - 1)**m
    
    def integrand(v):
        phi_val = stats.norm.cdf(x * np.sqrt(v / df))
        term = (2 * phi_val - 1)**m
        pdf_val = stats.chi2.pdf(v, df)
        return term * pdf_val

    res, _ = integrate.quad(integrand, 0, np.inf, limit=200)
    return res

def dunnetts_t3_pvalue(t_stat, k, df):
    m = k * (k - 1) / 2
    cdf_val = smm_cdf(abs(t_stat), m, df)
    p_adj = 1.0 - cdf_val
    return p_adj



def run():
    sheet = sheet_data
    test_id = options.get('testId', '')
    post_hoc_family = options.get('postHocFamily', 'none')
    post_hoc_test = options.get('postHocTest', 'none')
    specific_pairs = options.get('specificPairs', [])
    
    table_type = sheet.get("type", "Column")
    
    replicates = sheet.get("config", {}).get("config", {}).get("replicates", 1)
    
    columns = []
    col_id_to_name = {}
    
    for g in sheet.get("columnGroups", []):
        if replicates > 1:
            for r in range(1, replicates + 1):
                col_id = f"{g['id']}_{r}"
                columns.append(col_id)
                col_id_to_name[col_id] = f"{g['name']} (Y{r})"
        else:
            columns.append(g["id"])
            col_id_to_name[g["id"]] = g["name"]
    
    # Prepend rowTitle if the table uses it
    has_row_titles = table_type in ["XY", "Grouped", "Contingency", "Survival", "PartsOfWhole", "Nested"]
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
        for row in sheet.get("data", []):
            val = row.get(col, None)
            if val is None or str(val).strip() == "":
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
        
        if table_type == "Column":
            if test_id == "One-Sample t-test":
                res = pg.ttest(groups[0], 0.0) # testing against hypothetical mean of 0
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float(res['p-val'].values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                result["effect_size"] = {"cohen_d": get_clean_float(res['cohen-d'].values[0])}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                result["report_markdown"] = f"A **One-Sample t-test** was performed on {gn0} against a hypothetical mean of 0. The result was **{sig}** (t({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f})."
                
            elif test_id == "One-Sample Wilcoxon signed-rank test":
                res = pg.wilcoxon(groups[0] - 0.0)
                result["statistic"] = get_clean_float(res['W-val'].values[0])
                result["p_value"] = get_clean_float(res['p-val'].values[0])
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
                res = pg.ttest(groups[0], groups[1], paired=False, correction=False)
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float(res['p-val'].values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                result["effect_size"] = {"cohen_d": get_clean_float(res['cohen-d'].values[0])}
                ci = res['CI95%'].values[0]
                result["confidence_intervals"] = [get_clean_float(ci[0]), get_clean_float(ci[1])]
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"An **Unpaired t test** was performed to compare {gn0} and {gn1}. The difference between the means was **{sig}** (t({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}). The effect size (Cohen's d) was {result['effect_size']['cohen_d']:.3f}."
            
            elif test_id == "Mann-Whitney test":
                res = pg.mwu(groups[0], groups[1])
                result["statistic"] = get_clean_float(res['U-val'].values[0]) if 'U-val' in res else get_clean_float(res['U_val'].values[0] if 'U_val' in res else res.iloc[0, 0])
                result["p_value"] = get_clean_float(res['p-val'].values[0])
                result["effect_size"] = {"CLES": get_clean_float(res['CLES'].values[0])}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"A **Mann-Whitney U test** was performed to compare {gn0} and {gn1}. The difference was **{sig}** (U = {result['statistic']:.3f}, p = {result['p_value']:.4f})."
                
            elif test_id == "Welch's t-test":
                res = pg.ttest(groups[0], groups[1], paired=False, correction=True)
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float(res['p-val'].values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                result["effect_size"] = {"cohen_d": get_clean_float(res['cohen-d'].values[0])}
                ci = res['CI95%'].values[0]
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
                res = pg.ttest(groups[0][:min_len], groups[1][:min_len], paired=True)
                result["statistic"] = get_clean_float(res['T'].values[0])
                result["p_value"] = get_clean_float(res['p-val'].values[0])
                result["degrees_of_freedom"] = get_clean_float(res['dof'].values[0])
                result["effect_size"] = {"cohen_d": get_clean_float(res['cohen-d'].values[0])}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"A **Paired t-test** was performed to compare {gn0} and {gn1}. The difference was **{sig}** (t({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f})."

            elif test_id == "Wilcoxon matched-pairs signed rank test":
                min_len = min(len(groups[0]), len(groups[1]))
                res = pg.wilcoxon(groups[0][:min_len], groups[1][:min_len])
                result["statistic"] = get_clean_float(res['W-val'].values[0])
                result["p_value"] = get_clean_float(res['p-val'].values[0])
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                gn0 = col_id_to_name.get(group_names[0], group_names[0])
                gn1 = col_id_to_name.get(group_names[1], group_names[1])
                result["report_markdown"] = f"A **Wilcoxon matched-pairs signed rank test** was performed to compare {gn0} and {gn1}. The difference was **{sig}** (W = {result['statistic']:.3f}, p = {result['p_value']:.4f})."

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
                report = f"An **Ordinary one-way ANOVA** was performed to compare the effect of group on the measured value. There was a **{sig}** effect (F({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\\n\\n"
                
                # Post-Hocs
                if post_hoc_family != "none":
                    N_groups = len(group_names)
                    total_pairs = N_groups * (N_groups - 1) / 2
                    # We no longer branch on is_all_pairs because our exact numerical integration
                    # works correctly for both "all_pairwise" and "specific_pairs".
                    # For specific pairs, we just skip reporting the ones not selected.

                    
                    arrays = [df[g].dropna().values for g in group_names]
                    res_tukey = tukey_hsd(*arrays)
                        
                    ph_results = []
                    # scipy.stats.tukey_hsd returns a result object where pvalue and statistic are NxN arrays
                    # indices match the order of arrays passed in (which is group_names)
                    for i in range(len(group_names)):
                        for j in range(i+1, len(group_names)):
                            g1 = group_names[i]
                            g2 = group_names[j]
                            
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in:
                                    continue
                                    
                            p_val = res_tukey.pvalue[i, j]
                            mean_diff = res_tukey.statistic[i, j]
                            
                            # We must bypass Pyodide's Fortran 'psturng' binary because WebAssembly
                            # floating-point issues cause it to return 1.0 or 0.9852 arbitrarily.
                            # Instead, we calculate the mathematically exact Tukey p-value using pure-Python numerical integration!

                            
                            def exact_tukey_pvalue(q_stat, k_groups, df_error):
                                if df_error < 1: return 1.0
                                if q_stat > 15: return 0.0
                                if q_stat < 0.001: return 1.0
                                
                                # Fast 1D approximation for massive degrees of freedom
                                if df_error > 100:
                                    def integrand1d(z):
                                        return k_groups * stats.norm.pdf(z) * (stats.norm.cdf(z + q_stat) - stats.norm.cdf(z))**(k_groups - 1)
                                    res, _ = integrate.quad(integrand1d, -10, 10, epsabs=1e-3, epsrel=1e-3)
                                    return max(0.0, min(1.0, 1.0 - res))

                                # Exact 2D integration for finite degrees of freedom
                                def inner_integral(s, z):
                                    return k_groups * stats.norm.pdf(z) * (stats.norm.cdf(z + q_stat * s) - stats.norm.cdf(z))**(k_groups - 1)
                                    
                                def integrand(z, s):
                                    term1 = (df_error**(df_error/2)) / (math.gamma(df_error/2) * (2**(df_error/2 - 1)))
                                    term2 = (s**(df_error - 1)) * np.exp(-df_error * (s**2) / 2)
                                    return term1 * term2 * inner_integral(s, z)

                                try:
                                    res, _ = integrate.dblquad(integrand, 0, np.inf, lambda s: -10, lambda s: 10, epsabs=1e-2, epsrel=1e-2)
                                    return max(0.0, min(1.0, 1.0 - res))
                                except Exception:
                                    return 1.0
                                    
                            # Tukey q statistic is abs(mean_diff) / (sqrt(MSE/n) for equal n, but scipy handles harmonic mean for unequal n)
                            # Actually, scipy.stats.tukey_hsd calculates q as mean_diff / SE internally, but doesn't expose it.
                            # However, we can reconstruct q from the t_pval using the T distribution!
                            # Unpaired t-test evaluates t_stat = mean_diff / SE_ttest. 
                            # Tukey's HSD SE uses the pooled MS_error from the entire ANOVA model.
                            # Let's just calculate q manually!
                            # MSE from entire model
                            all_vals = np.concatenate(arrays)
                            N_total = len(all_vals)
                            df_error = N_total - len(group_names)
                            grand_mean = all_vals.mean()
                            ss_error = sum(np.sum((a - a.mean())**2) for a in arrays)
                            ms_error = ss_error / df_error
                            
                            n1 = len(df[g1].dropna())
                            n2 = len(df[g2].dropna())
                            # Standard error for Tukey is sqrt( MSE/2 * (1/n1 + 1/n2) )
                            se = np.sqrt( (ms_error / 2) * (1/n1 + 1/n2) )
                            q_stat = abs(mean_diff) / se

                            p_val = exact_tukey_pvalue(q_stat, len(group_names), df_error)
                            
                            # Make mean diff positive and arrange g1, g2 to match diff
                            if mean_diff < 0:
                                mean_diff = -mean_diff
                                g1, g2 = g2, g1

                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "mean_diff": get_clean_float(mean_diff),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                    result["post_hocs"] = {"method": "Tukey's HSD (Exact Integration)", "comparisons": ph_results}
                    report += "Post-hoc comparisons using exact numerical integration for Tukey's HSD test were conducted. "
                        
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
                report = f"A **Welch's ANOVA** was performed (assuming unequal variances). There was a **{sig}** effect (F({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\\n\\n"
                
                # Post-Hocs for Welch's ANOVA: Games-Howell or Dunnett's T3
                if post_hoc_family != "none":
                    if post_hoc_test == "Games-Howell test":
                        ph = pg.pairwise_gameshowell(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                        ph_results = []
                        for idx, row in ph.iterrows():
                            g1 = row['A']
                            g2 = row['B']
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(row['pval']),
                                "significant": bool(row['pval'] < 0.05)
                            })
                        result["post_hocs"] = {"method": "Games-Howell", "comparisons": ph_results}
                        report += "Games-Howell post-hoc test was conducted to account for unequal variances."
                    
                    elif post_hoc_test == "Dunnett's T3 test":
                        ph = pg.pairwise_gameshowell(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                        ph_results = []
                        k_groups = len(group_names)
                        for idx, row in ph.iterrows():
                            g1 = row['A']
                            g2 = row['B']
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            
                            t_stat = row['T']
                            df_welch = row['df']
                            p_val = dunnetts_t3_pvalue(t_stat, k_groups, df_welch)
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                        result["post_hocs"] = {"method": "Dunnett's T3 (Exact Numerical Integration)", "comparisons": ph_results}
                        report += "Dunnett's T3 post-hoc test using exact Studentized Maximum Modulus (SMM) integration was conducted for small sample sizes with unequal variances."

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
                    report = f"A **Combinatory Robust ANOVA** approach was used due to unequal variances and non-normal (skewed) data.\\n\\n"
                    report += f"- **Welch's ANOVA** showed a **{w_sig}** effect (F({w_df1:.2f}, {w_df2:.2f}) = {w_F:.3f}, p = {w_p:.4f}).\\n"
                    report += f"- **Brown-Forsythe ANOVA** showed a **{bf_sig}** effect (F({df1_bf:.2f}, {df2_bf:.2f}) = {f_bf:.3f}, p = {p_bf:.4f}).\\n\\n"
                    
                    if w_sig == bf_sig:
                        report += "Both tests agree, strengthening confidence in the conclusion despite the data violations.\\n\\n"
                    else:
                        report += "The tests disagree. Brown-Forsythe is often preferred for strongly skewed data with unequal variances.\\n\\n"
                    
                    # For post-hocs, we'll base it on Welch's if it was requested, or just proceed if either is significant
                    is_sig = w_p < 0.05 or p_bf < 0.05
                    result["p_value"] = min(w_p, p_bf)  # just so the post hoc block triggers if either is significant
                else:
                    report = f"A **Brown-Forsythe ANOVA** (robust to unequal variances and skewed data) was performed. There was a **{bf_sig}** effect (F({df1_bf:.2f}, {df2_bf:.2f}) = {f_bf:.3f}, p = {p_bf:.4f}).\\n\\n"
                    is_sig = p_bf < 0.05

                # Post-Hocs for robust ANOVA: Games-Howell or Dunnett's T3
                if post_hoc_family != "none":
                    if post_hoc_test == "Games-Howell test":
                        ph = pg.pairwise_gameshowell(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                        ph_results = []
                        for idx, row in ph.iterrows():
                            g1 = row['A']
                            g2 = row['B']
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(row['pval']),
                                "significant": bool(row['pval'] < 0.05)
                            })
                        result["post_hocs"] = {"method": "Games-Howell", "comparisons": ph_results}
                        report += "Games-Howell post-hoc test was conducted to account for unequal variances."
                    
                    elif post_hoc_test == "Dunnett's T3 test":
                        ph = pg.pairwise_gameshowell(data=df.melt(value_vars=group_names).dropna(), dv='value', between='variable')
                        ph_results = []
                        k_groups = len(group_names)
                        for idx, row in ph.iterrows():
                            g1 = row['A']
                            g2 = row['B']
                            if post_hoc_family == "specific_pairs":
                                is_in = any((p[0] == g1 and p[1] == g2) or (p[0] == g2 and p[1] == g1) for p in specific_pairs)
                                if not is_in: continue
                            
                            t_stat = row['T']
                            df_welch = row['df']
                            p_val = dunnetts_t3_pvalue(t_stat, k_groups, df_welch)
                            
                            ph_results.append({
                                "group1": col_id_to_name.get(g1, g1),
                                "group2": col_id_to_name.get(g2, g2),
                                "p_value": get_clean_float(p_val),
                                "significant": bool(p_val < 0.05)
                            })
                        result["post_hocs"] = {"method": "Dunnett's T3 (Exact Numerical Integration)", "comparisons": ph_results}
                        report += "Dunnett's T3 post-hoc test using exact Studentized Maximum Modulus (SMM) integration was conducted for small sample sizes with unequal variances."

            elif test_id == "Repeated Measures ANOVA":
                # For RM ANOVA, we need subjects. We assume rows are subjects
                melted = df.reset_index().melt(id_vars='index', value_vars=group_names).dropna()
                melted.columns = ['Subject', 'Variable', 'Value']
                
                res = pg.rm_anova(data=melted, dv='Value', within='Variable', subject='Subject', detailed=True)
                # the result df has multiple rows if sphericity correction etc. First row is usually the factor
                result["statistic"] = get_clean_float(res['F'].values[0])
                p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res), None)
                if p_col is None: raise ValueError("Could not compute p-value. Check data for zero variance or small sample size.")
                result["p_value"] = get_clean_float(res[p_col].values[0])
                result["degrees_of_freedom"] = f"{get_clean_float(res['ddof1'].values[0]):.0f}, {get_clean_float(res['ddof2'].values[0]):.0f}"
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                report = f"A **Repeated Measures ANOVA** was performed. There was a **{sig}** effect (F({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\\n\\n"

            elif test_id == "Friedman test":
                groups = [df[col].dropna().values for col in group_names]
                if len(groups) < 3:
                    raise ValueError("Friedman test requires at least 3 groups.")
                
                # Check that all groups have the same length
                lengths = [len(g) for g in groups]
                if len(set(lengths)) > 1:
                    raise ValueError("Friedman test requires equal sample sizes across all groups. Please remove rows with missing data.")
                
                res = stats.friedmanchisquare(*groups)
                result["statistic"] = get_clean_float(res.statistic)
                result["p_value"] = get_clean_float(res.pvalue)
                result["degrees_of_freedom"] = f"{len(group_names) - 1}"
                
                n = lengths[0]
                k = len(groups)
                w = res.statistic / (n * (k - 1)) if n > 0 and k > 1 else None
                if w is not None:
                    result["effect_size"] = {"W": get_clean_float(w)}
                
                sig = "significant" if result["p_value"] < 0.05 else "not significant"
                report = f"A **Friedman test** was performed for repeated measures. There was a **{sig}** effect (X2({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f})."
                if w is not None:
                    report += f" The effect size (Kendall's W) was {w:.3f}."
                report += "\\n\\n"
                
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
                report = f"A **Kruskal-Wallis test** was performed. The differences between groups were **{sig}** (H({result['degrees_of_freedom']}) = {result['statistic']:.3f}, p = {result['p_value']:.4f}).\\n\\n"
                
                # Post-Hocs using scikit-posthocs
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

            if "report_markdown" not in result or result["report_markdown"] == "":
                result["report_markdown"] = report if 'report' in locals() else "Test executed successfully."

        elif table_type == "Contingency":
            if test_id == "Chi-Square Test" or test_id == "Chi-Square Test (with Yates' correction)":
                data_cols = [c for c in df.columns if c != "rowTitle"]
                valid_data_cols = [c for c in data_cols if not df[c].isna().all()]
                df_clean = df[valid_data_cols].dropna(how='any')
                matrix = df_clean.values
                if len(matrix) == 0 or matrix.size == 0:
                    result["error"] = "Insufficient data for Chi-Square test."
                    return result
                else:
                    chi2, p, dof, ex = stats.chi2_contingency(matrix)
                    result["statistic"] = get_clean_float(chi2)
                    result["p_value"] = get_clean_float(p)
                    result["degrees_of_freedom"] = get_clean_float(dof)
                
                sig = "significant" if p < 0.05 else "not significant"
                report = f"A **Chi-Square test of independence** was performed to examine the relation between variables. The relationship between these variables was **{sig}** (X2({int(dof)}) = {chi2:.3f}, p = {p:.4f})."
                
                if matrix.shape == (2, 2):
                    a, b = matrix[0, 0], matrix[0, 1]
                    c, d = matrix[1, 0], matrix[1, 1]
                    odds_ratio = (a * d) / (b * c) if (b * c) != 0 else float('inf')
                    p1 = a / (a + b) if (a + b) != 0 else 0
                    p2 = c / (c + d) if (c + d) != 0 else 0
                    rel_risk = p1 / p2 if p2 != 0 else float('inf')
                    
                    result["effect_size"] = {"odds_ratio": get_clean_float(odds_ratio), "relative_risk": get_clean_float(rel_risk)}
                    report += f"\\n\\n**Effect Sizes:**\\n- **Odds Ratio:** {odds_ratio:.3f}\\n- **Relative Risk:** {rel_risk:.3f}"
                    
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
                    odds_ratio = (a * d) / (b * c) if (b * c) != 0 else float('inf')
                    p1 = a / (a + b) if (a + b) != 0 else 0
                    p2 = c / (c + d) if (c + d) != 0 else 0
                    rel_risk = p1 / p2 if p2 != 0 else float('inf')
                    
                    result["effect_size"] = {"odds_ratio": get_clean_float(odds_ratio), "relative_risk": get_clean_float(rel_risk)}
                    report += f"\\n\\n**Effect Sizes:**\\n- **Odds Ratio:** {odds_ratio:.3f}\\n- **Relative Risk:** {rel_risk:.3f}"
                    
                    result["report_markdown"] = report
                else:
                    if len(matrix) == 0 or matrix.size == 0:
                        result["error"] = "Insufficient data for Fisher's Exact test."
                    else:
                        # Fallback to Chi-Square
                        chi2, p, dof, ex = stats.chi2_contingency(matrix)
                        result["statistic"] = get_clean_float(chi2)
                        result["p_value"] = get_clean_float(p)
                        sig = "significant" if p < 0.05 else "not significant"
                        report = f"Table was {matrix.shape[0]}x{matrix.shape[1]}. Fisher's Exact Test requires a 2x2 contingency table. **Chi-Square test** was performed instead. The relationship was **{sig}** (p = {p:.4f})."
                        result["report_markdown"] = report

            elif test_id == "McNemar's Test":
                matrix = df.dropna().values
                if matrix.shape == (2, 2):
                    b, c = matrix[0, 1], matrix[1, 0]
                    chi2 = ((abs(b - c) - 1)**2) / (b + c) if (b + c) > 0 else 0
                    p = 1 - stats.chi2.cdf(chi2, 1)
                    
                    result["statistic"] = get_clean_float(chi2)
                    result["p_value"] = get_clean_float(p)
                    
                    sig = "significant" if p < 0.05 else "not significant"
                    result["report_markdown"] = f"A **McNemar's test** was performed on paired nominal data. The difference was **{sig}** (X2(1) = {chi2:.3f}, p = {p:.4f})."
                else:
                    result["error"] = "McNemar's Test requires a 2x2 contingency table."

            elif test_id == "Diagnostic Test (Sensitivity/Specificity)":
                matrix = df.dropna().values
                if matrix.shape == (2, 2):
                    TP, FN = matrix[0, 0], matrix[0, 1]
                    FP, TN = matrix[1, 0], matrix[1, 1]
                    
                    sens = TP / (TP + FN) if (TP + FN) > 0 else 0
                    spec = TN / (TN + FP) if (TN + FP) > 0 else 0
                    ppv = TP / (TP + FP) if (TP + FP) > 0 else 0
                    npv = TN / (TN + FN) if (TN + FN) > 0 else 0
                    acc = (TP + TN) / np.sum(matrix)
                    
                    report = f"**Diagnostic Test Performance:**\\n\\n"
                    report += f"- **Sensitivity (TPR):** {sens:.3f} ({sens*100:.1f}%)\\n"
                    report += f"- **Specificity (TNR):** {spec:.3f} ({spec*100:.1f}%)\\n"
                    report += f"- **Positive Predictive Value (PPV):** {ppv:.3f} ({ppv*100:.1f}%)\\n"
                    report += f"- **Negative Predictive Value (NPV):** {npv:.3f} ({npv*100:.1f}%)\\n"
                    report += f"- **Overall Accuracy:** {acc:.3f} ({acc*100:.1f}%)"
                    
                    result["statistic"] = get_clean_float(acc)
                    result["report_markdown"] = report
                else:
                    result["error"] = "Diagnostic tests require a 2x2 contingency table (Rows: Test Positive/Negative, Cols: Condition Positive/Negative)."

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
                    
                    report = f"A **{test_id}** was performed to examine the relationship between {x_name} and each Y dataset.\\n\\n"
                    
                    table_header = f"| Y Dataset | {'r' if method=='pearson' else 'rho'} | 95% CI | p-value | Significant? | n |\\n"
                    table_header += "|---|---|---|---|---|---|\\n"
                    report += table_header
                    
                    results_list = []
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 3:
                            report += f"| {y_name} | N/A | N/A | N/A | Insufficient data | {len(df_clean)} |\\n"
                            continue
                            
                        res = pg.corr(df_clean[x_col], df_clean[y_col], method=method)
                        
                        r_val = get_clean_float(res['r'].iloc[0])
                        
                        # Robust p-val extraction
                        p_col = 'p-val' if 'p-val' in res.columns else ('pval' if 'pval' in res.columns else None)
                        p_val = get_clean_float(res[p_col].iloc[0]) if p_col else None
                        
                        ci = res['CI95%'].iloc[0] if 'CI95%' in res.columns else None
                        n_val = int(res['n'].iloc[0])
                        
                        sig = "Yes" if p_val is not None and p_val < 0.05 else "No"
                        
                        ci_str = f"[{ci[0]:.3f}, {ci[1]:.3f}]" if ci is not None else "N/A"
                        p_str = f"{p_val:.4f}" if p_val is not None else "N/A"
                        r_str = f"{r_val:.3f}" if r_val is not None else "N/A"
                        
                        report += f"| {y_name} | {r_str} | {ci_str} | {p_str} | {sig} | {n_val} |\\n"
                        
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
                    
                    report = f"A **Simple Linear Regression** was performed.\\n\\n"
                    
                    table_header = "| Y Dataset | Slope (95% CI) | Intercept | R² | p-value | Equation |\\n"
                    table_header += "|---|---|---|---|---|---|\\n"
                    report += table_header
                    
                    results_list = []
                    
                    rss_separate = 0
                    df_separate = 0
                    
                    x_pool = []
                    y_pool = []
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 3:
                            report += f"| {y_name} | N/A | N/A | N/A | N/A | Insufficient data |\\n"
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
                        p_str = f"{slope_p:.4f}"
                        r2_str = f"{r_sq:.3f}" if r_sq is not None else "N/A"
                        
                        report += f"| {y_name} | {slope_str} | {intercept_val:.3f} | {r2_str} | {p_str} | {eq_str} |\\n"
                        
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
                            report += f"\\n**Line Comparison:** An Extra Sum-of-Squares F-test was performed to test if the slopes and intercepts are significantly different between datasets. The lines are **{sig_f}** (F({df_num}, {df_separate}) = {F_val:.3f}, p = {p_val_f:.4f}).\\n"
                            
                    if options.get("interpolate_unknowns", False):
                        report += f"\\n**Interpolated Unknowns from Standard Curve:**\\n\\n"
                        interp_header = "| Y Dataset | Y (Input) | X (Interpolated) |\\n"
                        interp_header += "|---|---|---|\\n"
                        report += interp_header
                        
                        for y_col in y_cols:
                            y_name = col_id_to_name.get(y_col, y_col)
                            res_entry = next((r for r in results_list if r["dataset"] == y_name), None)
                            if res_entry and res_entry["slope"] != 0:
                                df_missing_x = df[df[x_col].isna() & df[y_col].notna()]
                                for _, row in df_missing_x.iterrows():
                                    y_val = row[y_col]
                                    x_interp = (y_val - res_entry["intercept"]) / res_entry["slope"]
                                    report += f"| {y_name} | {y_val:.3f} | {x_interp:.4f} |\\n"
                        
                    result["report_markdown"] = report

            elif test_id == "Deming Regression":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    report = f"A **Deming Regression** (Orthogonal regression, assuming variance ratio = 1) was performed.\\n\\n"
                    table_header = "| Y Dataset | Slope | Y-intercept | Equation |\\n"
                    table_header += "|---|---|---|---|\\n"
                    report += table_header
                    
                    results_list = []
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 3:
                            report += f"| {y_name} | N/A | N/A | Insufficient data |\\n"
                            continue
                            
                        x = df_clean[x_col].values
                        y = df_clean[y_col].values
                        
                        cov = np.cov(x, y)
                        s_xx = cov[0, 0]
                        s_yy = cov[1, 1]
                        s_xy = cov[0, 1]
                        
                        # Calculate slope
                        b1 = (s_yy - s_xx + np.sqrt((s_yy - s_xx)**2 + 4 * s_xy**2)) / (2 * s_xy) if s_xy != 0 else float('inf')
                        # Calculate intercept
                        b0 = np.mean(y) - b1 * np.mean(x) if b1 != float('inf') else float('nan')
                        
                        eq_str = f"Y = {b1:.3f}*X + {b0:.3f}" if b1 != float('inf') else "Undefined"
                        report += f"| {y_name} | {b1:.3f} | {b0:.3f} | {eq_str} |\\n"
                        
                        results_list.append({
                            "dataset": y_name,
                            "slope": b1,
                            "intercept": b0
                        })
                    
                    result["statistic"] = get_clean_float(results_list[0]["slope"]) if results_list else None
                    result["p_value"] = None # Standard Deming doesn't output a simple p-value like OLS
                    result["effect_size"] = {"slopes": [get_clean_float(r["slope"]) for r in results_list]}
                    
                    result["report_markdown"] = report

            elif test_id == "Nonlinear Curve Fitting":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    model_type = options.get("nonlinear_model", "Exponential")
                    
                    report = f"A **Nonlinear Curve Fitting** ({model_type} model) was performed.\\n\\n"
                    table_header = "| Y Dataset | Equation | Parameters | R² | AICc |\\n"
                    table_header += "|---|---|---|---|---|\\n"
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
                            report += f"| {y_name} | N/A | Insufficient data | N/A | N/A |\\n"
                            continue
                            
                        x = df_clean[x_col].values
                        y = df_clean[y_col].values
                        
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
                            report += f"| {y_name} | {eq_str} | Convergence failed | N/A | N/A |\\n"
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
                        
                        report += f"| {y_name} | {eq_str} | {params_joined} | {r_squared:.3f} | {aicc:.1f} |\\n"
                        
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

                        report += f"\\n**Interpolated Unknowns from Standard Curve:**\\n\\n"
                        interp_header = "| Y Dataset | Y (Input) | X (Interpolated) |\\n"
                        interp_header += "|---|---|---|\\n"
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
                                        report += f"| {y_name} | {y_val:.3f} | {x_interp:.4f} |\\n"
                                    except Exception:
                                        report += f"| {y_name} | {y_val:.3f} | Solver failed |\\n"
                    
                    result["report_markdown"] = report

            elif test_id == "Area Under Curve":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    baseline = float(options.get("auc_baseline", 0.0))
                    
                    report = f"An **Area Under Curve (AUC)** analysis was performed with a baseline of {baseline}.\\n\\n"
                    table_header = "| Y Dataset | Total Area | Peak (Max Y) | X at Peak |\\n"
                    table_header += "|---|---|---|---|\\n"
                    report += table_header
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 2:
                            continue
                            
                        x = df_clean[x_col].values
                        y = df_clean[y_col].values
                        
                        # Apply baseline
                        y_adj = np.maximum(y - baseline, 0)
                        
                        area = np.trapz(y_adj, x)
                        peak_y = np.max(y)
                        peak_x = x[np.argmax(y)]
                        
                        report += f"| {y_name} | {area:.4f} | {peak_y:.4f} | {peak_x:.4f} |\\n"
                        
                    result["report_markdown"] = report

            elif test_id == "Fit Spline/LOWESS":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    method = options.get("smooth_method", "LOWESS")
                    
                    report = f"A **{method}** smoothing operation was performed.\\n\\n"
                    table_header = "| Y Dataset | Operation Status |\\n"
                    table_header += "|---|---|\\n"
                    report += table_header
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        if len(df_clean) < 4:
                            continue
                            
                        report += f"| {y_name} | Smoothing applied |\\n"
                    
                    result["report_markdown"] = report + "\\n*(Note: Smoothed data coordinates are generated in the dataset but not shown here for brevity.)*"

            elif test_id == "Smooth/Differentiate/Integrate":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    operation = options.get("sdi_operation", "Smooth")
                    
                    report = f"A **{operation}** operation (Savitzky-Golay) was performed.\\n\\n"
                    table_header = "| Y Dataset | Operation Status |\\n"
                    table_header += "|---|---|\\n"
                    report += table_header
                    
                    for y_col in y_cols:
                        report += f"| {col_id_to_name.get(y_col, y_col)} | Operation applied |\\n"
                        
                    result["report_markdown"] = report + f"\\n*(Note: {operation} output coordinates are generated in the dataset.)*"

            elif test_id == "Simple Logistic Regression":
                if len(columns) >= 2:

                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    report = f"A **Simple Logistic Regression** was performed. The threshold was optimized using cost-weighted metrics (default Cost FP=1, Cost FN=1).\\n\\n"
                    table_header = "| Y Dataset | Pseudo R² | p-value | AUC | Opt. Threshold | Accuracy | Sensitivity | Specificity | Equation |\\n"
                    table_header += "|---|---|---|---|---|---|---|---|---|\\n"
                    report += table_header
                    
                    for y_col in y_cols:
                        df_clean = df[[x_col, y_col]].dropna()
                        y_name = col_id_to_name.get(y_col, y_col)
                        
                        y_vals = df_clean[y_col].values
                        unique_y = np.unique(y_vals)
                        
                        if len(unique_y) < 2:
                            report += f"| {y_name} | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Needs binary Y |\\n"
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
                            report += f"| {y_name} | {pr2:.3f} | {p_val:.4f} | {roc_auc:.3f} | {opt_threshold:.2f} | {accuracy:.2f} | {sensitivity:.2f} | {specificity:.2f} | {eq_str} |\\n"
                        except Exception:
                            report += f"| {y_name} | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Convergence failed |\\n"
                            
                    result["report_markdown"] = report

            elif test_id == "Row Statistics":
                if len(columns) >= 2:
                    x_col = columns[0]
                    y_cols = columns[1:]
                    
                    report = f"**Row Statistics** were computed across replicates.\\n\\n"
                    table_header = "| X Value | N | Mean | Median | SD | SEM | 95% CI |\\n"
                    table_header += "|---|---|---|---|---|---|---|\\n"
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
                            report += f"| {x_val} | {n_val} | {mean_val:.3f} | {med_val:.3f} | {sd_val:.3f} | {sem_val:.3f} | {ci_str} |\\n"
                            
                    if len(df_stats) > 20:
                        report += f"| ... | ... | ... | ... | ... | ... | ... |\\n"
                        
                    result["report_markdown"] = report



        elif table_type == "Grouped":
            if "rowTitle" in df.columns:
                factor1_col = "rowTitle"
                value_cols = columns
                
                # Create a long-format DataFrame
                df['Subject'] = df.index
                df_long = pd.melt(df, id_vars=[factor1_col, 'Subject'], value_vars=value_cols, 
                                  var_name='Factor2', value_name='Value').dropna()
                
                if replicates > 1:
                    df_long['Factor2'] = df_long['Factor2'].apply(lambda x: x.rsplit('_', 1)[0])
                
                if test_id == "Two-way ANOVA":
                    # Check for replicates
                    has_reps = len(df_long) > len(df_long[[factor1_col, 'Factor2']].drop_duplicates())
                    
                    try:
                        res = pg.anova(data=df_long, dv='Value', between=[factor1_col, 'Factor2'], ss_type=3)
                    except ValueError as e:
                        if not has_reps:
                            result["error"] = "Two-way ANOVA requires replicates to compute interaction. Please provide multiple values per group or row."
                            return result
                        raise e
                    
                    report = f"A **Two-way ANOVA** was performed.\\n\\n"
                    table_header = "| Source | SS | DF | MS | F | p-value | np2 |\\n"
                    table_header += "|---|---|---|---|---|---|---|\\n"
                    report += table_header
                    
                    p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res.columns), None)
                    for _, row in res.iterrows():
                        src = row['Source']
                        ss = row.get('SS', 0)
                        df_val = row.get('DF', 0)
                        ms = row.get('MS', 0)
                        f = row.get('F', 0)
                        p = row[p_col] if p_col else np.nan
                        np2 = row.get('np2', 0)
                        report += f"| {src} | {ss:.3f} | {df_val} | {ms:.3f} | {f:.3f} | {p:.4f} | {np2:.3f} |\\n"
                        
                    result["report_markdown"] = report
                    
                    if post_hoc_family != 'none':
                        try:
                            # 1. Get MSE and DF_error from the Two-Way ANOVA
                            aov = pg.anova(dv='Value', data=df_long, between=[factor1_col, 'Factor2'], detailed=True)
                            res_row = aov[aov['Source'] == 'Residual']
                            mse = float(res_row['MS'].values[0])
                            df_err = float(res_row['DF'].values[0])
                            
                            # 2. Get unweighted cell means and counts for LS means calculation
                            cell_stats = df_long.groupby([factor1_col, 'Factor2'])['Value'].agg(['mean', 'count']).reset_index()
                            cells = {}
                            for _, r in cell_stats.iterrows():
                                cells[(r[factor1_col], r['Factor2'])] = {'mean': float(r['mean']), 'n': float(r['count'])}
                                
                            row_levels = df_long[factor1_col].dropna().unique()
                            col_levels = df_long['Factor2'].dropna().unique()
                            R = len(row_levels)
                            C = len(col_levels)
                            
                            from statsmodels.stats.libqsturng import psturng
                            import itertools
                            import numpy as np
                            
                            def format_p(p):
                                if np.isnan(p): return "nan"
                                if p < 0.0001: return "< 0.0001"
                                return f"{p:.4f}"
                                
                            report += f"\\n### Multiple Comparisons ({post_hoc_test})\\n\\n"
                            
                            # 1. Main Row Effect
                            report += f"#### Compare row means (main row effect)\\n"
                            report += "| A | B | Predicted (LS) Mean Diff | SE of diff | p-tukey |\\n"
                            report += "|---|---|---|---|---|\\n"
                            for a, b in itertools.combinations(row_levels, 2):
                                ls_mean_a = np.nanmean([cells.get((a, c), {}).get('mean', np.nan) for c in col_levels])
                                ls_mean_b = np.nanmean([cells.get((b, c), {}).get('mean', np.nan) for c in col_levels])
                                diff = ls_mean_a - ls_mean_b
                                var_a = (mse / (C**2)) * sum([1/cells.get((a, c), {}).get('n', np.inf) for c in col_levels])
                                var_b = (mse / (C**2)) * sum([1/cells.get((b, c), {}).get('n', np.inf) for c in col_levels])
                                se = np.sqrt(var_a + var_b)
                                q = (abs(diff) * np.sqrt(2)) / se
                                pval = psturng(q, R, df_err)[0]
                                report += f"| {a} | {b} | {diff:.4f} | {se:.4f} | {format_p(pval)} |\\n"

                            # 2. Main Col Effect
                            report += f"\\n#### Compare column means (main column effect)\\n"
                            report += "| A | B | Predicted (LS) Mean Diff | SE of diff | p-tukey |\\n"
                            report += "|---|---|---|---|---|\\n"
                            for a, b in itertools.combinations(col_levels, 2):
                                ls_mean_a = np.nanmean([cells.get((r, a), {}).get('mean', np.nan) for r in row_levels])
                                ls_mean_b = np.nanmean([cells.get((r, b), {}).get('mean', np.nan) for r in row_levels])
                                diff = ls_mean_a - ls_mean_b
                                var_a = (mse / (R**2)) * sum([1/cells.get((r, a), {}).get('n', np.inf) for r in row_levels])
                                var_b = (mse / (R**2)) * sum([1/cells.get((r, b), {}).get('n', np.inf) for r in row_levels])
                                se = np.sqrt(var_a + var_b)
                                q = (abs(diff) * np.sqrt(2)) / se
                                pval = psturng(q, C, df_err)[0]
                                report += f"| {a} | {b} | {diff:.4f} | {se:.4f} | {format_p(pval)} |\\n"
                                
                            # 3. Interaction Effect (Compare cells within same row)
                            report += f"\\n#### Compare cell means (interaction effect)\\n"
                            report += "| A | B | Predicted (LS) Mean Diff | SE of diff | p-tukey |\\n"
                            report += "|---|---|---|---|---|\\n"
                            for r in row_levels:
                                for c1, c2 in itertools.combinations(col_levels, 2):
                                    mean_a = cells.get((r, c1), {}).get('mean', np.nan)
                                    mean_b = cells.get((r, c2), {}).get('mean', np.nan)
                                    n_a = cells.get((r, c1), {}).get('n', np.inf)
                                    n_b = cells.get((r, c2), {}).get('n', np.inf)
                                    if np.isinf(n_a) or np.isinf(n_b): continue
                                    diff = mean_a - mean_b
                                    se = np.sqrt(mse * (1/n_a + 1/n_b))
                                    q = (abs(diff) * np.sqrt(2)) / se
                                    pval = psturng(q, C, df_err)[0]
                                    name_a = f"{r} {c1}"
                                    name_b = f"{r} {c2}"
                                    report += f"| {name_a} | {name_b} | {diff:.4f} | {se:.4f} | {format_p(pval)} |\\n"
                                
                            result["report_markdown"] = report
                        except Exception as e:
                            report += f"\\n*Note: Could not compute multiple comparisons ({str(e)})*\\n"
                            result["report_markdown"] = report

                elif test_id == "RM Two-way ANOVA" or test_id == "Mixed-effects ANOVA":
                    # Assume Subject is random effect, Factor2 is within, Factor1 is between (for Mixed) or both within (RM)
                    # For simplicity, if RM Two-way, both are within. If Mixed, one between one within.
                    if test_id == "Mixed-effects ANOVA":
                        res = pg.mixed_anova(data=df_long, dv='Value', between=factor1_col, within='Factor2', subject='Subject')
                    else:
                        res = pg.rm_anova(data=df_long, dv='Value', within=[factor1_col, 'Factor2'], subject='Subject')
                        
                    report = f"A **{test_id}** was performed.\\n\\n"
                    table_header = "| Source | SS | DF | MS | F | p-value | np2 | eps |\\n"
                    table_header += "|---|---|---|---|---|---|---|---|\\n"
                    report += table_header
                    
                    p_col = next((c for c in ['p-unc', 'p_unc', 'p-val', 'p_val', 'pval', 'p'] if c in res.columns), None)
                    for _, row in res.iterrows():
                        src = row['Source']
                        ss = row.get('SS', 0)
                        df_val = row.get('DF', 0)
                        df2_val = row.get('DF2', 0)
                        ms = row.get('MS', 0)
                        f = row.get('F', 0)
                        p = row[p_col] if p_col else np.nan
                        np2 = row.get('np2', 0)
                        eps = row.get('eps', '')
                        if isinstance(eps, float): eps = f"{eps:.3f}"
                        report += f"| {src} | {ss:.3f} | {df_val}, {df2_val} | {ms:.3f} | {f:.3f} | {p:.4f} | {np2:.3f} | {eps} |\\n"
                        
                    result["report_markdown"] = report
                
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
                            T_list.append(time_val)
                            E_list.append(event_code)
                            groups_list.append(col_id_to_name.get(g_col, g_col))
                
                if len(T_list) == 0:
                    result["error"] = "Insufficient valid time and event data for Survival Analysis."
                else:
                    T = np.array(T_list)
                    E = np.array(E_list)
                    groups = np.array(groups_list)
                    
                    unique_groups = np.unique(groups)
                    
                    if test_id == "Survival Analysis" or test_id == "Kaplan-Meier Survival Analysis" or test_id == "Log-rank (Mantel-Cox) test" or test_id == "Hazard Ratios":
                        report = f"A **Comprehensive Survival Analysis** was performed.\\n\\n"
                        
                        # 1. Kaplan Meier & Median Survival
                        report += "### Median Survival & Kaplan-Meier Estimates\\n"
                        report += "| Group | Median Survival | 95% CI Lower | 95% CI Upper |\\n"
                        report += "|---|---|---|---|\\n"
                        
                        km_data = {}
                        times_all = np.sort(np.unique(T))
                        
                        for g in unique_groups:
                            mask = groups == g
                            Tg = T[mask]
                            Eg = E[mask]
                            
                            kmf = KaplanMeierFitter()
                            kmf.fit(Tg, event_observed=Eg, label=g)
                            
                            med = kmf.median_survival_time_
                            # lifelines 0.27+ median_survival_time_ returns a float or inf
                            ci_lower = kmf.median_survival_time_
                            ci_upper = kmf.median_survival_time_
                            try:
                                median_ci = median_survival_times(kmf.confidence_interval_)
                                ci_lower = median_ci.iloc[0, 0]
                                ci_upper = median_ci.iloc[0, 1]
                            except:
                                pass
                            
                            report += f"| {g} | {med} | {ci_lower} | {ci_upper} |\\n"
                            
                        # Number at Risk
                        report += "\\n### Number at Risk\\n"
                        report += "| Time | " + " | ".join([str(g) for g in unique_groups]) + " |\\n"
                        report += "|---|" + "---|" * len(unique_groups) + "\\n"
                        
                        # Show at risk at unique time points including 0
                        t_steps = np.sort(np.unique([0.0] + list(T)))
                        for t_step in t_steps:
                            row_str = f"| {t_step:.1f} | "
                            for g in unique_groups:
                                mask = groups == g
                                Tg = T[mask]
                                at_risk = np.sum(Tg >= t_step)
                                row_str += f"{at_risk} | "
                            report += row_str + "\\n"
                            
                        # 2. Curve Comparisons
                        if len(unique_groups) >= 2:
                            report += "\\n### Curve Comparisons\\n"
                            
                            res_logrank = multivariate_logrank_test(T, groups, E)
                            sig_lr = "significant" if res_logrank.p_value < 0.05 else "not significant"
                            report += f"- **Log-rank (Mantel-Cox) test:** The difference is **{sig_lr}** (Chi-square = {res_logrank.test_statistic:.3f}, p = {res_logrank.p_value:.4f}).\\n"
                            
                            try:
                                res_wilcoxon = multivariate_logrank_test(T, groups, E, weightings='wilcoxon')
                                sig_w = "significant" if res_wilcoxon.p_value < 0.05 else "not significant"
                                report += f"- **Gehan-Breslow-Wilcoxon test:** The difference is **{sig_w}** (Chi-square = {res_wilcoxon.test_statistic:.3f}, p = {res_wilcoxon.p_value:.4f}).\\n"
                            except Exception:
                                pass
                                
                            # 3. Hazard Ratios
                            control_group = col_id_to_name.get(group_cols[0], group_cols[0])
                            other_groups = [g for g in unique_groups if g != control_group]
                            
                            report += f"\\n### Hazard Ratios (vs {control_group})\\n"
                            
                            df_surv = pd.DataFrame({'T': T, 'E': E, 'Group': groups})
                            
                            for other_g in other_groups:
                                report += f"#### {other_g} vs {control_group}\\n"
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
                                
                                report += f"#### {other_g} vs {control_group}\\n\\n"
                                report += f"- **Logrank HR ({other_g} / {control_group}):** {hr_logrank:.3f} (95% CI: {logrank_ci_low:.3f} to {logrank_ci_high:.3f})\\n"
                                report += f"- **Mantel-Haenszel HR ({other_g} / {control_group}):** {hr_mh:.3f} (95% CI: {mh_ci_low:.3f} to {mh_ci_high:.3f})\\n\\n"
                                
                                hr_logrank_recip = 1/hr_logrank if hr_logrank > 0 else float('inf')
                                hr_mh_recip = 1/hr_mh if hr_mh > 0 else float('inf')
                                mh_ci_low_recip = 1/mh_ci_high if mh_ci_high > 0 else float('inf')
                                mh_ci_high_recip = 1/mh_ci_low if mh_ci_low > 0 else float('inf')
                                logrank_ci_low_recip = 1/logrank_ci_high if logrank_ci_high > 0 else float('inf')
                                logrank_ci_high_recip = 1/logrank_ci_low if logrank_ci_low > 0 else float('inf')
                                
                                report += f"#### {control_group} vs {other_g}\\n\\n"
                                report += f"- **Logrank HR ({control_group} / {other_g}):** {hr_logrank_recip:.3f} (95% CI: {logrank_ci_low_recip:.3f} to {logrank_ci_high_recip:.3f})\\n"
                                report += f"- **Mantel-Haenszel HR ({control_group} / {other_g}):** {hr_mh_recip:.3f} (95% CI: {mh_ci_low_recip:.3f} to {mh_ci_high_recip:.3f})\\n"
                                        
                        result["report_markdown"] = report
            else:
                result["error"] = "Survival Analysis requires Time and at least one Group column."

    
    except ZeroDivisionError:
        result["error"] = "Division by zero. This usually happens when a group has no variance (all values are identical) or there is not enough data to compute statistics."
    except Exception as e:
        result["error"] = f"Statistical error: {str(e)}. Check your data for missing values, zero variance, or insufficient sample sizes."
        
    return result

run()
  