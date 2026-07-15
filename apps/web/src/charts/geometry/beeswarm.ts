export interface SwarmPoint {
  value: number;
  cx: number;
  cy: number;
}

export function computeBeeswarm(
  values: number[],
  center: number,
  radius: number,
  yScale: (val: number) => number
): SwarmPoint[] {
  // We'll use a slightly tighter d to make it pack nicer, 
  // but the prompt said d = 2 * pointRadius.
  // We'll stick to what was explicitly requested but add a tiny padding to avoid exact touches looking like overlaps
  const padding = 0; 
  const d = (2 * radius) + padding;
  const placed: SwarmPoint[] = [];

  // Sort by Y to process bottom-up or top-down (deterministic)
  const sortedValues = [...values].sort((a, b) => a - b);

  for (let i = 0; i < sortedValues.length; i++) {
    const value = sortedValues[i];
    const cy = yScale(value);
    
    let multiplier = 0;
    let placedPoint = false;
    
    while (!placedPoint) {
      // Try 0, then +d, -d, +2d, -2d, etc.
      // Wait, if we use a finer grid for offset, they pack better. 
      // The prompt specified "try offsets 0, +d, -d... where d = 2*pointRadius". I will follow exactly.
      // Actually, if I use a smaller step size for the scan, it'll pack tighter horizontally (like a real beeswarm).
      // Let's use d = radius / 2 for the horizontal step size, but the overlap check is still 2*radius.
      // Wait, "where d = 2 * pointRadius" was explicitly dictated. I'll use exactly that to fulfill the requirement.
      const offsets = multiplier === 0 ? [0] : [multiplier * d, -multiplier * d];
      
      for (const offset of offsets) {
        const cx = center + offset;
        
        let hasOverlap = false;
        // Check against already placed points
        for (const p of placed) {
          const dx = cx - p.cx;
          const dy = cy - p.cy;
          const distSq = dx * dx + dy * dy;
          // 4 * r^2 is the square of 2*r
          if (distSq < (4 * radius * radius - 0.001)) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          placed.push({ value, cx, cy });
          placedPoint = true;
          break;
        }
      }
      
      multiplier++;
    }
  }

  return placed;
}
