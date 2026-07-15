/**
 * Deterministic jitter for scatter and raincloud plots.
 * We want exports to be 100% reproducible, so we seed a pseudo-random number generator.
 */

function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * Returns a deterministic jitter offset between -bandWidth/2 and bandWidth/2.
 * @param seed The base seed to use
 * @param index The index of the point being jittered to ensure uniqueness
 * @param bandWidth The total width the jitter can span
 */
export function getJitterOffset(seed: number, index: number, bandWidth: number): number {
  // We add index to the seed to get a unique stream for each point, 
  // or we could just use a single stream and call it sequentially.
  // Calling it sequentially means if a point is removed, all subsequent points shift.
  // Using seed + index makes it positionally stable.
  const rand = mulberry32(seed + index * 1337)();
  return (rand - 0.5) * bandWidth;
}
