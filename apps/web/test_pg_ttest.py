import pingouin as pg
import pandas as pd
import numpy as np

res_t = pg.ttest([1, 2, 3], [4, 5, 6])
print("T-test cols:", res_t.columns.tolist())

res_mwu = pg.mwu([1, 2, 3], [4, 5, 6])
print("MWU cols:", res_mwu.columns.tolist())

res_kw = pg.kruskal(data=pd.DataFrame({"val": [1,2,3,4,5,6], "grp": [1,1,1,2,2,2]}), dv="val", between="grp")
print("KW cols:", res_kw.columns.tolist())
