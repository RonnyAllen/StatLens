import pandas as pd
from lifelines import KaplanMeierFitter
import numpy as np

T = [1, 2, 3, 4]
E = [1, 0, 1, 1]

# S(t): t=0 (1), t=1 (3/4 = 0.75), t=2 (0.75), t=3 (0.75 * 1/2 = 0.375) -> median is 3.
# Wait, let's make it exactly 0.5
T = [1, 2, 3, 4]
E = [1, 1, 1, 1]
# t=0: 1
# t=1: 0.75
# t=2: 0.5
# t=3: 0.25
kmf = KaplanMeierFitter()
kmf.fit(T, event_observed=E)
print(f"Median from lifelines: {kmf.median_survival_time_}")
