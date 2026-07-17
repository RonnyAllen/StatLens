import pandas as pd
from lifelines import KaplanMeierFitter
from lifelines.utils import median_survival_times

T = [5, 5, 5, 8, 8, 8, 10, 10, 12, 12]
E = [1, 1, 1, 1, 1, 1, 0, 1, 1, 1]

kmf = KaplanMeierFitter()
kmf.fit(T, event_observed=E, label="GroupA")
print(kmf.confidence_interval_)
median_ci = median_survival_times(kmf.confidence_interval_)
print(median_ci)
