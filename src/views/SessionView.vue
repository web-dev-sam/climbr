<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArmFigure from '../components/ArmFigure.vue'
import { findDifficulty } from '../core/difficulty'
import { clock, duration } from '../core/format'
import { normalizeSeed } from '../core/rng'
import { createSequence, summarize } from '../core/session'
import { cue, primeCues, releaseCues } from '../core/cues'
import { settings } from '../stores/settings'
import { addEntry } from '../stores/history'

/** Time to get onto the bar before the seeded clock starts. */
const READY_MS = 3000
/** Figure eases into the new angle instead of snapping, so the change reads as a move. */
const TWEEN_MS = 260

const route = useRoute()
const router = useRouter()

const seed = normalizeSeed(String(route.query.seed ?? ''))
const difficulty = findDifficulty(typeof route.query.d === 'string' ? route.query.d : undefined)
const infinite = route.query.inf === '1'
const sequence = createSequence(seed, difficulty, infinite)

const phase = ref<'ready' | 'running' | 'summary'>('ready')
const countdown = ref(Math.ceil(READY_MS / 1000))
const elapsed = ref(0)
const stepIndex = ref(0)
/** Tweened angle driving the figure; the readout shows the exact target. */
const display = ref(sequence.step(0).angle)
const completed = ref(false)

let frame = 0
let readyAt = 0
let startedAt = 0
let tweenFrom = display.value
let tweenAt = 0
let wakeLock: { release(): Promise<void> } | null = null

const step = computed(() => sequence.step(stepIndex.value))
const holdLeft = computed(() =>
  Math.max(1 - (elapsed.value - sequence.startOf(stepIndex.value)) / step.value.holdMs, 0),
)
const totalProgress = computed(() =>
  sequence.totalMs === null ? 0 : Math.min(elapsed.value / sequence.totalMs, 1),
)
/** Stats for the steps performed so far. */
const done = computed(() => summarize(sequence, stepIndex.value + 1))
const trainedMs = computed(() =>
  completed.value ? (sequence.totalMs ?? elapsed.value) : elapsed.value,
)

function begin(now: number): void {
  phase.value = 'running'
  startedAt = now
  elapsed.value = 0
  stepIndex.value = 0
  display.value = sequence.step(0).angle
  tweenFrom = display.value
  tweenAt = now
  cue('change', settings.cues)
  void requestWakeLock()
}

function finish(naturally: boolean): void {
  if (phase.value !== 'running') return
  completed.value = naturally
  phase.value = 'summary'
  cue('end', settings.cues)
  releaseWakeLock()
}

function tick(now: number): void {
  frame = requestAnimationFrame(tick)

  if (phase.value === 'ready') {
    const left = READY_MS - (now - readyAt)
    countdown.value = Math.max(1, Math.ceil(left / 1000))
    if (left <= 0) begin(now)
    return
  }
  if (phase.value !== 'running') return

  elapsed.value = now - startedAt

  const index = sequence.indexAt(elapsed.value)
  if (index !== stepIndex.value) {
    stepIndex.value = index
    tweenFrom = display.value
    tweenAt = now
    cue(step.value.up ? 'pull' : 'change', settings.cues)
  }

  const t = Math.min((now - tweenAt) / TWEEN_MS, 1)
  display.value = tweenFrom + (step.value.angle - tweenFrom) * (1 - (1 - t) ** 3)

  if (sequence.totalMs !== null && elapsed.value >= sequence.totalMs) finish(true)
}

/** A tap anywhere is the stop button — you are hanging, not aiming. */
function onTouch(): void {
  if (phase.value === 'running') finish(false)
}

/** Backgrounding the app means you stopped training; keep the honest partial result. */
function onHidden(): void {
  if (document.visibilityState === 'hidden') finish(false)
}

async function requestWakeLock(): Promise<void> {
  try {
    const api = (navigator as unknown as {
      wakeLock?: { request(kind: 'screen'): Promise<{ release(): Promise<void> }> }
    }).wakeLock
    wakeLock = api ? await api.request('screen') : null
  } catch {
    wakeLock = null
  }
}

function releaseWakeLock(): void {
  void wakeLock?.release()
  wakeLock = null
}

function save(): void {
  const entry = addEntry({
    seed,
    difficultyId: difficulty.id,
    infinite,
    durationMs: Math.round(trainedMs.value),
    plannedMs: sequence.totalMs,
    steps: stepIndex.value + 1,
    pulls: done.value.pulls,
    deepest: done.value.deepest,
    completed: completed.value,
  })
  router.replace({ name: 'history', query: { focus: entry.id } })
}

