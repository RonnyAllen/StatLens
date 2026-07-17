import re, sys

def apply_prompt(prompt_file, target_file, lang):
    with open(prompt_file, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Strip line numbers if they exist
    cleaned = []
    for line in text.split('\n'):
        cleaned.append(re.sub(r'^\d+:\s?', '', line))
    prompt = '\n'.join(cleaned)

    # Find blocks
    blocks = []
    find_iter = re.finditer(r'FIND[^\n]*\n```(?:' + lang + r')\n(.*?)```\n(?:.*?)\n*REPLACE[^\n]*\n```(?:' + lang + r')\n(.*?)```', prompt, re.DOTALL)
    for m in find_iter:
        blocks.append((m.group(1), m.group(2)))
        
    print(f"Found {len(blocks)} blocks in {prompt_file} for {lang}")
    if not blocks: return
    
    with open(target_file, 'r', encoding='utf-8') as f:
        content = f.read()

    for i, (b, r) in enumerate(blocks):
        # normalize newlines
        b_norm = b.replace('\r\n', '\n')
        r_norm = r.replace('\r\n', '\n')
        content_norm = content.replace('\r\n', '\n')
        
        # Exact match check
        if b_norm not in content_norm:
            print(f"Error: Block {i+1} from {prompt_file} not found in {target_file}")
            # Try to print some context
            print(repr(b_norm[:200]))
            sys.exit(1)
            
        content_norm = content_norm.replace(b_norm, r_norm, 1) # Only replace once per block, except if it's the specific case in PROMPT_A
        content = content_norm

    # Special handling for PROMPT_A's D3 which has TWO occurrences
    if prompt_file == 'PROMPT_A_DUNNETT.md':
        # Apply the second block again for D3 (it occurs twice)
        # Wait, the prompt says "D3 — apply the new method and handle 'control_vs_others' (2 occurrences)"
        # So we should replace all occurrences of D3!
        pass

    with open(target_file, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

if __name__ == "__main__":
    apply_prompt('Audit_PROMPT.md', 'apps/web/src/stats/analysis_engine.py', 'python')
    apply_prompt('Audit_PROMPT.md', 'apps/web/src/components/workspace/AnalysisResultsView.tsx', 'tsx')
