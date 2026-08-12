/**
 * Deterministic randomness. Every session is a pure function of its seed, so a
 * saved seed replays the exact same angle sequence forever.
 */

/** Characters used for generated seeds: no 0/O/1/I/L lookalikes to misread aloud. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const SEED_LENGTH = 6

/** FNV-1a, 32-bit. Any string is a valid seed. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: tiny, fast, good enough distribution for interval training. */
export function mulberry32(state: number): () => number {
  let a = state >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): string {
  const bytes = new Uint8Array(SEED_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

/** Seeds are compared and stored uppercase so `abc` and `ABC` are one session. */
export function normalizeSeed(input: string): string {
  return input.trim().toUpperCase().slice(0, 24)
}

export function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t
}
