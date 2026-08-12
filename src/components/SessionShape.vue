<script setup lang="ts">
import { computed } from 'vue'
import { findDifficulty } from '../core/difficulty'
import { createSequence } from '../core/session'

const props = defineProps<{
  seed: string
  difficultyId: string
  infinite: boolean
}>()

const BAR = 3
const GAP = 1.6
const HEIGHT = 26
/**
 * Fixed number of slots, so every shape shares one horizontal scale: a short
 * session is a short stub and a long one fills the strip. Without this, a
 * 3-hold session would stretch into three slabs.
 */
const SLOTS = 40
const WIDTH = SLOTS * (BAR + GAP) - GAP

/** The seed's fingerprint: one bar per hold, taller = deeper lock-off. */
const bars = computed(() => {
  const difficulty = findDifficulty(props.difficultyId)
  const sequence = createSequence(props.seed, difficulty, props.infinite)
  const span = Math.max(180 - difficulty.minAngle, 1)
  const shown = Math.min(sequence.length ?? SLOTS, SLOTS)
  return Array.from({ length: shown }, (_, i) => {
    const step = sequence.step(i)
    return {
      x: i * (BAR + GAP),
      flex: (180 - step.angle) / span,
      up: step.up,
    }
  })
})
</script>

<template>
  <svg
    class="shape"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <rect
      v-for="(bar, i) in bars"
      :key="i"
      :x="bar.x"
      :y="HEIGHT - 2 - bar.flex * (HEIGHT - 3)"
      :width="BAR"
      :height="bar.flex * (HEIGHT - 3) + 2"
      :opacity="bar.up ? 1 : 0.45"
      rx="1.2"
    />
  </svg>
</template>

<style scoped>
.shape {
  display: block;
  width: 100%;
  height: 26px;
  fill: var(--accent);
}
</style>
