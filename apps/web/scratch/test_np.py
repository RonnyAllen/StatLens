import numpy as np

p = np.float64(0.05)
try:
    print(f"{p:.4f}")
except Exception as e:
    print("np.float64 format error:", e)

q = np.array([0.05])
try:
    print(f"{q:.4f}")
except Exception as e:
    print("np.array format error:", e)

from statsmodels.stats.libqsturng import psturng
print("psturng scalar:", type(psturng(1.5, 3, 10)))
print("psturng array:", type(psturng(np.array([1.5]), 3, 10)))
