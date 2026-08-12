<script setup lang="ts">
import { computed } from 'vue'
import { RUNGS } from '../core/difficulty'

const props = defineProps<{
  /** Elbow angle in degrees: 180 = dead hang, smaller = more flexed. */
  angle: number
}>()

/**
 * Proportions follow the 7.5-head canon with a head height of ~38 units, so the
 * figure reads as a body rather than a spider: shoulder-to-wrist is 2.7 heads,
 * shoulder-to-hip 2.67, hip-to-floor 3.5. A straight arm therefore reaches hip
 * level, not the feet.
 */
const LIMB = 51
/** Grip is a little wider than the shoulders, as a pull-up grip actually is. */
const GRIP_X = 44
const SHOULDER_X = 34
const TORSO = 102
const LEG = 133
const HEAD_R = 17
/**
 * Shoulder line to head centre. Deliberately more than HEAD_R so the head sits
 * clear above the shoulders instead of straddling them.
 */
const NECK = 31
const ARC_R = 16
/**
 * Below roughly 11° the hand-to-shoulder chord is shorter than the horizontal
 * grip offset and the triangle has no solution, so the deepest rung is the floor.
 */
const DEEPEST = RUNGS[RUNGS.length - 1]

/**
 * Each arm is an isosceles triangle: hand on the bar, shoulder on the body, the
 * elbow flared outward. The included angle at the elbow is what the user copies,
 * so the body rises as the angle closes — exactly what a pull-up looks like.
 */
const pose = computed(() => {
  const half = (Math.max(DEEPEST, Math.min(180, props.angle)) / 2) * (Math.PI / 180)
  const chord = 2 * LIMB * Math.sin(half)
  const spread = GRIP_X - SHOULDER_X
  // Vertical drop left over once the horizontal hand-to-shoulder offset is paid for.
  const drop = Math.sqrt(Math.max(chord * chord - spread * spread, 1))

  const midX = (GRIP_X + SHOULDER_X) / 2
  const midY = drop / 2
  const height = LIMB * Math.cos(half)
  // Unit normal to the hand-shoulder chord, pointing away from the body.
  const nx = drop / chord
  const ny = spread / chord

  const elbow = { x: midX + height * nx, y: midY + height * ny }

  // Angle arc drawn inside the elbow, opening toward the body.
  const toHand = { x: (GRIP_X - elbow.x) / LIMB, y: (0 - elbow.y) / LIMB }
  const toShoulder = { x: (SHOULDER_X - elbow.x) / LIMB, y: (drop - elbow.y) / LIMB }
  const arc =
    `M ${elbow.x + ARC_R * toHand.x} ${elbow.y + ARC_R * toHand.y}` +
    ` A ${ARC_R} ${ARC_R} 0 0 0 ${elbow.x + ARC_R * toShoulder.x} ${elbow.y + ARC_R * toShoulder.y}`

  return { elbow, drop, arc }
})
</script>

<template>
  <svg
    class="figure"
    viewBox="-120 -40 240 394"
    role="img"
    :aria-label="`Elbow angle ${Math.round(angle)} degrees`"
  >
    <!-- bar -->
    <line class="figure__bar" x1="-100" y1="0" x2="100" y2="0" />

    <!-- one arm plus one leg, mirrored -->
    <g v-for="side in [1, -1]" :key="side" :transform="`scale(${side} 1)`">
      <path class="figure__arc" :d="pose.arc" />
      <polyline
        class="figure__arm"
        :points="`${GRIP_X},0 ${pose.elbow.x},${pose.elbow.y} ${SHOULDER_X},${pose.drop}`"
      />
      <circle class="figure__hand" :cx="GRIP_X" cy="0" r="7" />
      <line
        class="figure__body"
        x1="0"
        :y1="pose.drop + TORSO"
        x2="20"
        :y2="pose.drop + TORSO + LEG"
      />
    </g>

    <line
      class="figure__body"
      :x1="-SHOULDER_X"
      :y1="pose.drop"
      :x2="SHOULDER_X"
      :y2="pose.drop"
    />
    <line class="figure__body" x1="0" :y1="pose.drop" x2="0" :y2="pose.drop + TORSO" />
    <circle class="figure__head" cx="0" :cy="pose.drop - NECK" :r="HEAD_R" />
  </svg>
</template>

<style scoped>
.figure {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.figure__bar {
  stroke: var(--line);
  stroke-width: 11;
}

.figure__arm {
  stroke: var(--accent);
  stroke-width: 9;
}

.figure__hand {
  fill: var(--accent);
  stroke: none;
}

.figure__arc {
  stroke: var(--accent);
  stroke-width: 2;
  opacity: 0.42;
}

.figure__body,
.figure__head {
  stroke: var(--faint);
  stroke-width: 7;
}
</style>
