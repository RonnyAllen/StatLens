const { loadPyodide } = require("pyodide");

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "scipy"]);
  
  const code = `
import pandas as pd
from scipy import stats
import json

df = pd.DataFrame({
    "A": [1, 1, 1, 1, 1, 1],
    "B": [2, 2, 2, 2, 2, 2]
})

groups = [df["A"].dropna(), df["B"].dropna()]
stat, p = stats.levene(*groups)

result = {
    "stat": float(stat),
    "p": float(p)
}
json.dumps(result)
  `;
  
  try {
    const res = await pyodide.runPythonAsync(code);
    console.log("Result:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
