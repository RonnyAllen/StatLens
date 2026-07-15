import re

with open('apps/web/src/stats/analysis_engine.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix data extraction for empty strings in Nested t-test / ANOVA
old_nested_extract = \"\"\"                    for idx, row in df.iterrows():
                        for col in columns:
                            if col == 'rowTitle': continue
                            val = row.get(col)
                            if pd.notna(val):
                                main_col = str(col).rsplit('_', 1)[0]
                                long_data.append({
                                    'Subgroup': str(col),
                                    'Treatment': main_col,
                                    'Value': val
                                })\"\"\"

new_nested_extract = \"\"\"                    for idx, row in df.iterrows():
                        for col in columns:
                            if col == 'rowTitle': continue
                            val = row.get(col)
                            if pd.notna(val) and val != "":
                                main_col = str(col).rsplit('_', 1)[0]
                                long_data.append({
                                    'Subgroup': str(col),
                                    'Treatment': main_col,
                                    'Value': float(val)
                                })\"\"\"

content = content.replace(old_nested_extract, new_nested_extract)

# 2. Add analyze_sheet() function to the end of the file
analyze_sheet_fn = \"\"\"
def analyze_sheet():
    sheet = sheet_data
    table_type = sheet.get("type", "Column")
    columns = []
    
    cfg = sheet.get("config", {})
    replicates = cfg.get("replicates")
    if replicates is None and "config" in cfg:
        replicates = cfg.get("config", {}).get("replicates", None)
        if replicates is None:
            replicates = cfg.get("config", {}).get("subcolumns", 1)
    if replicates is None:
        replicates = 1
        
    for g in sheet.get("columnGroups", []):
        if replicates > 1:
            for r in range(1, replicates + 1):
                col_id = f"{g['id']}_{r}"
                columns.append(col_id)
        else:
            columns.append(g["id"])

    df = pd.DataFrame(sheet.get("data", []))
    
    # Check groups with actual numeric data
    valid_groups = []
    
    if table_type == "Nested":
        # Check main columns
        for g in sheet.get("columnGroups", []):
            has_data = False
            for r in range(1, replicates + 1):
                col_id = f"{g['id']}_{r}"
                if col_id in df.columns:
                    # check if any non-empty numeric data
                    numeric_data = pd.to_numeric(df[col_id], errors='coerce')
                    if numeric_data.notna().any():
                        has_data = True
                        break
            if has_data:
                valid_groups.append(g["id"])
    else:
        for col in columns:
            if col in df.columns and col != "rowTitle":
                numeric_data = pd.to_numeric(df[col], errors='coerce')
                if numeric_data.notna().any():
                    valid_groups.append(col)

    n_groups = len(valid_groups)
    
    descriptives = {"n_groups": n_groups}
    assumptions = {"variance": {"passed": True}}
    
    # Recommendation logic
    recommendation = {"testId": "None", "reason": "Not enough data"}
    
    if table_type == "Column":
        if n_groups == 1:
            recommendation = {"testId": "One-sample t-test", "reason": "Single group."}
        elif n_groups == 2:
            recommendation = {"testId": "Unpaired t-test", "reason": "Comparing two groups."}
        elif n_groups > 2:
            recommendation = {"testId": "Ordinary one-way ANOVA", "reason": "Comparing multiple groups."}
            
    elif table_type == "Nested":
        if n_groups == 2:
            recommendation = {"testId": "Nested t-test", "reason": "Comparing two nested groups."}
        elif n_groups > 2:
            recommendation = {"testId": "Nested one-way ANOVA", "reason": "Comparing multiple nested groups."}

    elif table_type == "Survival":
        recommendation = {"testId": "Survival Curve Analysis", "reason": "Survival data format."}
        
    elif table_type == "XY":
        recommendation = {"testId": "Simple linear regression", "reason": "Default for XY data."}
        
    elif table_type == "Grouped":
        recommendation = {"testId": "Two-way ANOVA", "reason": "Default for grouped data."}

    return {
        "descriptives": descriptives,
        "assumptions": assumptions,
        "recommendation": recommendation
    }
\"\"\"

if "def analyze_sheet():" not in content:
    content += analyze_sheet_fn

with open('apps/web/src/stats/analysis_engine.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("analysis_engine patched.")
