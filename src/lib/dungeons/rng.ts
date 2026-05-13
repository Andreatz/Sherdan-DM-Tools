// Mulberry32 PRNG: 32-bit seedable, deterministic, sufficient per il
// dungeon layout (non e' un caso che richiede sicurezza crittografica).
// Stesso seed -> stessa sequenza -> stesso dungeon. Necessario per i
// test e per consentire "rigenera con seed X" lato UI.
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function rand() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rand: () => number, minInclusive: number, maxInclusive: number): number {
  if (maxInclusive < minInclusive) return minInclusive;
  return minInclusive + Math.floor(rand() * (maxInclusive - minInclusive + 1));
}
