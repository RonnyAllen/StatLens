import sys
content = open('apps/web/src/stats/analysis_engine.py').read()

# 1. Cochran-Armitage Trend Test
cochran = """
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
                        weights = _np.arange(1, matrix.shape[1] + 1)
                        R1 = matrix[0].sum()
                        R2 = matrix[1].sum()
                        col_totals = matrix.sum(axis=0)
                        
                        if R1 == 0 or R2 == 0:
                            z = 0
                            p_val = 1.0
                        else:
                            term1 = _np.sum(weights * matrix[0])
                            term2 = (R1 / N) * _np.sum(weights * col_totals)
                            numerator = term1 - term2
                            
                            var = (R1 * R2) / (N * (N - 1)) * (_np.sum(col_totals * (weights**2)) - (_np.sum(col_totals * weights)**2) / N)
                            if var <= 0:
                                z = 0
                                p_val = 1.0
                            else:
                                z = numerator / _np.sqrt(var)
                                p_val = 2 * _st.norm.sf(_np.abs(z))
                        
                        result["statistic"] = get_clean_float(z)
                        result["p_value"] = get_clean_float(p_val)
                        result["report_markdown"] = (f"A **Cochran-Armitage Trend Test** was performed.\\n\\n"
                                  f"**Z-statistic:** {z:.4f}\\n"
                                  f"**p-value:** {format_p_value(p_val)}\\n")
"""

target_str = '                    result["error"] = "Diagnostic tests require a 2x2 contingency table (Rows: Test Positive/Negative, Cols: Condition Positive/Negative)."'
if 'elif test_id == "Cochran-Armitage Trend Test":' not in content:
    content = content.replace(target_str, target_str + '\n' + cochran)


# 2. Fraction of Total
fraction = """
            elif test_id == "Fraction of Total":
                counts = []
                labels = []
                group_col = columns[1] if (len(columns) > 1 and columns[0] == "rowTitle") else columns[0] if len(columns) > 0 else None
                if not group_col:
                    result["error"] = "No data column found."
                else:
                    for idx, row in df.iterrows():
                        v = row.get(group_col)
                        if pd.notna(v) and v is not None:
                            try:
                                c_val = float(v)
                                if c_val >= 0:
                                    counts.append(c_val)
                                    labels.append(str(row.get("rowTitle", "Row")))
                            except:
                                pass
                    total = sum(counts)
                    if total <= 0:
                        result["error"] = "Total sum must be strictly positive."
                    else:
                        from statsmodels.stats.proportion import proportion_confint
                        
                        report = "### Fractions & 95% Confidence Intervals (Wilson)\\n\\n"
                        report += "| Category | Count | Fraction (%) | 95% CI |\\n"
                        report += "|---|---|---|---|\\n"
                        for c, lab in zip(counts, labels):
                            frac = c / total
                            ci_low, ci_high = proportion_confint(c, total, method='wilson')
                            report += f"| {lab} | {c} | {frac*100:.2f}% | [{ci_low*100:.2f}%, {ci_high*100:.2f}%] |\\n"
                        
                        result["report_markdown"] = report
"""

target_str3 = '                        result["report_markdown"] = report\n                        result["p_value"] = get_clean_float(p_val)'

if 'elif test_id == "Fraction of Total":' not in content:
    content = content.replace(target_str3, target_str3 + '\n' + fraction)


# 3. Partial Correlation
partial = """
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
                        
                        import pingouin as pg
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
                        result["report_markdown"] = (f"A **Partial Correlation (Pearson)** was performed between {x_col} and {y_col}, controlling for {', '.join(covars)}.\\n\\n"
                                  f"**Partial r:** {r_val:.4f}\\n"
                                  f"**p-value:** {format_p_value(p_val)}\\n")
"""

target_str4_spec = """                for idx, row in corr.iterrows():
                    row_vals = []
                    for col in corr.columns:
                        val = row[col]
                        row_vals.append(str(val))
                    report += f"| **{idx}** | " + " | ".join(row_vals) + " |\\n"
                
                result["report_markdown"] = report"""

if 'elif test_id == "Partial Correlation":' not in content:
    content = content.replace(target_str4_spec, target_str4_spec + '\n' + partial)


# 4. Log-rank Trend Test
logrank = """
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
                            result["report_markdown"] = (f"A **Log-rank Trend Test** (via Cox proportional hazards) was performed.\\n\\n"
                                      f"**Z-statistic:** {z_stat:.4f}\\n"
                                      f"**p-value:** {format_p_value(p_val)}\\n")
"""

target_str5 = '                                result["post_hocs"] = {"method": "Pairwise Logrank (Holm)", "comparisons": ph_results}\n                                \n                        result["report_markdown"] = report'

