import { z } from "zod"

// ----------------------------------------
// Data Table Types
// ----------------------------------------
export const TableTypeSchema = z.enum([
  "XY",
  "Column",
  "Grouped",
  "Contingency",
  "Survival",
  "PartsOfWhole",
  "MultipleVariables",
  "Nested"
])
export type TableType = z.infer<typeof TableTypeSchema>

// Common configs
export const YFormatSchema = z.enum(["replicates", "mean_sd_n", "mean_sem_n", "single"])

export const XYConfigSchema = z.object({
  xFormat: z.enum(["numbers", "dates", "elapsed"]),
  yFormat: YFormatSchema,
  replicates: z.number().min(1).default(1)
})

export const ColumnConfigSchema = z.object({
  paired: z.boolean().default(false),
  yFormat: YFormatSchema,
  replicates: z.number().min(1).default(1)
})

export const GroupedConfigSchema = z.object({
  yFormat: YFormatSchema,
  replicates: z.number().min(1).default(1)
})

export const ContingencyConfigSchema = z.object({}) // R x C matrix of integer counts

export const SurvivalConfigSchema = z.object({
  xFormat: z.enum(["elapsed", "dates"])
})

export const PartsOfWholeConfigSchema = z.object({})

export const MultipleVariablesConfigSchema = z.object({
  // Variables config maps column IDs to variable types
  variableTypes: z.record(z.string(), z.enum(["continuous", "categorical", "binary"])).optional()
})

export const NestedConfigSchema = z.object({
  subcolumns: z.number().min(1).default(2) // experimental replicates
})

// Unified Sheet Config
export const SheetConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("XY"), config: XYConfigSchema }),
  z.object({ type: z.literal("Column"), config: ColumnConfigSchema }),
  z.object({ type: z.literal("Grouped"), config: GroupedConfigSchema }),
  z.object({ type: z.literal("Contingency"), config: ContingencyConfigSchema }),
  z.object({ type: z.literal("Survival"), config: SurvivalConfigSchema }),
  z.object({ type: z.literal("PartsOfWhole"), config: PartsOfWholeConfigSchema }),
  z.object({ type: z.literal("MultipleVariables"), config: MultipleVariablesConfigSchema }),
  z.object({ type: z.literal("Nested"), config: NestedConfigSchema })
])

// ----------------------------------------
// Data Sheet
// ----------------------------------------
export const DataSheetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: TableTypeSchema,
  config: SheetConfigSchema,
  // columnGroups dictates the top-level groups (e.g. "Control", "Treated")
  columnGroups: z.array(z.object({
    id: z.string(),
    name: z.string()
  })),
  // rowTitles (used in XY, Grouped, Contingency, PartsOfWhole)
  rowTitles: z.array(z.string()).optional(),
  // data is a matrix of numeric | string | null values
  // structured as rows: data[rowIndex][colId] = value
  // We'll store data as an array of Row objects to match AG Grid easily.
  data: z.array(z.record(z.string(), z.union([z.number(), z.string(), z.null()])))
})
export type DataSheet = z.infer<typeof DataSheetSchema>

// ----------------------------------------
// Analysis & Graph Specs (Stubs for Phase 4 & 5)
// ----------------------------------------
export const AnalysisSchema = z.object({
  id: z.string().uuid(),
  sheetId: z.string().uuid(),
  testId: z.string(),
  name: z.string().optional(),
  options: z.record(z.string(), z.any()),
  results: z.any().optional(),
  report: z.string().optional(),
  createdAt: z.string()
})
export type Analysis = z.infer<typeof AnalysisSchema>

