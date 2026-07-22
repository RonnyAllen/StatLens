lines = open('apps/web/src/stats/analysis_engine.py').read().split('\n')
for i, l in enumerate(lines):
    if 'elif test_id == "Diagnostic Test (Sensitivity/Specificity)":' in l:
        for j in range(i, i+110): print(f'{j}: {lines[j]}')
        print("===")
    if 'elif test_id == "Correlation Matrix":' in l:
        for j in range(i, i+30): print(f'{j}: {lines[j]}')
        print("===")
    if 'elif test_id == "Cox Regression":' in l: # In Survival block
        for j in range(i, i+50): print(f'{j}: {lines[j]}')
        print("===")
