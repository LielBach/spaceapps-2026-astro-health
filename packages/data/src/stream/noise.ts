// Deterministic noise keyed by (seed, key, t): the same sample always gets the same value,
// whatever order the replay asks for it in.

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Uniform in [0, 1). */
export function uniform(seed: number, key: string, t: number): number {
  return hash32(`${seed}|${key}|${t.toFixed(4)}`) / 4294967296;
}

/** Standard normal (Box–Muller). */
export function gaussian(seed: number, key: string, t: number): number {
  const u1 = Math.max(uniform(seed, `${key}#a`, t), 1e-12);
  const u2 = uniform(seed, `${key}#b`, t);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
