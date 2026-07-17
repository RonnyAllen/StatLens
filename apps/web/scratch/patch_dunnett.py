import re, sys

with open('../../PROMPT_A_DUNNETT.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove line numbers from PROMPT_A_DUNNETT.md
cleaned = []
for line in text.split('\n'):
    if re.match(r'^\d+:\s?', line):
        cleaned.append(line.split(':', 1)[1][1:])
    else:
        cleaned.append(line)
prompt = '\n'.join(cleaned)

def extract_blocks(prompt):
    blocks = []
    # Find all FIND / REPLACE pairs
    find_iter = re.finditer(r'FIND(?:\s*\(.*?\))?:\s*`[^\n]*\n(.*?)`\s*REPLACE(?:\s*\(.*?\))?:\s*`[^\n]*\n(.*?)`', prompt, re.DOTALL)
    for m in find_iter:
        blocks.append((m.group(1), m.group(2)))
    return blocks

all_blocks = extract_blocks(prompt)
engine_blocks = all_blocks[:4] # D1, D2, D3(x2), D4
ui_blocks = all_blocks[4:]

# Strip trailing newlines from each block content because of the markdown backticks
def clean_block(b):
    return b.rstrip('\r\n') + '\n'

with open('src/stats/analysis_engine.py', 'r', encoding='utf-8') as f:
    engine = f.read()

# Apply D1
b0 = clean_block(engine_blocks[0][0])
r0 = clean_block(engine_blocks[0][1])
if b0 not in engine: print("D1 missing"); sys.exit(1)
engine = engine.replace(b0, r0, 1)

# Apply D2
b1 = clean_block(engine_blocks[1][0])
r1 = clean_block(engine_blocks[1][1])
if b1 not in engine: print("D2 missing"); sys.exit(1)
engine = engine.replace(b1, r1, 1)

# Apply D3
b2 = clean_block(engine_blocks[2][0])
r2 = clean_block(engine_blocks[2][1])
if b2 not in engine: print("D3 missing"); sys.exit(1)
engine = engine.replace(b2, r2, 2)

# Apply D4
b3 = clean_block(engine_blocks[3][0])
r3 = clean_block(engine_blocks[3][1])
if b3 not in engine: print("D4 missing"); sys.exit(1)
engine = engine.replace(b3, r3, 1)

with open('src/stats/analysis_engine.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(engine)
    print("Engine written")

with open('src/components/workspace/TestOptionsDialog.tsx', 'r', encoding='utf-8') as f:
    ui = f.read()

for idx, b in enumerate(ui_blocks):
    # Need to handle CRLF in ui file. The blocks from prompt might be LF.
    find_str = clean_block(b[0]).replace('\r\n', '\n')
    ui_norm = ui.replace('\r\n', '\n')
    
    # Let's check for trailing newlines causing issues
    if find_str not in ui_norm:
        find_str = find_str.strip()
        if find_str not in ui_norm:
            print(f"COULD NOT FIND UI BLOCK {idx}:", find_str[:100])
            sys.exit(1)
        else:
            # We found it stripped, so we can replace
            replace_str = clean_block(b[1]).replace('\r\n', '\n').strip()
            ui_norm = ui_norm.replace(find_str, replace_str, 1)
    else:
        replace_str = clean_block(b[1]).replace('\r\n', '\n')
        ui_norm = ui_norm.replace(find_str, replace_str, 1)
        
    # Restore CRLF
    ui = ui_norm.replace('\n', '\r\n')

with open('src/components/workspace/TestOptionsDialog.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(ui)
    print("UI written")

