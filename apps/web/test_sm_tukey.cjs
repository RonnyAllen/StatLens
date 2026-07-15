const { loadPyodide } = require('pyodide');

async function main() {
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'pandas', 'scipy', 'statsmodels']);
    
    let result = await pyodide.runPythonAsync(`
import json
import pandas as pd
import numpy as np
from statsmodels.stats.multicomp import pairwise_tukeyhsd

data = {
    "WLC": [0.111305, 0.114906, 0.108594, 0.106815, 0.088876, 0.092184, 0.095942, 0.103672, 0.093813, 0.109848, 0.114115, 0.096361],
    "WC": [0.100692, 0.102351, 0.112021, 0.101136, 0.094798, 0.094697, 0.109431, 0.100838, 0.092870, 0.083999, 0.103854, 0.087853],
    "YD": [0.048876, 0.055598, 0.062696, 0.057132, 0.044644, 0.048247, 0.051628, 0.059142, 0.030633, 0.060041, 0.040363, 0.083806]
}
df = pd.DataFrame(data)
group_names = ["WLC", "WC", "YD"]
df_melt = df.melt(value_vars=group_names).dropna()

res = pairwise_tukeyhsd(endog=df_melt['value'], groups=df_melt['variable'], alpha=0.05)
print(res.summary())
print(res.pvalues)
    `);
}

main();
