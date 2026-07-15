const { loadPyodide } = require("pyodide");

async function main() {
    console.log("Loading Pyodide...");
    const pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/"
    });
    console.log("Loading packages...");
    await pyodide.loadPackage(["scipy", "numpy"]);
    console.log("Running probe...");
    
    const pyCode = `
from scipy.stats import studentized_range, tukey_hsd
import numpy as np

print("studentized_range.sf(4.0, 3, 8) =", float(studentized_range.sf(4.0, 3, 8)))

th = tukey_hsd([1.2,1.4,2.1],[0.8,1.1,1.7,1.9,2.0],[3.1,3.2,3.3])
print("tukey p G1vG2, G1vG3, G2vG3 =", th.pvalue[0,1], th.pvalue[0,2], th.pvalue[1,2])
    `;
    
    await pyodide.runPythonAsync(pyCode);
    console.log("Done.");
}

main().catch(console.error);
