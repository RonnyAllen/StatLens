import type { GraphConfig } from "../../types/workbook";

let _ctx: CanvasRenderingContext2D | null = null;

function getCanvasContext(): CanvasRenderingContext2D {
  if (!_ctx) {
    const canvas = document.createElement("canvas");
    _ctx = canvas.getContext("2d");
    if (!_ctx) {
      throw new Error("Failed to get 2D context");
    }
  }
  return _ctx;
}

export function measureText(text: string, fontSize: number, fontFamily: string) {
  const ctx = getCanvasContext();
  ctx.font = `${fontSize}px ${fontFamily}`;
  return {
    width: ctx.measureText(text).width,
    height: fontSize * 1.2, // Approximate line height
  };
}

export interface LegendRow {
  y: number;
  items: { label: string; color: string; x: number; width: number }[];
}

export interface ChartLayoutInput {
  width: number;
  height: number;
  config: GraphConfig;
  xTickLabels: string[];
  yTickLabels: string[];
  legendItems?: { label: string; color: string }[];
  equationLines?: string[];
  maxBracketTier?: number;
  hasOmnibus?: boolean;
  orientation?: "vertical" | "horizontal";
}

export interface ChartLayoutOutput {
  margin: { top: number; right: number; bottom: number; left: number };
  innerWidth: number;
  innerHeight: number;
  xAxisTitleY: number;
  yAxisTitleX: number;
  legend: {
    rows: LegendRow[];
    height: number;
    y: number;
  } | null;
  equation: {
    lines: string[];
    y: number;
  } | null;
}

const MIN_PLOT_HEIGHT = 100;
const MIN_PLOT_WIDTH = 100;
const GAP = 8;
const LEGEND_SWATCH = 12;
const LEGEND_ITEM_GAP = 16;
const BRACKET_TIER_HEIGHT = 30; // 20 for bracket, 10 for label
const BRACKET_BASE_PAD = 40;

