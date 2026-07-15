import numpy as np
from scipy import stats
import pandas as pd
import json

data = {
    'Subgroup': ['Sub1', 'Sub1', 'Sub1', 'Sub2', 'Sub2', 'Sub2', 'Sub3', 'Sub3', 'Sub3', 'Sub4', 'Sub4', 'Sub4'],
    'Treatment': ['A', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'B', 'B'],
    'Value': [10, 12, 11, 14, 15, 13, 20, 22, 21, 25, 26, 24]
}
df_long = pd.DataFrame(data)

grand_mean = df_long['Value'].mean()
treat_stats = df_long.groupby('Treatment')['Value'].agg(['count', 'mean'])
sub_stats = df_long.groupby(['Treatment', 'Subgroup'])['Value'].agg(['count', 'mean'])

a = len(treat_stats)
ss_a = 0
df_a = a - 1
for trt in treat_stats.index:
    n_i = treat_stats.loc[trt, 'count']
    mean_i = treat_stats.loc[trt, 'mean']
    ss_a += n_i * (mean_i - grand_mean)**2
    
ss_b = 0
df_b = 0
for trt in treat_stats.index:
    if trt in sub_stats.index.get_level_values(0):
        trt_subs = sub_stats.loc[trt]
        b_i = len(trt_subs)
        df_b += (b_i - 1)
        mean_i = treat_stats.loc[trt, 'mean']
        for sub in trt_subs.index:
            n_ij = trt_subs.loc[sub, 'count']
            mean_ij = trt_subs.loc[sub, 'mean']
            ss_b += n_ij * (mean_ij - mean_i)**2
            
ss_e = 0
df_e = 0
for (trt, sub), group in df_long.groupby(['Treatment', 'Subgroup']):
    n_ij = len(group)
    df_e += (n_ij - 1)
    mean_ij = group['Value'].mean()
    ss_e += ((group['Value'] - mean_ij)**2).sum()
    
ms_a = ss_a / df_a if df_a > 0 else np.nan
ms_b = ss_b / df_b if df_b > 0 else np.nan

treats = list(treat_stats.index)
for i in range(len(treats)):
    for j in range(i+1, len(treats)):
        g1 = treats[i]
        g2 = treats[j]
        mean_1 = treat_stats.loc[g1, 'mean']
        mean_2 = treat_stats.loc[g2, 'mean']
        n_1 = treat_stats.loc[g1, 'count']
        n_2 = treat_stats.loc[g2, 'count']
        
        mean_diff = mean_2 - mean_1
        se = np.sqrt((ms_b / 2) * (1/n_1 + 1/n_2))
        q = np.abs(mean_diff) / se if se > 0 else 0
        p_adj = stats.studentized_range.sf(q, len(treats), df_b) if se > 0 else 1.0
        print(f"q={q:.3f}, p_adj={p_adj:.4f}")

