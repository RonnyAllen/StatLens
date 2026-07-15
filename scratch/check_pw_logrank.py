import pandas as pd
from lifelines.statistics import pairwise_logrank_test

df = pd.DataFrame({
    'T': [5, 6, 6, 2.5, 4, 4, 1, 2, 3],
    'E': [1, 0, 1, 1, 1, 0, 1, 1, 1],
    'Group': ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C']
})

pw = pairwise_logrank_test(df['T'], df['Group'], df['E'])
print(pw.summary)
