import re
content = open('apps/web/src/stats/analysis_engine.py').read()
start_idx = content.find('def analyze_sheet')
for match in re.finditer(r'(?:el)?if table_type == [\'"]([^\'"]+)[\'"]:', content[start_idx:]):
    print(f'{start_idx + match.start()}: {match.group(0)}')