export function computeChartLayout(input: ChartLayoutInput): ChartLayoutOutput {
  const {
    width,
    height,
    config,
    xTickLabels,
    yTickLabels,
    legendItems = [],
    equationLines = [],
    maxBracketTier = -1,
    hasOmnibus = false,
    orientation = "vertical",
  } = input;

  const baseFont = config.fontSize || 12;
  const tickFont = config.axisLabelFontSize ?? baseFont;
  const titleFont = config.axisTitleFontSize ?? baseFont + 2;
  const legendFont = config.legendFontSize ?? baseFont;
  const eqFont = config.equationFontSize ?? tickFont;
  const fontFam = config.fontFamily || "Georgia, serif";

  // 1. Measure Left Margin (Y Axis)
  let maxTickWidth = 0;
  for (const label of yTickLabels) {
    const w = measureText(label, tickFont, fontFam).width;
    if (w > maxTickWidth) maxTickWidth = w;
  }
  
  let leftMargin = maxTickWidth + GAP;
  let yAxisTitleX = 0;
  
  if (config.showYAxisTitle !== false) {
    const titleH = measureText("Mg", titleFont, fontFam).height;
    leftMargin += titleH + 20;
    // Y Axis title is usually rotated, offset from axis line
    yAxisTitleX = maxTickWidth + 20 + titleH / 2;
  }
  
  // Left margin needs a baseline pad for the axis line itself
  leftMargin = Math.max(leftMargin + 10, 40);

  // 2. Measure Bottom Margin Stack
  let currentBottomY = 0;
  
  // X Tick labels
  let maxXTickHeight = measureText("Mg", tickFont, fontFam).height;
  currentBottomY += maxXTickHeight + GAP + 20; // Increased padding for tick labels and dy offset

  // X Axis title
  let xAxisTitleY = 0;
  if (config.showXAxisTitle !== false) {
    xAxisTitleY = currentBottomY + 10; // Extra push down for title
    const titleH = measureText("Mg", titleFont, fontFam).height;
    currentBottomY = xAxisTitleY + titleH + GAP + 15; // Extra padding after title
  }

  // Right margin is mostly fixed, enough for the last x-tick to not bleed off edge
  const rightMargin = 40;
  
  // Preliminary inner width for legend wrapping
  let provisionalInnerWidth = width - leftMargin - rightMargin;
  if (provisionalInnerWidth < MIN_PLOT_WIDTH) provisionalInnerWidth = MIN_PLOT_WIDTH;

  // 4. Position Legend
  let legendOutput: ChartLayoutOutput["legend"] = null;
  if (config.showLegend && legendItems.length > 0) {
    const legendY = currentBottomY + 30; // Significantly more padding above legend
    const rows: LegendRow[] = [];
    let currentRow: { label: string; color: string; x: number; width: number }[] = [];
    let currentX = 0;
    
    const legendLineHeight = measureText("Mg", legendFont, fontFam).height;
    let legendHeight = 0;

    for (const item of legendItems) {
      const textW = measureText(item.label, legendFont, fontFam).width;
      const itemWidth = LEGEND_SWATCH + GAP + textW;
      
      // If adding this item exceeds the row (and it's not the first item), wrap
      if (currentRow.length > 0 && currentX + itemWidth > provisionalInnerWidth) {
        rows.push({ y: legendHeight, items: currentRow });
        currentRow = [];
        currentX = 0;
        legendHeight += legendLineHeight + GAP;
      }
      
      currentRow.push({ ...item, x: currentX, width: itemWidth });
      currentX += itemWidth + LEGEND_ITEM_GAP;
    }
    
    if (currentRow.length > 0) {
      rows.push({ y: legendHeight, items: currentRow });
      legendHeight += legendLineHeight + GAP;
    }
    
    // Now center the rows within the provisionalInnerWidth
    for (const row of rows) {
      const rowWidth = row.items.reduce((sum, item, idx) => {
        return sum + item.width + (idx < row.items.length - 1 ? LEGEND_ITEM_GAP : 0);
      }, 0);
      
      const offset = Math.max(0, (provisionalInnerWidth - rowWidth) / 2);
      for (const item of row.items) {
        item.x += offset;
      }
    }

    legendOutput = { rows, height: legendHeight, y: legendY };
    currentBottomY += legendHeight + GAP;
  }

  // Equation block
  let equationOutput = null;
  if (equationLines.length > 0) {
    const eqY = currentBottomY + 30; // Significantly more padding above equation
    const eqLineHeight = measureText("Mg", eqFont, fontFam).height;
    const eqHeight = equationLines.length * (eqLineHeight * 1.2);
    equationOutput = { lines: equationLines, y: eqY };
    currentBottomY += eqHeight + GAP;
  }

  const bottomMargin = Math.max(currentBottomY + 10, 40);

  // 3. Measure Top Margin
  // We need space for brackets, p-value labels on top of them, and omnibus
  // maxBracketTier = -1 means no brackets
  const bracketLabelHeight = measureText("p=0.05", baseFont, fontFam).height;
  let topMarginRequired = 20;
  
  if (maxBracketTier >= 0) {
    topMarginRequired = BRACKET_BASE_PAD + (maxBracketTier + 1) * BRACKET_TIER_HEIGHT + bracketLabelHeight;
  }

  if (hasOmnibus) {
    const omniHeight = measureText("Mg", baseFont, fontFam).height;
    topMarginRequired += omniHeight + GAP;
  }
  
  topMarginRequired = Math.max(topMarginRequired, 40);

  // Clamp top margin to ensure minimum plot height
  const availableForTop = height - bottomMargin - MIN_PLOT_HEIGHT;
  const topMargin = Math.max(10, Math.min(topMarginRequired, availableForTop));

  const innerWidth = width - leftMargin - rightMargin;
  const innerHeight = height - topMargin - bottomMargin;

  return {
    margin: { top: topMargin, right: rightMargin, bottom: bottomMargin, left: leftMargin },
    innerWidth,
    innerHeight,
    xAxisTitleY,
    yAxisTitleX,
    legend: legendOutput,
    equation: equationOutput,
  };
}
