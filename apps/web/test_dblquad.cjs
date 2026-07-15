const { loadPyodide } = require('pyodide');

async function main() {
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'scipy']);
    
    let result = await pyodide.runPythonAsync(`
import scipy.integrate as integrate
import scipy.stats as stats
import numpy as np
import time

def exact_tukey_pvalue(q, k, df):
    if df < 1: return 1.0
    
    def inner_integral(s, z):
        phi_z = stats.norm.pdf(z)
        Phi_z_qs = stats.norm.cdf(z + q * s)
        Phi_z = stats.norm.cdf(z)
        return k * phi_z * (Phi_z_qs - Phi_z)**(k - 1)
        
    def integrand(z, s):
        # scipy.integrate.dblquad signature: func(y, x) -> integrand(z, s) where z is inner variable, s is outer
        term1 = (df**(df/2)) / (math.gamma(df/2) * (2**(df/2 - 1)))
        term2 = (s**(df - 1)) * np.exp(-df * (s**2) / 2)
        return term1 * term2 * inner_integral(s, z)

    import math
    try:
        # Integrate s from 0 to inf, z from -inf to inf
        # dblquad(func, a, b, gfun, hfun)
        # s is outer (a, b) = (0, inf)
        # z is inner (gfun, hfun) = (-inf, inf)
        res, _ = integrate.dblquad(integrand, 0, np.inf, lambda s: -np.inf, lambda s: np.inf, epsabs=1e-3, epsrel=1e-3)
        return 1.0 - res
    except Exception as e:
        print(e)
        return 1.0

# test with q for WLC vs WC
# Let's see what q is natively!
# t_pval = 0.2367.
# wait, q = t_stat * sqrt(2) for equal n!
# Let's just find what the actual scipy.stats.tukey_hsd returns for q!
from scipy.stats import tukey_hsd
data = {
    "WLC": [0.111305, 0.114906, 0.108594, 0.106815, 0.088876, 0.092184, 0.095942, 0.103672, 0.093813, 0.109848, 0.114115, 0.096361],
    "WC": [0.100692, 0.102351, 0.112021, 0.101136, 0.094798, 0.094697, 0.109431, 0.100838, 0.092870, 0.083999, 0.103854, 0.087853],
    "YD": [0.048876, 0.055598, 0.062696, 0.057132, 0.044644, 0.048247, 0.051628, 0.059142, 0.030633, 0.060041, 0.040363, 0.083806]
}
wlc = np.array(data["WLC"])
wc = np.array(data["WC"])
yd = np.array(data["YD"])

# MSE computation
groups = [wlc, wc, yd]
k = len(groups)
N = sum(len(g) for g in groups)
df_error = N - k

grand_mean = np.concatenate(groups).mean()
ss_error = sum(np.sum((g - g.mean())**2) for g in groups)
ms_error = ss_error / df_error

mean_diff = np.abs(wlc.mean() - wc.mean())
se = np.sqrt(ms_error / len(wlc)) # equal n=12
q = mean_diff / se

t0 = time.time()
pval = exact_tukey_pvalue(q, k, df_error)
t1 = time.time()
print(f"q={q}, k={k}, df={df_error}")
print(f"exact_tukey_pvalue = {pval} (took {t1-t0}s)")

# Let's compare to scipy
res = tukey_hsd(wlc, wc, yd)
print(f"scipy tukey_hsd = {res.pvalue[0,1]}")
    `);
}

main();
