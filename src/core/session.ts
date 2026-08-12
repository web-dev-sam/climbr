import type { Difficulty } from './difficulty'
import { RUNGS } from './difficulty'
import { hashSeed, lerp, mulberry32 } from './rng'

/** A hold below this reads as a flash rather than a position, so never emit one. */
const MIN_HOLD_MS = 600

export type Step = {
  /** Elbow angle to hold, degrees. 180 = dead hang. */
  angle: number
  /** How long to hold it, ms. */
  holdMs: number
  /** True when this angle is more flexed than the previous one — i.e. a pull. */
  up: boolean
}

export type Sequence = {
  seed: string
  difficulty: Difficulty
  infinite: boolean
  /** Seeded total length, ms. `null` while infinite. */
  totalMs: number | null
  /** Step count, or `null` while infinite (steps are generated on demand). */
  length: number | null
  step(index: number): Step
  /** Elapsed ms at which `index` begins. */
  startOf(index: number): number
  /** Index of the step covering `ms`, clamped to the final step when finite. */
  indexAt(ms: number): number
}

/**
 * Builds the whole session from `seed`. The random stream is consumed in a fixed
 * order — duration first, then hold/direction/jump per step — so the same seed
 * and difficulty always produce the same session, in either mode.
 */
export function createSequence(
  seed: string,
  difficulty: Difficulty,
  infinite: boolean,
): Sequence {
  const random = mulberry32(hashSeed(seed))
  const plannedMs = Math.round(
    lerp(difficulty.durationMs[0], difficulty.durationMs[1], random()),
  )
  const rungs = RUNGS.filter((angle) => angle >= difficulty.minAngle)
  const deepestRung = rungs.length - 1

  const steps: Step[] = []
  const starts: number[] = []
  let filledMs = 0
  let rung = 0

  function append(): void {
    const holdMs = Math.round(
      lerp(difficulty.holdMs[0], difficulty.holdMs[1], random()),
    )
    let up = false
    if (steps.length > 0) {
      // Ends of the range force direction; elsewhere the bias decides.
      if (rung === 0) up = true
      else if (rung === deepestRung) up = false
      else up = random() < difficulty.upBias
      const jump = 1 + Math.floor(random() * difficulty.maxJump)
      rung = Math.min(Math.max(rung + (up ? jump : -jump), 0), deepestRung)
    }
    starts.push(filledMs)
    steps.push({ angle: rungs[rung], holdMs, up })
    filledMs += holdMs
  }

  // Every session opens on a dead hang, then walks the rungs.
  append()

  if (!infinite) {
    while (filledMs < plannedMs) append()

    // Snap the tail so the session lasts exactly the seeded duration.
    const overshoot = filledMs - plannedMs
    if (overshoot > 0) {
      const last = steps[steps.length - 1]
      if (steps.length === 1 || last.holdMs - overshoot >= MIN_HOLD_MS) {
        last.holdMs = Math.max(MIN_HOLD_MS, last.holdMs - overshoot)
      } else {
        // Trimming would leave a stub: drop it and stretch its predecessor.
        steps.pop()
        starts.pop()
        steps[steps.length - 1].holdMs += last.holdMs - overshoot
      }
      filledMs = starts[starts.length - 1] + steps[steps.length - 1].holdMs
    }
  }

  function ensure(index: number): void {
    while (infinite && steps.length <= index) append()
  }

  return {
    seed,
    difficulty,
    infinite,
    totalMs: infinite ? null : filledMs,
    length: infinite ? null : steps.length,
    step(index) {
      ensure(index)
      return steps[Math.min(Math.max(index, 0), steps.length - 1)]
    },
    startOf(index) {
      ensure(index)
      return starts[Math.min(Math.max(index, 0), starts.length - 1)]
    },
    indexAt(ms) {
      while (infinite && filledMs <= ms) append()
      let low = 0
      let high = steps.length - 1
      while (low < high) {
        const mid = (low + high + 1) >> 1
        if (starts[mid] <= ms) low = mid
        else high = mid - 1
      }
      return low
    },
  }
}

export type Summary = {
  /** Changes to a more flexed angle — the pull count. */
  pulls: number
  /** Smallest angle reached, degrees. */
  deepest: number
  /** Angle changes performed, excluding the opening hang. */
  changes: number
}

/** Stats for the first `stepsDone` steps actually performed. */
export function summarize(sequence: Sequence, stepsDone: number): Summary {
  let pulls = 0
  let deepest = 180
  for (let i = 0; i < stepsDone; i++) {
    const step = sequence.step(i)
    if (step.up) pulls++
    if (step.angle < deepest) deepest = step.angle
  }
  return { pulls, deepest, changes: Math.max(stepsDone - 1, 0) }
}
