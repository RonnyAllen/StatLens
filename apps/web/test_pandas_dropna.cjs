const { loadPyodide } = require("pyodide");

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas"]);
  
  const code = `
import pandas as pd
import numpy as np
import json

raw_data = [
    {"col_0": 1, "col_1": 2, "col_2": 3},
    {"col_0": 4, "col_1": 5, "col_2": 6},
    {"col_0": 7, "col_1": 8, "col_2": 9}
]

# Simulate user deleting col_2
for row in raw_data:
    row["col_2"] = ""

df = pd.DataFrame(raw_data)
df.replace("", np.nan, inplace=True)
for col in df.columns:
    df[col] = pd.to_numeric(df[col], errors='coerce')
    
df = df.dropna(axis=1, how='all')
columns = df.columns.tolist()

json.dumps(columns)
  `;
  
  try {
    const res = await pyodide.runPythonAsync(code);
    console.log("Result:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
