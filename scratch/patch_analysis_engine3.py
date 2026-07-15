import re

with open('apps/web/src/stats/analysis_engine.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = \"\"\"                    for idx, row in df.iterrows():
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

new_code = \"\"\"                    for idx, row in df.iterrows():
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
                                    pass\"\"\"

content = content.replace(old_code, new_code)

with open('apps/web/src/stats/analysis_engine.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
