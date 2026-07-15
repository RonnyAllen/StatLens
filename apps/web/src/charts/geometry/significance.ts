/**
 * Pure geometry layer for significance stars and bracket stacking.
 */

export type SignificanceScale = "standard" | "raw";

/**
 * Returns the significance string (stars or "ns") for a given p-value and scale.
 * 
 * Standard scale:
 *   ns (p > 0.05), * (p <= 0.05), ** (p <= 0.01), *** (p <= 0.001), **** (p <= 0.0001), ***** (p <= 0.00001)
 *
 * Raw scale:
 *   (p=0.002)
 */
export function getPValueStar(p: number, scale: SignificanceScale = "standard"): string {
  if (scale === "raw") {
    if (p < 0.0001) {
      return "(p<0.0001)";
    }
    return `(p=${p.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")})`;
  }

  if (p > 0.05) return "ns";
  
  if (p <= 0.00001) return "*****";
  if (p <= 0.0001) return "****";
  if (p <= 0.001) return "***";
  if (p <= 0.01) return "**";
  return "*";
}

export interface Comparison {
  group1: string;
  group2: string;
  p_value: number;
}

export interface TieredComparison extends Comparison {
  tier: number; // 0 is lowest (closest to data)
  idx1: number; // visual x-index of group1
  idx2: number; // visual x-index of group2
}

/**
 * Assigns non-overlapping Y-tiers to a list of significant comparisons.
 * Uses a greedy interval coloring algorithm.
 * 
 * @param comparisons The list of significant comparisons to draw
 * @param groupOrder An ordered array of group IDs as they appear on the X-axis
 * @returns An array of comparisons with assigned tiers (0, 1, 2, ...)
 */
export function assignBracketTiers(comparisons: Comparison[], groupOrder: string[]): TieredComparison[] {
  // 1. Map groups to their visual X-indices
  const mapped = comparisons.map(c => {
    const idx1 = groupOrder.indexOf(c.group1);
    const idx2 = groupOrder.indexOf(c.group2);
    return { ...c, idx1, idx2, tier: -1 };
  }).filter(c => c.idx1 !== -1 && c.idx2 !== -1);
  
  // 2. Sort by the span (distance between idx1 and idx2), shortest first.
  // This helps pack brackets tighter.
  mapped.sort((a, b) => Math.abs(a.idx1 - a.idx2) - Math.abs(b.idx1 - b.idx2));
  
  // 3. Assign tiers greedily
  for (const comp of mapped) {
    const minIdx = Math.min(comp.idx1, comp.idx2);
    const maxIdx = Math.max(comp.idx1, comp.idx2);
    
    let assignedTier = 0;
    let conflict = true;
    
    while (conflict) {
      conflict = false;
      // Check if any previously assigned bracket in this tier overlaps
      for (const other of mapped) {
        if (other.tier === assignedTier) {
          const oMin = Math.min(other.idx1, other.idx2);
          const oMax = Math.max(other.idx1, other.idx2);
          
          // Overlap condition: intervals [minIdx, maxIdx] and [oMin, oMax] intersect
          // Since brackets shouldn't even share endpoints in the same tier (looks messy),
          // we use <= and >= for the overlap check.
          if (Math.max(minIdx, oMin) <= Math.min(maxIdx, oMax)) {
            conflict = true;
            break;
          }
        }
      }
      if (conflict) {
        assignedTier++;
      }
    }
    
    comp.tier = assignedTier;
  }
  
  return mapped;
}
