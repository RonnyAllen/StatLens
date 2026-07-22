import re

with open('apps/web/src/stats/analysis_engine.py', 'r') as f:
    content = f.read()

# Fix 1: Chi-Square JS Proxy conversion and fallback
target1 = """                    chi_exp_values = options.get("chiExpectedValues", {})"""
replacement1 = """                    chi_exp_values = options.get("chiExpectedValues", {})
                    # Convert JsProxy to dict if needed
                    if hasattr(chi_exp_values, 'to_py'):
                        chi_exp_values = chi_exp_values.to_py()"""

if target1 in content:
    content = content.replace(target1, replacement1)
else:
    print("Target 1 not found")

# Fix 2: Fraction of Total column filtering
target2 = """                data_cols = [c for c in columns if c != "rowTitle"]
                if not data_cols:
                    result["error"] = "No data columns found."
                else:
                    # Drop rows that are completely NaN across all data columns
                    df_clean = df.dropna(subset=data_cols, how='all').copy()"""

replacement2 = """                data_cols_initial = [c for c in columns if c != "rowTitle"]
                if not data_cols_initial:
                    result["error"] = "No data columns found."
                else:
                    # Drop rows that are completely NaN across all data columns
                    df_clean = df.dropna(subset=data_cols_initial, how='all').copy()
                    
                    # Also drop columns that are completely NaN (blank variables)
                    data_cols = [c for c in data_cols_initial if not df_clean[c].isna().all()]
                    
                    if not data_cols:
                        result["error"] = "No data to analyze."
                        return result"""

if target2 in content:
    content = content.replace(target2, replacement2)
else:
    print("Target 2 not found")

with open('apps/web/src/stats/analysis_engine.py', 'w') as f:
    f.write(content)
print("Patched analysis_engine.py for bugs")
