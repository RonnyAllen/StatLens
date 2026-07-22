import re

with open('apps/web/src/components/workspace/AnalysisResultsView.tsx', 'r') as f:
    content = f.read()

content = content.replace("toFixed(4)", "toFixed(5)")
content = content.replace("toExponential(4)", "toExponential(5)")

with open('apps/web/src/components/workspace/AnalysisResultsView.tsx', 'w') as f:
    f.write(content)
print("Patched AnalysisResultsView.tsx")
