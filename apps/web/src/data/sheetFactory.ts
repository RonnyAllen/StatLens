import type { DataSheet, TableType } from "@/types/workbook"

export function createNewSheet(type: TableType, useSampleData: boolean, replicates: number = 1): DataSheet {
  const id = crypto.randomUUID()
  
  // Basic configs mapping to the discriminators
  let config: DataSheet["config"]
  switch (type) {
    case "XY":
      config = { type: "XY", config: { xFormat: "numbers", yFormat: "replicates", replicates } }
      break
    case "Column":
      config = { type: "Column", config: { paired: false, yFormat: "replicates", replicates } }
      break
    case "Grouped":
      config = { type: "Grouped", config: { yFormat: "replicates", replicates } }
      break
    case "Contingency":
      config = { type: "Contingency", config: {} }
      break
    case "Survival":
      config = { type: "Survival", config: { xFormat: "elapsed" } }
      break
    case "PartsOfWhole":
      config = { type: "PartsOfWhole", config: {} }
      break
    case "MultipleVariables":
      config = { type: "MultipleVariables", config: {} }
      break
    case "Nested":
      config = { type: "Nested", config: { subcolumns: replicates } }
      break
    default:
      config = { type: "Column", config: { paired: false, yFormat: "replicates", replicates: 1 } }
  }

  const numRows = 100
  const numCols = 26

  const columnGroups = Array.from({ length: numCols }, (_, i) => {
    const letter = String.fromCharCode(65 + i)
    return { id: letter, name: letter }
  })

  const data: Record<string, number | string | null>[] = Array.from({ length: numRows }).map(() => {
    const row: Record<string, null> = {}
    for (let i = 0; i < numCols; i++) {
      const groupLetter = String.fromCharCode(65 + i)
      if (replicates > 1) {
        for (let r = 1; r <= replicates; r++) {
          row[`${groupLetter}_${r}`] = null
        }
      } else {
        row[groupLetter] = null
      }
    }
    return row
  })

  if (useSampleData) {
    // Generate simple dummy data
    for (let i = 0; i < 5; i++) {
      if (replicates > 1) {
        for (let r = 1; r <= replicates; r++) {
          data[i][`A_${r}`] = (i + 1) * r
          data[i][`B_${r}`] = (i + 1) * 2 * r
          data[i][`C_${r}`] = (i + 1) * 3 * r
        }
      } else {
        data[i] = { A: i + 1, B: (i + 1) * 2, C: (i + 1) * 3 }
      }
    }
  }

  return {
    id,
    name: `New ${type} Table`,
    type,
    config,
    columnGroups,
    data
  }
}
