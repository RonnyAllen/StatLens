import pandas as pd
import numpy as np
from lifelines import KaplanMeierFitter

def prism_median_survival(kmf):
    survival = kmf.survival_function_
    times = survival.index.values
    probs = survival.iloc[:, 0].values
    
    if not np.any(probs <= 0.5):
        return np.inf
    
    idx_first_below_or_equal = np.argmax(probs <= 0.5)
    
    if probs[idx_first_below_or_equal] < 0.5:
        return times[idx_first_below_or_equal]
    else:
        # exactly 0.5
        idx_below = -1
        for i in range(idx_first_below_or_equal + 1, len(probs)):
            if probs[i] < 0.5:
                idx_below = i
                break
        if idx_below != -1:
            return (times[idx_first_below_or_equal] + times[idx_below]) / 2.0
        else:
            return np.inf

T = [1, 2, 4, 5]
E = [1, 1, 1, 1]

kmf = KaplanMeierFitter()
kmf.fit(T, event_observed=E)

print(f"Lifelines: {kmf.median_survival_time_}")
print(f"Prism: {prism_median_survival(kmf)}")
