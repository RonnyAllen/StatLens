import pandas as pd
import pingouin as pg
import numpy as np

# Sample data mimicking the user's data
data = {
    "WLC": [0.111305, 0.114906, 0.108594, 0.106815, 0.088876, 0.092184, 0.095942, 0.103672, 0.093813, 0.109848, 0.114115, 0.096361],
    "WC": [0.100692, 0.102351, 0.112021, 0.101136, 0.094798, 0.094697, 0.109431, 0.100838, 0.092870, 0.083999, 0.103854, 0.087853],
    "YD": [0.048876, 0.055598, 0.062696, 0.057132, 0.044644, 0.048247, 0.051628, 0.059142, 0.030633, 0.060041, 0.040363, 0.083806]
}

df = pd.DataFrame(data)
df_melt = df.melt(value_vars=["WLC", "WC", "YD"]).dropna()

res_anova = pg.anova(data=df_melt, dv='value', between='variable')
print("ANOVA:")
print(res_anova)

res_tukey = pg.pairwise_tukey(data=df_melt, dv='value', between='variable')
print("\nTukey:")
print(res_tukey)

import scikit_posthocs as sp
res_bonf = sp.posthoc_ttest(df_melt, val_col='value', group_col='variable', p_adjust='bonferroni')
print("\nBonferroni:")
print(res_bonf)