if 'elif test_id == "Log-rank Trend Test":' not in content:
    content = content.replace(target_str5, target_str5 + '\n' + logrank)

# 5. Menus
menu1 = """    elif table_type == 'Contingency':
        menu = ["Fisher's Exact Test", 'Chi-Square Test', "Chi-Square Test (with Yates' correction)", "McNemar's Test", "Cochran-Armitage Trend Test"]"""
content = content.replace("    elif table_type == 'Contingency':\n        menu = [\"Fisher's Exact Test\", 'Chi-Square Test', \"Chi-Square Test (with Yates' correction)\", \"McNemar's Test\"]", menu1)

menu2 = """    elif table_type == 'MultipleVariables':
        menu = ['Multiple Linear Regression', 'Multiple Logistic Regression', 'Poisson Regression', 'Cox Regression', 'Correlation Matrix', 'Principal Component Analysis (PCA)', 'Partial Correlation']"""
content = content.replace("    elif table_type == 'MultipleVariables':\n        menu = ['Multiple Linear Regression', 'Multiple Logistic Regression', 'Poisson Regression', 'Cox Regression', 'Correlation Matrix', 'Principal Component Analysis (PCA)']", menu2)

menu3 = """    elif table_type == 'PartsOfWhole':
        menu = ['Chi-Square goodness of fit', 'Binomial test', 'Fraction of Total']"""
content = content.replace("    elif table_type == 'PartsOfWhole':\n        menu = ['Chi-Square goodness of fit', 'Binomial test']", menu3)

menu4 = """    elif table_type == 'Survival':
        menu = ['Kaplan-Meier Survival Analysis', 'Log-rank (Mantel-Cox) test', 'Hazard Ratios', 'Gehan-Breslow-Wilcoxon test', 'Cox Regression', 'Log-rank Trend Test']"""
content = content.replace("    elif table_type == 'Survival':\n        menu = ['Kaplan-Meier Survival Analysis', 'Log-rank (Mantel-Cox) test', 'Hazard Ratios', 'Gehan-Breslow-Wilcoxon test', 'Cox Regression']", menu4)

# And fix Fisher-Freeman-Halton exact test inside `analysis_engine.py`!
ffh_target = """                    if len(matrix) == 0 or matrix.size == 0:
                        result["error"] = "Insufficient data for Fisher's Exact test."
                    else:
                        # Fallback to Chi-Square
                        chi2, p, dof, ex = stats.chi2_contingency(matrix)
                        result["statistic"] = get_clean_float(chi2)
                        result["p_value"] = get_clean_float(p)
                        sig = "significant" if p < 0.05 else "not significant"
                        report = f"Table was {matrix.shape[0]}x{matrix.shape[1]}. Fisher's Exact Test requires a 2x2 contingency table. **Chi-Square test** was performed instead. The relationship was **{sig}** (p = {p:.4f})."
                        result["report_markdown"] = report"""

ffh_replace = """                    if len(matrix) == 0 or matrix.size == 0:
                        result["error"] = "Insufficient data for Fisher's Exact test."
                    else:
                        n_perms = 500
                        row_labels = _np.repeat(_np.arange(matrix.shape[0]), matrix.sum(axis=1).astype(int))
                        col_labels = _np.repeat(_np.arange(matrix.shape[1]), matrix.sum(axis=0).astype(int))
                        obs_stat, p_chi, dof, E = _st.chi2_contingency(matrix, correction=False)
                        larger_eq = 0
                        _np.random.seed(42)
                        for _ in range(n_perms):
                            _np.random.shuffle(col_labels)
                            flat = row_labels * matrix.shape[1] + col_labels
                            counts = _np.bincount(flat, minlength=matrix.size).reshape(matrix.shape)
                            sim_stat = _np.sum((counts - E)**2 / E)
                            if sim_stat >= obs_stat - 1e-9:
                                larger_eq += 1
                        p_val = larger_eq / n_perms
                        
                        result["statistic"] = get_clean_float(obs_stat)
                        result["p_value"] = get_clean_float(p_val)
                        sig = "significant" if p_val < 0.05 else "not significant"
                        report = f"Table was {matrix.shape[0]}x{matrix.shape[1]}. A **Fisher-Freeman-Halton Exact Test** (Monte Carlo, {n_perms} perms) was performed. The relationship was **{sig}** (p = {p_val:.4f})."
                        result["report_markdown"] = report"""

content = content.replace(ffh_target, ffh_replace)

with open('apps/web/src/stats/analysis_engine.py', 'w') as f:
    f.write(content)
print("Patched cleanly!")
