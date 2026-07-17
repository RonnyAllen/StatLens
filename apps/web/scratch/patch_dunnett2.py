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
    find_iter = re.finditer(r'FIND(?:\s*\(.*?\))?:\s*`[^\n]*\n(.*?)`\s*REPLACE(?:\s*\(.*?\))?:\s*`[^\n]*\n(.*?)`', prompt, re.DOTALL)
    for m in find_iter:
        blocks.append((m.group(1), m.group(2)))
    return blocks

all_blocks = extract_blocks(prompt)
engine_blocks = all_blocks[:4]

with open('src/stats/analysis_engine.py', 'r', encoding='utf-8') as f:
    engine = f.read()

for i, (b, r) in enumerate(engine_blocks):
    b = b.rstrip('\r\n') + '\n'
    if b not in engine:
        print(f"D{i+1} missing. Expected block:")
        print(repr(b))
        print("Actual file excerpt:")
        idx = engine.find('def dunnetts_t3_pvalue') if i == 0 else engine.find('_use_pairwise')
        if idx != -1: print(repr(engine[idx:idx+200]))

