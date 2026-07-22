import re

with open('apps/web/src/stats/analysis_engine.py', 'r') as f:
    content = f.read()

# Fix 1: ChiSq expected values keys
target1 = """                        for i, (orig_idx, row) in enumerate(valid_df.iterrows()):
                            exp_val = chi_exp_values.get(str(orig_idx))
                            if exp_val is None:
                                valid = False
                                break
                            exp.append(exp_val)"""
replacement1 = """                        for i, (orig_idx, row) in enumerate(valid_df.iterrows()):
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
                            exp.append(exp_val)"""
if target1 in content:
    content = content.replace(target1, replacement1)
else:
    print("Target 1 not found")

# Fix 2: Fraction of total formatting (change .2f to .5f)
target2_1 = """row_str += f"{display_val:.2f}{sym} [{d_low:.2f}{sym}, {d_high:.2f}{sym}] | \""""
replacement2_1 = """row_str += f"{display_val:.5f}{sym} [{d_low:.5f}{sym}, {d_high:.5f}{sym}] | \""""

target2_2 = """row_str += f"{display_val:.2f}{sym} | \""""
replacement2_2 = """row_str += f"{display_val:.5f}{sym} | \""""

target2_3 = """report += f"| {r_title} | {val} | {display_val:.2f}{sym} | [{d_low:.2f}{sym}, {d_high:.2f}{sym}] |\\n\""""
replacement2_3 = """report += f"| {r_title} | {val} | {display_val:.5f}{sym} | [{d_low:.5f}{sym}, {d_high:.5f}{sym}] |\\n\""""

target2_4 = """report += f"| {r_title} | {val} | {display_val:.2f}{sym} |\\n\""""
replacement2_4 = """report += f"| {r_title} | {val} | {display_val:.5f}{sym} |\\n\""""

content = content.replace(target2_1, replacement2_1)
content = content.replace(target2_2, replacement2_2)
content = content.replace(target2_3, replacement2_3)
content = content.replace(target2_4, replacement2_4)

# Fix 3: Omnibus ChiSq 5 decimal formatting
# In analysis_engine.py, ChiSq adds formatted result for json output in some places? No, json output uses float.
# But Omnibus summary uses `.4f` or whatever. Wait! The screenshot shows "322.518" and "322.5180".
# In AnalysisResultsView.tsx, Omnibus summary uses `.toFixed(4)`.
# The user wants "All values should be accurate to 5 decimal places".
# Does the user mean Omnibus summary as well? The JSON has raw floats. We should change AnalysisResultsView to `.toFixed(5)`.

with open('apps/web/src/stats/analysis_engine.py', 'w') as f:
    f.write(content)
print("Patched analysis_engine.py for 5 decimal places and dict keys")
