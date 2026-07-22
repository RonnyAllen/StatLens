import sys

file_path = 'apps/web/src/stats/analysis_engine.py'
with open(file_path, 'r') as f:
    content = f.read()

chisq_target = """            if test_id == "Chi-Square goodness of fit":
                df_clean = df.dropna()
                data_col = columns[1] if (len(columns) > 1 and columns[0] == "rowTitle") else columns[0] if len(columns) > 0 else None
                if not data_col:
                    result["error"] = "No data found."
                else:
                    observed = df_clean[data_col]
                    chi_stat, p_val = chisquare(f_obs=observed)
                    report = f"A **Chi-Square Goodness-of-Fit Test** was performed.\\n\\n"
                    report += f"**Variable:** {data_col}\\n"
                    report += f"**Assumed Expected:** Equal frequencies across categories.\\n\\n"
                    report += "### Results\\n\\n"
                    p_str = format_p_value(p_val)
                    report += f"- Chi-Square Statistic: {chi_stat:.3f}\\n"
                    report += f"- Degrees of Freedom: {len(observed)-1}\\n"
                    report += f"- P-value: {p_str}\\n\\n"
                    
                    report += "### Observed vs Expected\\n\\n"
                    report += "| Row | Observed | Expected |\\n"
                    report += "|---|---|---|\\n"
                    expected_val = np.sum(observed) / len(observed)
                    for idx, val in enumerate(observed):
                        report += f"| {idx+1} | {val} | {expected_val:.2f} |\\n"
                        
                    result["report_markdown"] = report
                    result["statistic"] = get_clean_float(chi_stat)
                    result["p_value"] = get_clean_float(p_val)"""

chisq_replacement = """            if test_id == "Chi-Square goodness of fit":
                data_cols = [c for c in columns if c != "rowTitle"]
                if not data_cols:
                    result["error"] = "No data columns found."
                else:
                    col = options.get("chiSelectedColumn", data_cols[0])
                    if col not in df.columns:
                        col = data_cols[0]
                    
                    chi_exp_type = options.get("chiExpectedType", "actual")
                    chi_exp_values = options.get("chiExpectedValues", {})
                    
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
                        
                        report = f"A **Chi-Square Goodness-of-Fit Test** was performed.\\n\\n"
                        report += f"**Variable:** {col_id_to_name.get(col, col)}\\n"
                        report += f"**Assumed Expected:** {exp_type_desc}\\n\\n"
                        report += f"### Results\\n"
                        report += f"- Chi-Square Statistic: {chi2:.3f}\\n"
                        report += f"- Degrees of Freedom: {dof}\\n"
                        report += f"- P-value: {format_p_value(p_val)}\\n\\n"
                        
                        report += f"### Observed vs Expected\\n\\n"
                        report += "| Category | Observed | Expected |\\n"
                        report += "|---|---|---|\\n"
                        for i in range(len(obs)):
                            report += f"| {row_titles[i]} | {obs[i]:.1f} | {exp[i]:.2f} |\\n"
                        
                        result["report_markdown"] = report"""

if chisq_target in content:
    content = content.replace(chisq_target, chisq_replacement)
else:
    print("WARNING: Chi-Square goodness of fit target not found")

with open(file_path, 'w') as f:
    f.write(content)
print("Patched engine successfully!")
