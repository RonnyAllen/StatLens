import type { DataSheet } from "@/types/workbook"
import type { TestOptions } from "@/components/workspace/TestOptionsDialog"
import { statsEngine } from "./engine"

export async function executeTest(sheet: DataSheet, options: TestOptions, onProgress?: (p: number, m: string) => void) {
  console.log("==== STATLENS NEW ENGINE EXECUTING ====")
  return statsEngine.runEngine({ sheet, options }, onProgress)
}