onMounted(() => {
  primeCues()
  readyAt = performance.now()
  frame = requestAnimationFrame(tick)
  document.addEventListener('visibilitychange', onHidden)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  document.removeEventListener('visibilitychange', onHidden)
  releaseWakeLock()
  releaseCues()
})
</script>

<template>
  <main class="session" @pointerdown="onTouch">
    <div class="track"><span class="track__fill" :style="{ width: `${totalProgress * 100}%` }" /></div>

    <header class="head">
      <span class="meta">
        {{ clock(elapsed) }}<template v-if="sequence.totalMs !== null"> / {{ clock(sequence.totalMs) }}</template>
      </span>
      <span class="chip">{{ difficulty.name }}<template v-if="infinite"> · ∞</template></span>
      <span class="meta mono">{{ seed }}</span>
    </header>

    <div class="stage">
      <div class="readout">
        <span class="readout__dir" :class="{ 'readout__dir--up': step.up }" aria-hidden="true">
          {{ stepIndex === 0 ? '·' : step.up ? '↑' : '↓' }}
        </span>
        <span class="readout__value">{{ step.angle }}</span>
        <span class="readout__unit">°</span>
      </div>
      <div class="figure-wrap">
        <ArmFigure :angle="display" />
      </div>
    </div>

    <footer class="foot">
      <div class="hold"><span class="hold__fill" :style="{ width: `${holdLeft * 100}%` }" /></div>
      <div class="foot__row">
        <span class="meta">{{ done.pulls }} pulls · {{ done.changes }} changes</span>
        <span class="meta">tap to end</span>
      </div>
    </footer>

    <Transition name="fade">
      <div v-if="phase === 'ready'" class="overlay">
        <p class="label">Dead hang, arms straight</p>
        <p class="count">{{ countdown }}</p>
        <button class="btn btn--ghost btn--sm" @pointerdown.stop @click="router.replace('/')">
          Cancel
        </button>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="phase === 'summary'" class="overlay overlay--sheet" @pointerdown.stop>
        <div class="sheet">
          <p class="label">{{ completed ? 'Session complete' : 'Ended early' }}</p>
          <p class="sheet__time">{{ duration(trainedMs) }}</p>
          <dl class="grid">
            <div><dt>Pulls</dt><dd>{{ done.pulls }}</dd></div>
            <div><dt>Changes</dt><dd>{{ done.changes }}</dd></div>
            <div><dt>Deepest</dt><dd>{{ done.deepest }}°</dd></div>
          </dl>
          <p class="meta">
            Seed <span class="mono">{{ seed }}</span> · {{ difficulty.name
            }}<template v-if="infinite"> · infinity</template>
          </p>
          <button class="btn btn--primary" @click="save">Save to history</button>
          <button class="btn btn--ghost" @click="router.replace('/')">Discard</button>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.session {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: calc(var(--safe-t) + 16px) var(--pad) calc(var(--safe-b) + 18px);
  max-width: 520px;
  width: 100%;
  margin: 0 auto;
}

.track {
  position: absolute;
  top: var(--safe-t);
  left: 0;
  right: 0;
  height: 2px;
  background: var(--line);
}

.track__fill {
  display: block;
  height: 100%;
  background: var(--accent);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 0;
}

.readout {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.readout__value {
  font-size: clamp(64px, 24vw, 112px);
  font-weight: 300;
  letter-spacing: -0.05em;
  color: var(--accent);
}

.readout__unit {
  font-size: clamp(24px, 8vw, 40px);
  font-weight: 300;
  color: var(--accent-dim);
}

.readout__dir {
  width: 1.1em;
  font-size: clamp(20px, 7vw, 32px);
  color: var(--faint);
  text-align: center;
}

.readout__dir--up {
  color: var(--accent);
}

.figure-wrap {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  justify-content: center;
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hold {
  height: 3px;
  border-radius: 2px;
  background: var(--line);
  overflow: hidden;
}

.hold__fill {
  display: block;
  height: 100%;
  background: var(--faint);
}

.foot__row {
  display: flex;
  justify-content: space-between;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(6px);
}

.count {
  font-size: 96px;
  font-weight: 300;
  letter-spacing: -0.05em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.overlay--sheet {
  justify-content: flex-end;
  padding: var(--pad);
}

.sheet {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--surface);
}

.sheet__time {
  font-size: 40px;
  font-weight: 300;
  letter-spacing: -0.04em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 2px 0 0;
}

.grid div {
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--surface-hi);
}

.grid dt {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
}

.grid dd {
  margin: 3px 0 0;
  font-size: 19px;
  font-weight: 560;
  font-variant-numeric: tabular-nums;
}
</style>
