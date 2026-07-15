const { loadPyodide } = require('pyodide');

async function main() {
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(['pandas', 'micropip']);
    await pyodide.runPythonAsync(`
import pandas as pd
print(pd.__version__)
    `);
}

main();
