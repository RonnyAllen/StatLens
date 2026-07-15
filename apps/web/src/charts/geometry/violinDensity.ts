import { bin, max, min, mean, sum } from "d3-array";

export interface Point {
  x: number; // The value
  y: number; // The density at that value
}

// Epanechnikov kernel is standard for KDE, but Gaussian is also common.
// We'll use a simple Gaussian kernel.
function gaussianKernel(scale: number) {
  return function(u: number) {
    return Math.exp(-0.5 * (u / scale) * (u / scale)) / (Math.sqrt(2 * Math.PI) * scale);
  };
}

/**
 * Kernel Density Estimator
 */
function kde(kernel: (u: number) => number, thresholds: number[], data: number[]): Point[] {
  return thresholds.map(t => ({
    x: t,
    y: mean(data, d => kernel(t - d)) ?? 0
  }));
}

/**
 * Computes a Silverman's rule of thumb bandwidth.
 * h = 0.9 * min(SD, IQR / 1.34) * n^(-1/5)
 */
export function silvermanBandwidth(data: number[]): number {
  const n = data.length;
  if (n < 2) return 1;

  const m = mean(data) ?? 0;
  const variance = sum(data, d => Math.pow(d - m, 2)) / (n - 1);
  const sd = Math.sqrt(variance);

  const sorted = [...data].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  
  // Handle edge case where IQR is 0 (all points identical)
  const spread = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd;
  const h = 0.9 * spread * Math.pow(n, -0.2);
  
  return h === 0 ? 1 : h; // Fallback if spread is 0
}

/**
 * Calculates density path points for a violin plot.
 * 
 * @param data Array of numeric values
 * @param steps Number of points to calculate along the curve
 * @param providedBandwidth Optional bandwidth. If omitted, Silverman's is used.
 */
export function getViolinDensity(
  data: number[],
  steps: number = 50,
  providedBandwidth?: number
): Point[] {
  const validData = data.filter(d => !isNaN(d) && d !== null);
  if (validData.length === 0) return [];
  
  const bandwidth = providedBandwidth ?? silvermanBandwidth(validData);
  
  // We want to evaluate the density over a range slightly larger than the data
  const dataMin = min(validData) ?? 0;
  const dataMax = max(validData) ?? 0;
  
  // Extend by 3 bandwidths on either side to let the tails taper off
  const rangeMin = dataMin - 3 * bandwidth;
  const rangeMax = dataMax + 3 * bandwidth;
  
  const stepSize = (rangeMax - rangeMin) / (steps - 1);
  const thresholds = Array.from({ length: steps }, (_, i) => rangeMin + i * stepSize);
  
  const densityPoints = kde(gaussianKernel(bandwidth), thresholds, validData);
  
  // To make a proper closed polygon for the violin, we ensure the ends are exactly 0
  if (densityPoints.length > 0) {
    densityPoints[0].y = 0;
    densityPoints[densityPoints.length - 1].y = 0;
  }
  
  return densityPoints;
}