export const GraphConfigSchema = z.object({
  notched: z.boolean().optional(),
  errorBarType: z.enum(["mean_sem", "mean_sd", "mean_95ci"]).default("mean_sem"),
  errorBars: z.preprocess(
    (val) => {
      if (val === true) return "ci95"
      if (val === false) return "none"
      return val
    },
    z.enum(["none", "se", "ci95"]).default("none")
  ),
  survivalShowAs: z.enum(["fractions", "percents"]).default("fractions"),
  survivalSymbolsAt: z.enum(["all", "censored"]).default("censored"),
  survivalStyle: z.enum(["staircase-ticks", "staircase", "connected-dots", "dots-only"]).default("staircase-ticks"),
  whiskerMode: z.enum(["min_max", "tukey"]).default("min_max"),
  showPoints: z.boolean().default(true),
  jitterSeed: z.number().default(42),
  // Horizontal Plot Configs
  rangeMode: z.enum(["min_max", "iqr", "mean_sd"]).optional(),
  ciLevel: z.number().optional(),
  referenceValue: z.number().optional(),
  ciSource: z.enum(["group_means", "coefficients"]).optional(),
  axisMode: z.enum(["auto", "manual"]).default("auto"),
  palette: z.enum([
    "okabe-ito", "viridis", "tableau", "brewer-bold", "forest-dusk", "duo-tone",
    "nature", "lancet", "jama", "grayscale", "magma", "cividis",
    "ocean", "pastel", "neon", "earth", "retro"
  ]).default("okabe-ito"),
  background: z.enum(["transparent", "white"]).default("transparent"),
  significanceScale: z.enum(["standard", "raw"]).default("standard"),
  showNsBrackets: z.boolean().default(true),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  xAxisTitle: z.string().optional(),
  yAxisTitle: z.string().optional(),
  showXAxisTitle: z.boolean().default(true),
  showYAxisTitle: z.boolean().default(true),
  showGrid: z.boolean().default(true),
  yAxisMin: z.number().optional(),
  yAxisMax: z.number().optional(),
  yAxisStep: z.number().optional(),
  xAxisMin: z.number().optional(),
  xAxisMax: z.number().optional(),
  xAxisStep: z.number().optional(),
  heatmapMin: z.number().optional(),
  heatmapMax: z.number().optional(),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().default(12),
  axisTitleFontSize: z.number().optional(),
  axisLabelFontSize: z.number().optional(),
  pValueFontSize: z.number().optional(),
  legendFontSize: z.number().optional(),
  equationFontSize: z.number().optional(),
  showLegend: z.boolean().default(false),
  showPostHocCaption: z.boolean().default(true),
  pointSize: z.number().default(3),
  lineStyle: z.enum(["none", "straight", "smooth"]).optional(),
  trendlineType: z.enum(["none", "linear", "linear_forecast", "exponential", "logarithmic"]).optional(),
  forceIntercept: z.boolean().optional(),
  forcedInterceptValue: z.number().optional(),
  histogramBins: z.number().optional(),
  histogramBinSettings: z.object({
    type: z.enum(["continuous", "prebinned"]),
    stepSize: z.number().optional()
  }).optional()
})
export type GraphConfig = z.infer<typeof GraphConfigSchema>

export const GraphSchema = z.object({
  id: z.string().uuid(),
  sheetId: z.string().uuid(),
  analysisId: z.string().uuid().optional(),
  graphFamily: z.enum(["Column", "XY", "Survival", "Grouped", "Contingency", "PartsOfWhole", "MultipleVariables", "Nested"]),
  chartType: z.enum(["bar-error", "box", "violin", "raincloud", "scatter", "line-fit", "km-step", "jitter", "strip", "swarm", "h-box", "range-dumbbell", "ci-forest", "histogram"]),
  name: z.string().optional(),
  config: GraphConfigSchema,
  createdAt: z.string()
})
export type Graph = z.infer<typeof GraphSchema>

// ----------------------------------------
// Workbook
// ----------------------------------------
export const WorkbookSchema = z.object({
  schemaVersion: z.string(),
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sheets: z.array(DataSheetSchema),
  analyses: z.array(AnalysisSchema),
  graphs: z.array(GraphSchema),
  appTheme: z.string().default("system")
})
export type Workbook = z.infer<typeof WorkbookSchema>
