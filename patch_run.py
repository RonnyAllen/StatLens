import re

with open('apps/web/src/components/workspace/TestOptionsDialog.tsx', 'r') as f:
    content = f.read()

target = """        lowessFrac,
        anovaCorrection: sphericityCorrection
      },"""

replacement = """        lowessFrac,
        anovaCorrection: sphericityCorrection,
        fotDivideBy,
        fotDisplayAs,
        fotCalculateCI,
        fotCILevel,
        fotCIMethod,
        chiExpectedType,
        chiSelectedColumn,
        chiExpectedValues
      },"""

if target in content:
    content = content.replace(target, replacement)
    with open('apps/web/src/components/workspace/TestOptionsDialog.tsx', 'w') as f:
        f.write(content)
    print("Patched handleRun")
else:
    print("Could not find target in handleRun")
