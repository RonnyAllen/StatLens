lines = open('apps/web/src/stats/analysis_engine.py').read().split('\n')
for i, l in enumerate(lines):
    if 'elif table_type == "Survival":' in l:
        for j in range(max(0, i-5), min(len(lines), i+2)):
            print(f'{j}: {repr(lines[j])}')
