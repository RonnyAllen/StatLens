const { loadPyodide } = require('pyodide');

async function main() {
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(['micropip']);
    await pyodide.runPythonAsync(`
        import micropip
        await micropip.install(['scipy', 'pandas', 'pingouin'])
    `);
    
    let result = await pyodide.runPythonAsync(`
import json
import pandas as pd
import numpy as np
from scipy.stats import tukey_hsd

data = {
    "WLC": [0.111305, 0.114906, 0.108594, 0.106815, 0.088876, 0.092184, 0.095942, 0.103672, 0.093813, 0.109848, 0.114115, 0.096361],
    "WC": [0.100692, 0.102351, 0.112021, 0.101136, 0.094798, 0.094697, 0.109431, 0.100838, 0.092870, 0.083999, 0.103854, 0.087853],
    "YD": [0.048876, 0.055598, 0.062696, 0.057132, 0.044644, 0.048247, 0.051628, 0.059142, 0.030633, 0.060041, 0.040363, 0.083806]
}
df = pd.DataFrame(data)
group_names = ["WLC", "WC", "YD"]
arrays = [df[g].dropna().values for g in group_names]
res_tukey = tukey_hsd(*arrays)

ph_results = []
for i in range(len(group_names)):
    for j in range(i+1, len(group_names)):
        g1 = group_names[i]
        g2 = group_names[j]
        
        p_val = res_tukey.pvalue[i, j]
        mean_diff = res_tukey.statistic[i, j]
        
        if mean_diff < 0:
            mean_diff = -mean_diff
            g1, g2 = g2, g1

        ph_results.append({
            "group1": g1,
            "group2": g2,
            "mean_diff": float(mean_diff),
            "p_value": float(p_val),
            "significant": bool(p_val < 0.05)
        })

json.dumps(ph_results)
    `);
    console.log(result);
}

main();
