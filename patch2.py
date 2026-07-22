import sys
content = open('apps/web/src/stats/analysis_engine.py').read()

# 1. Remove the previously inserted chunk
old_insertion = """            elif test_id == "Cochran-Armitage Trend Test":
                if table_type != "Contingency":
                    result["error"] = "Cochran-Armitage Trend Test is for Contingency tables."
                else:
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
                                      f"**p-value:** {format_p(p_val)}\\n")
                                      
            elif test_id == "Log-rank Trend Test":
                if table_type != "Survival":
                    result["error"] = "Log-rank Trend Test isn't available for this data type."
                elif len(columns) < 3:
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
                                  f"**p-value:** {format_p(p_val)}\\n")

            elif test_id == "Fraction of Total":
                if table_type != "PartsOfWhole":
                    result["error"] = "Fraction of Total is only available for Parts of Whole data."
                else:
                    counts = []
                    labels = []
                    group_col = columns[0] if "rowTitle" not in columns else (columns[1] if len(columns) > 1 else None)
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

            elif test_id == "Partial Correlation":
                if table_type != "MultipleVariables" or len(columns) < 3:
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
                        pval_col = 'p-val' if 'p-val' in pcor.columns else 'p-value'
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
                                  f"**p-value:** {format_p(p_val)}\\n")
"""

content = content.replace(old_insertion, "")

# Now insert properly into each table_type block!
# 1. Cochran-Armitage goes into `elif table_type == 'Contingency':`
# Let's insert it before the end of the Contingency block.
# The Contingency block ends before `elif table_type == "MultipleVariables":`
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
                                  f"**p-value:** {format_p(p_val)}\\n")
"""
content = content.replace('        elif table_type == "MultipleVariables":', cochran + '\n        elif table_type == "MultipleVariables":')

# 2. Fraction of Total goes into `elif table_type == "PartsOfWhole":`
# Insert it before `elif table_type == "Survival":`
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
content = content.replace('        elif table_type == "Survival":', fraction + '\n        elif table_type == "Survival":')

# 3. Partial Correlation goes into `elif table_type == "MultipleVariables":`
# Insert it before `elif table_type == "PartsOfWhole":`
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
                                  f"**p-value:** {format_p(p_val)}\\n")
"""
content = content.replace('        elif table_type == "PartsOfWhole":', partial + '\n        elif table_type == "PartsOfWhole":')

# 4. Log-rank Trend Test goes into `elif table_type == "Survival":`
# Insert it before `        if not result.get("error") and (result.get("report_markdown") or "").strip() in ("", "Test not fully implemented yet."):`
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
                                  f"**p-value:** {format_p(p_val)}\\n")
"""
fallback_str = '        if not result.get("error") and (result.get("report_markdown") or "").strip() in ("", "Test not fully implemented yet."):'
content = content.replace(fallback_str, logrank + '\n' + fallback_str)

with open('apps/web/src/stats/analysis_engine.py', 'w') as f:
    f.write(content)
print('Patch applied cleanly!')
