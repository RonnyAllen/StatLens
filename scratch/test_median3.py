import pandas as pd
from lifelines import KaplanMeierFitter
import numpy as np

T = [1, 2, 4, 5]
E = [1, 1, 1, 1]

# S(0) = 1
# S(1) = 0.75
# S(2) = 0.5 (exactly 50%)
# S(4) = 0.25 (drops below 50%)
kmf = KaplanMeierFitter()
kmf.fit(T, event_observed=E)
print(f"Median from lifelines: {kmf.median_survival_time_}")
