import re

with open('Audit_PROMPT.md', 'r', encoding='utf-8') as f:
    audit_text = f.read()

finds = []
replaces = []

for match in re.finditer(r'FIND[^\n]*\n`(?:python|tsx)\n(.*?)\n`', audit_text, re.DOTALL):
    finds.append(match.group(1))
    
for match in re.finditer(r'REPLACE[^\n]*\n`(?:python|tsx)\n(.*?)\n`', audit_text, re.DOTALL):
    replaces.append(match.group(1))

print(f"Found {len(finds)} FIND blocks and {len(replaces)} REPLACE blocks.")

engine_path = 'apps/web/src/stats/analysis_engine.py'
with open(engine_path, 'r', encoding='utf-8') as f:
    engine_code = f.read()

view_path = 'apps/web/src/components/workspace/AnalysisResultsView.tsx'
with open(view_path, 'r', encoding='utf-8') as f:
    view_code = f.read()

for i, (find_text, replace_text) in enumerate(zip(finds, replaces)):
    print(f"Applying block {i+1}...")
    
    count_engine = engine_code.count(find_text)
    count_view = view_code.count(find_text)
    
    if count_engine > 0:
        engine_code = engine_code.replace(find_text, replace_text)
        print(f"  -> Replaced {count_engine} occurrences in analysis_engine.py")
    elif count_view > 0:
        view_code = view_code.replace(find_text, replace_text)
        print(f"  -> Replaced {count_view} occurrences in AnalysisResultsView.tsx")
    else:
        print(f"  -> ERROR: Block {i+1} not found in either file!")
        print("FIND TEXT:")
        print(repr(find_text))
        
with open(engine_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(engine_code)

with open(view_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(view_code)

print("Done applying fixes.")
