import re

with open('apps/web/src/stats/pyodide.worker2.ts', 'r', encoding='utf-8') as f:
    content = f.read()

run_engine_old = \"\"\"      pyodide.globals.set("sheet_data", pyodide.toPy(payload.sheet))
      pyodide.globals.set("options", pyodide.toPy(payload.options))
      pyodide.globals.set("post_progress", (p: number, m: string) => self.postMessage({ id, type: "progress", progress: p, message: m }))
      
      const result = await pyodide.runPythonAsync("run()")
      
      let finalResult = result
      if (result && typeof result.toJs === 'function') {
        finalResult = result.toJs({ dict_converter: Object.fromEntries })
        result.destroy()
      }
      
      self.postMessage({ id, type: "SUCCESS", result: finalResult })\"\"\"

run_engine_new = \"\"\"      const sheetPy = pyodide.toPy(payload.sheet)
      const optionsPy = pyodide.toPy(payload.options)
      pyodide.globals.set("sheet_data", sheetPy)
      pyodide.globals.set("options", optionsPy)
      pyodide.globals.set("post_progress", (p: number, m: string) => self.postMessage({ id, type: "progress", progress: p, message: m }))
      
      const result = await pyodide.runPythonAsync("run()")
      
      let finalResult = result
      if (result && typeof result.toJs === 'function') {
        finalResult = result.toJs({ dict_converter: Object.fromEntries })
        result.destroy()
      }
      
      if (sheetPy && typeof sheetPy.destroy === 'function') sheetPy.destroy()
      if (optionsPy && typeof optionsPy.destroy === 'function') optionsPy.destroy()
      
      self.postMessage({ id, type: "SUCCESS", result: finalResult })\"\"\"

content = content.replace(run_engine_old, run_engine_new)

run_stats_old = \"\"\"      let pyGlobals = pyodide.globals.get("dict")()
      if (globals) {
         for (const [key, value] of Object.entries(globals)) {
             pyGlobals.set(key, pyodide.toPy(value))
         }
      }\"\"\"

run_stats_new = \"\"\"      let pyGlobals = pyodide.globals.get("dict")()
      const pyRefs: any[] = []
      if (globals) {
         for (const [key, value] of Object.entries(globals)) {
             const valPy = pyodide.toPy(value)
             pyGlobals.set(key, valPy)
             pyRefs.push(valPy)
         }
      }\"\"\"

run_stats_old_end = \"\"\"      pyGlobals.destroy()

      self.postMessage({ id, type: "SUCCESS", result: finalResult })\"\"\"

run_stats_new_end = \"\"\"      pyGlobals.destroy()
      pyRefs.forEach(ref => {
        if (ref && typeof ref.destroy === 'function') ref.destroy()
      })

      self.postMessage({ id, type: "SUCCESS", result: finalResult })\"\"\"

content = content.replace(run_stats_old, run_stats_new)
content = content.replace(run_stats_old_end, run_stats_new_end)

with open('apps/web/src/stats/pyodide.worker2.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Worker leak patched.")
