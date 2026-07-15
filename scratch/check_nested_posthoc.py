import numpy as np
from scipy import stats
import pandas as pd
import json

# simulated nested data
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
ms_e = ss_e / df_e if df_e > 0 else np.nan

f_a = ms_a / ms_b if ms_b > 0 else np.nan
p_a = stats.f.sf(f_a, df_a, df_b)

print(f"Treatment F: {f_a}, p: {p_a}")
print(f"MS_b (Error for Treatment): {ms_b}")

# Now post-hoc between A and B using ms_b
mean_A = treat_stats.loc['A', 'mean']
mean_B = treat_stats.loc['B', 'mean']
n_A = treat_stats.loc['A', 'count']
n_B = treat_stats.loc['B', 'count']

se = np.sqrt(ms_b * (1/n_A + 1/n_B))
t_stat = (mean_B - mean_A) / se
p_val = 2 * stats.t.sf(np.abs(t_stat), df_b)
print(f"Pairwise A vs B -> t: {t_stat}, p: {p_val}")
