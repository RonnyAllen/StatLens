lines = open('apps/web/src/stats/analysis_engine.py').read().split('\n')
for i, l in enumerate(lines):
    if "elif test_id == \"McNemar's Test\":" in l:
        for j in range(i, i+30): print(f'{j}: {lines[j]}')
        print("===")
    if 'elif test_id == "Binomial test":' in l:
        for j in range(i, i+30): print(f'{j}: {lines[j]}')
        print("===")
