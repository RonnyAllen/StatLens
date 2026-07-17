import re, sys

def apply_prompt(prompt_file, target_file, lang, override_counts=None, block_slice=None):
    if override_counts is None:
        override_counts = {}
        
    print(f"\n--- Applying {prompt_file} to {target_file} ---")
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
        
    if block_slice:
        blocks = blocks[block_slice[0]:block_slice[1]]
        
    print(f"Found {len(blocks)} blocks")
    if not blocks: return
    
    # Read target file, detect line endings
    with open(target_file, 'rb') as f:
        raw_content = f.read()
    
    is_crlf = b'\r\n' in raw_content
    content = raw_content.decode('utf-8').replace('\r\n', '\n')

    for i, (b, r) in enumerate(blocks):
        b_norm = b.replace('\r\n', '\n')
        r_norm = r.replace('\r\n', '\n')
        
        # Exact match check
        count_in_file = content.count(b_norm)
        if count_in_file == 0:
            print(f"Error: Block {i+1} from {prompt_file} not found in {target_file}")
            sys.exit(1)
            
        count_to_replace = override_counts.get(i, 1)
        
        content = content.replace(b_norm, r_norm, count_to_replace)
        print(f"Applied block {i+1} ({count_to_replace} replacements)")

    # Restore line endings if needed
    if is_crlf:
        content = content.replace('\n', '\r\n')
        
    with open(target_file, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    print(f"Successfully wrote {target_file}")

if __name__ == "__main__":
    # 1. Audit Fixes
    apply_prompt('Audit_PROMPT.md', 'apps/web/src/stats/analysis_engine.py', 'python', override_counts={
        2: 2 # FIX 3a has 2 occurrences
    })
    # We ignore the UI file for Audit since it doesn't need to be run? Wait, Audit_PROMPT has FIX 4-UI!
    apply_prompt('Audit_PROMPT.md', 'apps/web/src/components/workspace/AnalysisResultsView.tsx', 'tsx')
    
    # 2. Dunnett's
    apply_prompt('PROMPT_A_DUNNETT.md', 'apps/web/src/stats/analysis_engine.py', 'python', override_counts={
        2: 2 # D3 has 2 occurrences
    })
    apply_prompt('PROMPT_A_DUNNETT.md', 'apps/web/src/components/workspace/TestOptionsDialog.tsx', 'tsx')
    
    # 3. Engine Fixes (Task C)
    apply_prompt('PROMPT_C_ENGINE_FIXES.md', 'apps/web/src/stats/analysis_engine.py', 'python', block_slice=(0, 7))
    apply_prompt('PROMPT_C_ENGINE_FIXES.md', 'apps/web/scratch/verify_fixes.py', 'python', block_slice=(7, 8))
