export type ErrorBarType = "mean_sem" | "mean_sd" | "mean_95ci";

export interface DescriptiveStats {
  n: number;
  mean: number;
  sd: number;
  sem: number;
  ci_lower: number; // 95% CI
  ci_upper: number;
}

export interface ErrorBarBounds {
  y1: number; // lower bound
  y2: number; // upper bound
}

/**
 * Calculates error bar upper and lower bounds based on descriptive stats.
 * Uses the exact values computed by the engine.
 */
export function getErrorBarBounds(stats: DescriptiveStats, type: ErrorBarType): ErrorBarBounds {
  switch (type) {
    case "mean_sd":
      return { y1: stats.mean - stats.sd, y2: stats.mean + stats.sd };
    case "mean_95ci":
      return { y1: stats.ci_lower, y2: stats.ci_upper };
    case "mean_sem":
    default:
      return { y1: stats.mean - stats.sem, y2: stats.mean + stats.sem };
  }
}
