import pandas as pd
from lifelines import KaplanMeierFitter
import numpy as np

T = [1, 2, 3, 4, 5]
E = [1, 1, 0, 1, 1]

kmf = KaplanMeierFitter()
kmf.fit(T, event_observed=E)
print(kmf.median_survival_time_)
