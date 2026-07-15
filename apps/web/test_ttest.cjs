const { loadPyodide } = require('pyodide');

async function main() {
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'pandas', 'scipy']);
    
    let result = await pyodide.runPythonAsync(`
import json
import pandas as pd
import numpy as np
from scipy.stats import ttest_ind

data = {
    "WLC": [0.111305, 0.114906, 0.108594, 0.106815, 0.088876, 0.092184, 0.095942, 0.103672, 0.093813, 0.109848, 0.114115, 0.096361],
    "WC": [0.100692, 0.102351, 0.112021, 0.101136, 0.094798, 0.094697, 0.109431, 0.100838, 0.092870, 0.083999, 0.103854, 0.087853],
    "YD": [0.048876, 0.055598, 0.062696, 0.057132, 0.044644, 0.048247, 0.051628, 0.059142, 0.030633, 0.060041, 0.040363, 0.083806]
}
df = pd.DataFrame(data)

_, p1 = ttest_ind(df["WLC"], df["WC"])
_, p2 = ttest_ind(df["WLC"], df["YD"])
_, p3 = ttest_ind(df["WC"], df["YD"])

print(f"T-test WLC vs WC: {p1}")
print(f"T-test WLC vs YD: {p2}")
print(f"T-test WC vs YD: {p3}")
    `);
}

main();
