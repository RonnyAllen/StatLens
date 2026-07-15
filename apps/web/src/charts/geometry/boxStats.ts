import { quantile } from "d3-array";

export type WhiskerMode = "min_max" | "tukey";

export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface BoxPlotCoordinates {
  lowerWhisker: number;
  q1: number;
  median: number;
  q3: number;
  upperWhisker: number;
  outliers: number[];
}

export function getNotchBounds(median: number, q1: number, q3: number, n: number) {
  const h = 1.58 * (q3 - q1) / Math.sqrt(Math.max(n, 1));
  return { notchLow: median - h, notchHigh: median + h };
}

/**
 * Consumes engine quartiles/min-max, or computes them if raw data is provided.
 */
export function getBoxStats(
  values: number[],
  engineStats?: Partial<BoxStats>
): BoxPlotCoordinates {
  // Try to use engine stats if available, otherwise compute from raw data
  const sorted = [...values].filter(v => !isNaN(v) && v !== null).sort((a, b) => a - b);
  
  const q1 = engineStats?.q1 !== undefined ? engineStats.q1 : (quantile(sorted, 0.25) ?? 0);
  const median = engineStats?.median !== undefined ? engineStats.median : (quantile(sorted, 0.5) ?? 0);
  const q3 = engineStats?.q3 !== undefined ? engineStats.q3 : (quantile(sorted, 0.75) ?? 0);
  const min = engineStats?.min !== undefined ? engineStats.min : (sorted.length > 0 ? sorted[0] : 0);
  const max = engineStats?.max !== undefined ? engineStats.max : (sorted.length > 0 ? sorted[sorted.length - 1] : 0);

  // We only support min_max right now as per PRD defaults, but tukey requires IQR calculation.
  // Assuming min_max for default WhiskerMode:
  return {
    lowerWhisker: min,
    q1,
    median,
    q3,
    upperWhisker: max,
    outliers: [] // min_max mode has no outliers by definition
  };
}

export function getBoxStatsTukey(
  values: number[],
  engineStats?: Partial<BoxStats>
): BoxPlotCoordinates {
  const sorted = [...values].filter(v => !isNaN(v) && v !== null).sort((a, b) => a - b);
  const q1 = engineStats?.q1 !== undefined ? engineStats.q1 : (quantile(sorted, 0.25) ?? 0);
  const median = engineStats?.median !== undefined ? engineStats.median : (quantile(sorted, 0.5) ?? 0);
  const q3 = engineStats?.q3 !== undefined ? engineStats.q3 : (quantile(sorted, 0.75) ?? 0);
  
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  
  const nonOutliers = sorted.filter(v => v >= lowerFence && v <= upperFence);
  const lowerWhisker = nonOutliers.length > 0 ? nonOutliers[0] : q1;
  const upperWhisker = nonOutliers.length > 0 ? nonOutliers[nonOutliers.length - 1] : q3;
  const outliers = sorted.filter(v => v < lowerFence || v > upperFence);
  
  return {
    lowerWhisker,
    q1,
    median,
    q3,
    upperWhisker,
    outliers
  };
}
