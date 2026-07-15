/**
 * Pure functions for axis range and padding.
 */

export interface AxisRange {
  min: number;
  max: number;
}

/**
 * Calculates an automatic axis range with proportional padding.
 * 
 * @param values All numeric values to be plotted on this axis
 * @param paddingFactor Proportion of the range to add as padding (default 0.05 = 5%)
 * @param includeZero If true, the axis will extend to include 0 if it doesn't already
 */
export function getAutoAxisRange(
  values: number[], 
  paddingFactor: number = 0.05,
  includeZero: boolean = false
): AxisRange {
  const validValues = values.filter(v => !isNaN(v) && v !== null);
  
  if (validValues.length === 0) {
    return { min: includeZero ? 0 : -1, max: 1 };
  }
  
  let dataMin = Math.min(...validValues);
  let dataMax = Math.max(...validValues);
  
  if (dataMin === dataMax) {
    dataMin -= 1;
    dataMax += 1;
  }
  
  const range = dataMax - dataMin;
  const padding = range * paddingFactor;
  
  let min = dataMin - padding;
  let max = dataMax + padding;
  
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  
  return { min, max };
}
