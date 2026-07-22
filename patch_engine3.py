import re

with open('apps/web/src/stats/analysis_engine.py', 'r') as f:
    content = f.read()

target1 = """                    matrix = df[data_cols].apply(pd.to_numeric, errors='coerce').fillna(0).values"""
replacement1 = """                    # Drop rows that are completely NaN across all data columns
                    df_clean = df.dropna(subset=data_cols, how='all').copy()
                    if len(df_clean) == 0:
                        result["error"] = "No valid data to analyze."
                        return result
                        
                    matrix = df_clean[data_cols].apply(pd.to_numeric, errors='coerce').values
                    row_titles = df_clean.get("rowTitle", pd.Series([f"Row {i+1}" for i in range(len(df_clean))])).astype(str).tolist()"""

if target1 in content:
    content = content.replace(target1, replacement1)
    
    # We also need to fix row_titles computation which is right below matrix
    target_row_titles = """                    row_titles = df.get("rowTitle", pd.Series([f"Row {i+1}" for i in range(len(df))])).astype(str).tolist()"""
    content = content.replace(target_row_titles, "")
    
    # We need to change np.sum since matrix has NaNs
    target2 = """                    grand_total = np.sum(matrix)
                    col_totals = np.sum(matrix, axis=0)
                    row_totals = np.sum(matrix, axis=1)"""
    replacement2 = """                    grand_total = np.nansum(matrix)
                    col_totals = np.nansum(matrix, axis=0)
                    row_totals = np.nansum(matrix, axis=1)"""
    content = content.replace(target2, replacement2)
    
    # Now we need to update the part where we loop over modes and columns
    # Right now it does `val = matrix[r_idx, c_idx]`
    # Let's replace the whole inner loop of Fraction of Total
    target3 = """                                for r_idx in range(len(row_titles)):
                                    val = matrix[r_idx, c_idx]
                                    
                                    if mode == "column":
                                        denom = col_totals[c_idx]
                                    elif mode == "row":
                                        denom = row_totals[r_idx]
                                    else:
                                        denom = grand_total

                                    if denom > 0:
                                        fraction = val / denom
                                        
                                        if fot_display_as == "percentages":
                                            val_disp = fraction * 100.0
                                        else:
                                            val_disp = fraction

                                        row_data = {
                                            "Row": row_titles[r_idx],
                                            "Value": val_disp
                                        }

                                        if fot_calc_ci:
                                            ci_low, ci_high = proportion_confint(val, denom, alpha=alpha, method=ci_method_sm)
                                            if fot_display_as == "percentages":
                                                ci_low *= 100.0
                                                ci_high *= 100.0
                                            row_data[f"CI Low"] = ci_low
                                            row_data[f"CI High"] = ci_high
                                        
                                        col_group_results.append(row_data)"""
                                        
    replacement3 = """                                for r_idx in range(len(row_titles)):
                                    val = matrix[r_idx, c_idx]
                                    if np.isnan(val):
                                        continue  # Skip missing values
                                        
                                    if mode == "column":
                                        denom = col_totals[c_idx]
                                    elif mode == "row":
                                        denom = row_totals[r_idx]
                                    else:
                                        denom = grand_total

                                    if denom > 0:
                                        fraction = val / denom
                                        
                                        if fot_display_as == "percentages":
                                            val_disp = fraction * 100.0
                                        else:
                                            val_disp = fraction

                                        row_data = {
                                            "Row": row_titles[r_idx],
                                            "Value": val_disp
                                        }

                                        if fot_calc_ci:
                                            ci_low, ci_high = proportion_confint(val, denom, alpha=alpha, method=ci_method_sm)
                                            if fot_display_as == "percentages":
                                                ci_low *= 100.0
                                                ci_high *= 100.0
                                            row_data[f"CI Low"] = ci_low
                                            row_data[f"CI High"] = ci_high
                                        
                                        col_group_results.append(row_data)"""
    content = content.replace(target3, replacement3)

    with open('apps/web/src/stats/analysis_engine.py', 'w') as f:
        f.write(content)
    print("Patched analysis_engine for NaN handling")
else:
    print("Target 1 not found")
