import type { DataSheet } from "@/types/workbook"
import type { TestOptions } from "@/components/workspace/TestOptionsDialog"

// The engine's Python run() returns a shape that genuinely varies per test_id (error |
// descriptives | ANOVA table | post-hoc matrix | ...), so the RETURN type below stays
// `any` on purpose -- only the INPUT payload is typed, which is what this task asks for.
export interface RunEnginePayload {
  sheet: DataSheet
  entrypoint?: string
  options?: TestOptions
}

export type WorkerResponse = {
  id: string
  type: "INIT_SUCCESS" | "SUCCESS" | "ERROR" | "progress"
  result?: any
  error?: string
  progress?: number
  message?: string
}

class StatsEngine {
  private worker: Worker | null = null
  private resolvers: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map()
  private messageIdCounter: number = 0

  private generateId(): string {
    this.messageIdCounter += 1;
    return `msg-${this.messageIdCounter}-${Date.now()}`;
  }

  init(onProgress?: (p: number, m: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // Using vite's ?worker
      this.worker = new Worker(new URL("./pyodide.worker2.ts", import.meta.url), { type: "module" })

      const id = this.generateId()
      
      const handler = (e: MessageEvent<WorkerResponse>) => {
        const { id: msgId, type, result, error, progress, message } = e.data
        if (msgId === id) {
          if (type === "progress") {
            if (onProgress) onProgress(progress || 0, message || "")
            return
          }
          this.worker!.removeEventListener("message", handler)
          this.resolvers.delete(id)
          if (type === "INIT_SUCCESS" || type === "SUCCESS") {
            resolve(result)
          } else if (type === "ERROR") {
            reject(new Error(error))
          }
        }
      }

      this.worker.addEventListener("message", handler)
      this.resolvers.set(id, { resolve, reject })

      this.worker.postMessage({ id, type: "INIT" })
    })
  }

  runPython(code: string, globals?: Record<string, any>, onProgress?: (p: number, m: string) => void): Promise<any> {
    if (!this.worker) throw new Error("StatsEngine not initialized")

    return new Promise((resolve, reject) => {
      const id = this.generateId()
      
      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id === id) {
          if (e.data.type === "progress") {
            if (onProgress && e.data.progress !== undefined) onProgress(e.data.progress, e.data.message || "")
            return
          }
          this.worker!.removeEventListener("message", handler)
          this.resolvers.delete(id)
          if (e.data.type === "ERROR") reject(new Error(e.data.error))
          else resolve(e.data.result)
        }
      }
      
      this.worker!.addEventListener("message", handler)
      this.resolvers.set(id, { resolve, reject })

      this.worker!.postMessage({ id, type: "RUN_STATS", payload: { code, globals } })
    })
  }

  runEngine(payload: any, onProgress?: (p: number, m: string) => void): Promise<any> {
    if (!this.worker) throw new Error("StatsEngine not initialized")

    return new Promise((resolve, reject) => {
      const id = this.generateId()
      
      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id === id) {
          if (e.data.type === "progress") {
            if (onProgress && e.data.progress !== undefined) onProgress(e.data.progress, e.data.message || "")
            return
          }
          this.worker!.removeEventListener("message", handler)
          this.resolvers.delete(id)
          if (e.data.type === "ERROR") reject(new Error(e.data.error))
          else resolve(e.data.result)
        }
      }
      
      this.worker!.addEventListener("message", handler)
      this.resolvers.set(id, { resolve, reject })
      
      this.worker!.postMessage({
        id,
        type: "RUN_ENGINE",
        payload
      })
    })
  }

  async smokeTest() {
    const code = `
from scipy import stats
result = stats.ttest_ind([1, 2, 3], [4, 5, 6])
{"statistic": result.statistic, "pvalue": result.pvalue}
`
    const res = await this.runPython(code)
    console.log("Pyodide Smoke Test Result:", res)
    return res
  }
    async analyzeSheet(sheet: any): Promise<any> {
    return this.runEngine({ sheet, entrypoint: "analyze_sheet" })
  }
}

export const statsEngine = new StatsEngine()
