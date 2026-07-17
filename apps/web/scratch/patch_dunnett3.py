import re, sys

with open('../../PROMPT_A_DUNNETT.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove line numbers from PROMPT_A_DUNNETT.md
cleaned = []
for line in text.split('\n'):
    cleaned.append(re.sub(r'^\d+:\s?', '', line))
prompt = '\n'.join(cleaned)

def extract_blocks(prompt):
    blocks = []
    find_iter = re.finditer(r'FIND(?:\s*\(.*?\))?:\n`[^\n]*\n(.*?)`\nREPLACE(?:\s*\(.*?\))?:\n`[^\n]*\n(.*?)`', prompt, re.DOTALL)
    for m in find_iter:
        blocks.append((m.group(1), m.group(2)))
    return blocks

all_blocks = extract_blocks(prompt)
engine_blocks = all_blocks[:4]
ui_blocks = all_blocks[4:]

# Strip trailing newlines from each block content
def clean_block(b):
    return b.rstrip('\r\n') + '\n'

with open('src/stats/analysis_engine.py', 'r', encoding='utf-8') as f:
    engine = f.read()

for i, (b, r) in enumerate(engine_blocks):
    cb = clean_block(b)
    cr = clean_block(r)
    
    if cb not in engine:
        print(f"D{i+1} missing. Expected:")
        print(repr(cb))
        sys.exit(1)
    
    count = 1 if i != 2 else 2
    engine = engine.replace(cb, cr, count)

with open('src/stats/analysis_engine.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(engine)
    print("Engine written")

with open('src/components/workspace/TestOptionsDialog.tsx', 'r', encoding='utf-8') as f:
    ui = f.read()

for idx, (b, r) in enumerate(ui_blocks):
    cb = clean_block(b).replace('\r\n', '\n')
    cr = clean_block(r).replace('\r\n', '\n')
    ui_norm = ui.replace('\r\n', '\n')
    
    if cb not in ui_norm:
        print(f"A-UI-{idx+1} missing:")
        print(repr(cb))
        sys.exit(1)
    
    ui_norm = ui_norm.replace(cb, cr, 1)
    ui = ui_norm.replace('\n', '\r\n')

with open('src/components/workspace/TestOptionsDialog.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(ui)
    print("UI written")
