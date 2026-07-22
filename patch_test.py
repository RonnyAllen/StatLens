import re

with open('apps/web/src/stats/__tests__/niche_stats.test.ts', 'r') as f:
    content = f.read()

content = content.replace("40.00%", "40.00000%")
content = content.replace("60.00%", "60.00000%")

with open('apps/web/src/stats/__tests__/niche_stats.test.ts', 'w') as f:
    f.write(content)
print("Patched niche_stats.test.ts")
