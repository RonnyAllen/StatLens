import ast

with open('apps/web/src/stats/analysis_engine.py') as f:
    content = f.read()
    
# parse and find analyze_sheet
tree = ast.parse(content)
analyze_sheet = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'analyze_sheet')

# find the try-except block
try_block = next(n for n in analyze_sheet.body if isinstance(n, ast.Try))

# find the if-elif chain
if_chain = next(n for n in try_block.body if isinstance(n, ast.If))

def print_if_chain(node, depth=0):
    if isinstance(node, ast.If):
        # find the test_id comparison
        test_str = "<complex condition>"
        if isinstance(node.test, ast.Compare):
            if isinstance(node.test.left, ast.Name) and node.test.left.id == 'test_id':
                if isinstance(node.test.comparators[0], ast.Constant):
                    test_str = node.test.comparators[0].value
        print('  ' * depth + f'if test_id == "{test_str}":')
        
        # go to elif
        if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
            print_if_chain(node.orelse[0], depth)
        elif len(node.orelse) > 0:
            print('  ' * depth + 'else: (block with ' + str(len(node.orelse)) + ' stmts)')

print_if_chain(if_chain)
