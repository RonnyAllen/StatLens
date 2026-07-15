const { loadPyodide } = require('pyodide');

async function main() {
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'scipy']);
    
    let result = await pyodide.runPythonAsync(`
import scipy.integrate as integrate
import scipy.stats as stats
import numpy as np
import time

def approx_tukey_pvalue(q, k):
    # infinite df approximation (1D integral)
    def integrand(z):
        return k * stats.norm.pdf(z) * (stats.norm.cdf(z + q) - stats.norm.cdf(z))**(k - 1)
        
    res, _ = integrate.quad(integrand, -10, 10, epsabs=1e-4, epsrel=1e-4)
    return 1.0 - res

t0 = time.time()
pval = approx_tukey_pvalue(1.4362352146062574, 3)
t1 = time.time()
print(f"approx_tukey_pvalue = {pval} (took {t1-t0}s)")

    `);
}

main();
