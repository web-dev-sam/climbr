/**
 * Difficulty is the single knob. It sets four things at once:
 *   duration  — how long the session runs
 *   hold      — how long each angle is held before it changes
 *   upBias    — how often the next angle is *more* flexed (i.e. another pull)
 *   depth     — how deep the lock-offs are allowed to get
 */

/**
 * Elbow angles, in degrees, from dead hang to deep lock-off.
 * Descending: index 0 is the lowest body position, the last index the highest.
 *
 * Every gap is at least 10°, which is the smallest change that moves the figure
 * visibly. That is why the ladder carries 100° rather than 105° — the tier caps
 * must land on real rungs, and a 105/100 pair would be two indistinguishable
 * positions.
 */
export const RUNGS = [180, 165, 150, 135, 120, 100, 90, 75, 60, 45, 35, 25] as const

export type Difficulty = {
  id: string
  name: string
  /** Inclusive range for the seeded total session length, ms. */
  durationMs: [number, number]
  /** Inclusive range for a single hold, ms. */
  holdMs: [number, number]
  /** Probability the next angle is more flexed than the current one. */
  upBias: number
  /** Most rungs a single change may travel. */
  maxJump: number
  /** Deepest (smallest) angle this difficulty may ask for. */
  minAngle: number
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'warmup',
    name: 'Warm-up',
    durationMs: [5_000, 12_000],
    holdMs: [3_000, 4_500],
    upBias: 0.2,
    maxJump: 1,
    minAngle: 135,
  },
  {
    id: 'easy',
    name: 'Easy',
    durationMs: [12_000, 22_000],
    holdMs: [2_400, 3_600],
    upBias: 0.3,
    maxJump: 1,
    minAngle: 100,
  },
  {
    id: 'steady',
    name: 'Steady',
    durationMs: [22_000, 34_000],
    holdMs: [1_800, 2_800],
    upBias: 0.45,
    maxJump: 2,
    minAngle: 75,
  },
  {
    id: 'hard',
    name: 'Hard',
    durationMs: [34_000, 46_000],
    holdMs: [1_300, 2_100],
    upBias: 0.6,
    maxJump: 2,
    minAngle: 35,
  },
  {
    id: 'brutal',
    name: 'Brutal',
    durationMs: [46_000, 60_000],
    holdMs: [900, 1_600],
    upBias: 0.72,
    maxJump: 3,
    minAngle: 25,
  },
]

export const DEFAULT_DIFFICULTY = 'steady'

export function findDifficulty(id: string | undefined): Difficulty {
  return (
    DIFFICULTIES.find((d) => d.id === id) ??
    DIFFICULTIES.find((d) => d.id === DEFAULT_DIFFICULTY)!
  )
}
