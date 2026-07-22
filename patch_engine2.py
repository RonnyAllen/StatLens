import re

with open('apps/web/src/stats/analysis_engine.py', 'r') as f:
    content = f.read()

target = """                fot_calc_ci = options.get("fotCalculateCI", True)
                fot_ci_level = options.get("fotCILevel", 95)
                alpha = 1.0 - (fot_ci_level / 100.0)"""

replacement = """                fot_calc_ci = options.get("fotCalculateCI", True)
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

                alpha = 1.0 - (fot_ci_level / 100.0)"""

if target in content:
    content = content.replace(target, replacement)
else:
    print("WARNING: target 1 not found")


target2_row = """ci_low, ci_high = proportion_confint(val, denom, alpha=alpha, method='wilson')"""
replacement2_row = """ci_low, ci_high = proportion_confint(val, denom, alpha=alpha, method=ci_method_sm)"""

content = content.replace(target2_row, replacement2_row)

target3 = """report = ""

                        modes = ["column", "row", "grand"] if fot_divide_by == "all" else [fot_divide_by]"""

replacement3 = """report = f"A **Fraction of Total** analysis was performed.\\n\\n"
                        report += f"**Divide by:** {fot_divide_by.capitalize()} total  "
                        report += f"**Display as:** {fot_display_as.capitalize()}  "
                        if fot_calc_ci:
                            report += f"**Confidence Intervals:** {fot_ci_level}% ({method_name})\\n\\n"
                        else:
                            report += f"**Confidence Intervals:** None\\n\\n"

                        modes = ["column", "row", "grand"] if fot_divide_by == "all" else [fot_divide_by]"""

if target3 in content:
    content = content.replace(target3, replacement3)
else:
    print("WARNING: target 3 not found")

with open('apps/web/src/stats/analysis_engine.py', 'w') as f:
    f.write(content)
print("Patched analysis_engine for fotCIMethod")
