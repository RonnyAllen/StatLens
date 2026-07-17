import { loadPyodide } from "pyodide"
import engineSource from "./analysis_engine.py?raw"

let pyodide: any = null

self.onmessage = async (event) => {
  const { id, type, payload } = event.data

  if (type === "INIT") {
    try {
      self.postMessage({ id, type: "progress", progress: 10, message: "Loading Pyodide runtime..." })
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/",
      })
      
      self.postMessage({ id, type: "progress", progress: 40, message: "Loading core mathematics (NumPy, SciPy)..." })
      await pyodide.loadPackage(["numpy", "pandas", "scipy", "scikit-learn", "statsmodels", "micropip"])
      
      // Install optional packages (best-effort — the engine's imports are defensive,
      // so a failed optional install can't break the whole engine load).
      // Install optional packages
      try {
        self.postMessage({ id, type: "progress", progress: 70, message: "Loading advanced statistics (Pingouin, Lifelines)..." })
        await pyodide.runPythonAsync(`
          import micropip
          await micropip.install(["pingouin==0.5.4", "scikit-posthocs==0.9.0", "lifelines==0.29.0"])
        `)
      } catch (e: any) {
        console.warn("[StatLens] optional package install failed (continuing):", e?.message || e)
      }

      // Pre-compile the engine once. If this fails, surface the REAL error instead of
      // letting it show up later as a misleading "analyze_sheet is not defined".
      // Pre-compile the engine once
      const engineDef = engineSource.replace(/\n\s*run\(\)\s*$/, "\n");
      try {
        self.postMessage({ id, type: "progress", progress: 95, message: "Initializing analysis engine..." })
        await pyodide.runPythonAsync(engineDef);
      } catch (e: any) {
        console.error("[StatLens] ENGINE FAILED TO LOAD — this is the real error:", e)
        self.postMessage({ id, type: "ERROR", error: "Engine failed to load: " + (e?.message || String(e)) })
        return
      }

      self.postMessage({ id, type: "INIT_SUCCESS" })
    } catch (error: any) {
      console.error("Pyodide init error inside worker:", error)
      self.postMessage({ id, type: "ERROR", error: error?.message || String(error) })
    }
    return
  }

  if (type === "RUN_ENGINE") {
    if (!pyodide) {
      self.postMessage({ id, type: "ERROR", error: "Pyodide not initialized" })
      return
    }

    try {
      const entrypoint = (payload.entrypoint || "run").replace(/[^a-zA-Z0-9_]/g, "");
      const sheetPy = pyodide.toPy(payload.sheet)
      const optionsPy = pyodide.toPy(payload.options || {})
      pyodide.globals.set("sheet_data", sheetPy)
      pyodide.globals.set("options", optionsPy)
      pyodide.globals.set("post_progress", (p: number, m: string) => self.postMessage({ id, type: "progress", progress: p, message: m }))
      
      const result = await pyodide.runPythonAsync(`${entrypoint}()`)
      
      let finalResult = result
      if (result && typeof result.toJs === 'function') {
        finalResult = result.toJs({ dict_converter: Object.fromEntries })
        result.destroy()
      }
      
      if (sheetPy && typeof sheetPy.destroy === 'function') sheetPy.destroy()
      if (optionsPy && typeof optionsPy.destroy === 'function') optionsPy.destroy()
      
      self.postMessage({ id, type: "SUCCESS", result: finalResult })
    } catch (error: any) {
      console.error("Pyodide RUN_ENGINE error inside worker:", error)
      self.postMessage({ id, type: "ERROR", error: error?.message || String(error) })
    }
  }

  if (type === "RUN_STATS") {
    if (!pyodide) {
      self.postMessage({ id, type: "ERROR", error: "Pyodide not initialized" })
      return
    }

    try {
      const { code, globals } = payload
      
      let pyGlobals = pyodide.globals.get("dict")()
      const pyRefs: any[] = []
      if (globals) {
         for (const [key, value] of Object.entries(globals)) {
             const valPy = pyodide.toPy(value)
             pyGlobals.set(key, valPy)
             pyRefs.push(valPy)
         }
      }
      
      pyGlobals.set("post_progress", (progress: number, msg: string) => {
        self.postMessage({ id, type: "progress", progress, message: msg })
      })
      
      const result = await pyodide.runPythonAsync(code, { globals: pyGlobals })
      
      let finalResult = result
      if (result && typeof result.toJs === 'function') {
        finalResult = result.toJs({ dict_converter: Object.fromEntries })
        result.destroy()
      }
      
      pyGlobals.destroy()
      pyRefs.forEach(ref => {
        if (ref && typeof ref.destroy === 'function') ref.destroy()
      })

      self.postMessage({ id, type: "SUCCESS", result: finalResult })
    } catch (error: any) {
      console.error("Pyodide RUN_STATS error inside worker:", error)
      self.postMessage({ id, type: "ERROR", error: error?.message || String(error) })
    }
  }
}
