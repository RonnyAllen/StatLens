import pandas as pd
import pingouin as pg
import numpy as np

# Sample data
data_dict = {
    "group-1": [4238.517, 4230.901, 4080.602, 4055.436, 3926.463, 4078.914, 4025.076, 4037.711, 4162.198, 4077.285, 4168.416, 3965.240],
    "group-2": [4079.657, 4197.285, 4141.822, 4044.511, 3883.325, 3964.139, 4145.166, 3826.038, 4022.778, 3963.286, 3998.189, 3946.837],
    "group-3": [3582.369, 3104.372, 3607.818, 3557.960, 3560.669, 3299.599, 3465.986, 3523.546, 3274.914, 3509.063, 3289.720, 3536.337]
}

df = pd.DataFrame(data_dict)
group_names = ["group-1", "group-2", "group-3"]

melted = df.melt(value_vars=group_names).dropna()

try:
    res = pg.anova(data=melted, dv='value', between='variable')
    print("ANOVA Result:")
    print(res)
    print("Columns:", res.columns.tolist())
except Exception as e:
    print("Error:", e)
