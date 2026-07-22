lines = open('apps/web/src/stats/analysis_engine.py').read().split('\n')
for i in range(len(lines)):
    if 'elif test_id == "Log-rank Trend Test":' in lines[i]:
        # we found it, it's at index i
        # it has 31 lines
        for j in range(i, min(i+31, len(lines))):
            if lines[j].startswith('    '):
                lines[j] = lines[j][4:]
        break

open('apps/web/src/stats/analysis_engine.py', 'w').write('\n'.join(lines))
print('Dedented')
