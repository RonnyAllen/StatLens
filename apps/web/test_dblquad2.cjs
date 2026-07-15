const { loadPyodide } = require('pyodide');

async function main() {
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'scipy']);
    
    let result = await pyodide.runPythonAsync(`
import scipy.integrate as integrate
import scipy.stats as stats
import numpy as np
import time
import math

def exact_tukey_pvalue(q, k, df):
    if df < 1: return 1.0
    if q > 15: return 0.0
    if q < 0: return 1.0
    
    # Try 1D approximation first for speed, if df is huge
    if df > 100:
        def integrand1d(z):
            return k * stats.norm.pdf(z) * (stats.norm.cdf(z + q) - stats.norm.cdf(z))**(k - 1)
        res, _ = integrate.quad(integrand1d, -10, 10, epsabs=1e-3, epsrel=1e-3)
        return max(0.0, min(1.0, 1.0 - res))

    def inner_integral(s, z):
        return k * stats.norm.pdf(z) * (stats.norm.cdf(z + q * s) - stats.norm.cdf(z))**(k - 1)
        
    def integrand(z, s):
        term1 = (df**(df/2)) / (math.gamma(df/2) * (2**(df/2 - 1)))
        term2 = (s**(df - 1)) * np.exp(-df * (s**2) / 2)
        return term1 * term2 * inner_integral(s, z)

    try:
        # Lower precision for faster computation: epsabs=1e-2, epsrel=1e-2
        res, _ = integrate.dblquad(integrand, 0, np.inf, lambda s: -10, lambda s: 10, epsabs=1e-2, epsrel=1e-2)
        return max(0.0, min(1.0, 1.0 - res))
    except Exception as e:
        print(e)
        return 1.0

t0 = time.time()
pval = exact_tukey_pvalue(1.4362352146062574, 3, 33)
t1 = time.time()
print(f"exact_tukey_pvalue = {pval} (took {t1-t0}s)")
    `);
}

main();
