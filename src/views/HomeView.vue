<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import SessionShape from '../components/SessionShape.vue'
import { DIFFICULTIES, findDifficulty } from '../core/difficulty'
import { duration } from '../core/format'
import { normalizeSeed, randomSeed } from '../core/rng'
import { createSequence, summarize } from '../core/session'
import { primeCues } from '../core/cues'
import { settings } from '../stores/settings'
import { runsOfSeed } from '../stores/history'

const router = useRouter()

const seed = ref(randomSeed())
const difficulty = computed(() => findDifficulty(settings.difficultyId))
const valid = computed(() => normalizeSeed(seed.value).length > 0)

/** Sessions are deterministic, so the exact workout can be shown before it runs. */
const preview = computed(() => {
  if (!valid.value) return null
  const sequence = createSequence(normalizeSeed(seed.value), difficulty.value, settings.infinite)
  return {
    totalMs: sequence.totalMs,
    stats: sequence.length === null ? null : summarize(sequence, sequence.length),
  }
})

const pastRuns = computed(() => runsOfSeed(normalizeSeed(seed.value)).length)

function start(): void {
  if (!valid.value) return
  primeCues()
  router.push({
    name: 'session',
    query: {
      seed: normalizeSeed(seed.value),
      d: settings.difficultyId,
      inf: settings.infinite ? '1' : '0',
    },
  })
}
</script>

<template>
  <main class="screen">
    <div class="topbar">
      <h1 class="wordmark">climb<span>r</span></h1>
      <button class="icon-btn" aria-label="History" @click="router.push('/history')">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </button>
    </div>

    <section class="stack">
      <p class="label">Difficulty</p>
      <button
        v-for="level in DIFFICULTIES"
        :key="level.id"
        class="level"
        :class="{ 'level--on': level.id === settings.difficultyId }"
        :aria-pressed="level.id === settings.difficultyId"
        @click="settings.difficultyId = level.id"
      >
        <span class="level__name">{{ level.name }}</span>
        <span class="level__meta">
          {{ Math.round(level.durationMs[0] / 1000) }}–{{ Math.round(level.durationMs[1] / 1000) }}s
          · {{ (level.holdMs[0] / 1000).toFixed(1) }}–{{ (level.holdMs[1] / 1000).toFixed(1) }}s hold
          · to {{ level.minAngle }}°
        </span>
      </button>
    </section>

    <button
      class="toggle"
      :aria-pressed="settings.infinite"
      @click="settings.infinite = !settings.infinite"
    >
      <span class="stack" style="gap: 2px">
        <span style="font-weight: 560">Infinity mode</span>
        <span class="meta">Same pace, no end — runs until you tap.</span>
      </span>
      <span class="toggle__track"><span class="toggle__knob" /></span>
    </button>

    <section class="stack">
      <p class="label">Seed</p>
      <div class="field">
        <input
          v-model="seed"
          class="mono"
          spellcheck="false"
          autocapitalize="characters"
          autocomplete="off"
          aria-label="Session seed"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button class="icon-btn" aria-label="New seed" @click="seed = randomSeed()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2" />
            <path d="M18 3v4h-4M6 21v-4h4" />
          </svg>
        </button>
      </div>

      <div v-if="preview" class="card preview">
        <SessionShape
          :seed="normalizeSeed(seed)"
          :difficulty-id="settings.difficultyId"
          :infinite="settings.infinite"
        />
        <p class="meta">
          <template v-if="preview.stats">
            {{ duration(preview.totalMs ?? 0) }} · {{ preview.stats.changes }} changes
            · {{ preview.stats.pulls }} pulls · to {{ preview.stats.deepest }}°
          </template>
          <template v-else>
            Endless · {{ (difficulty.holdMs[0] / 1000).toFixed(1) }}–{{
              (difficulty.holdMs[1] / 1000).toFixed(1)
            }}s pace · to {{ difficulty.minAngle }}°
          </template>
          <template v-if="pastRuns"> · run {{ pastRuns }}× before</template>
        </p>
      </div>
    </section>

    <div class="spacer" />

    <button class="btn btn--primary" :disabled="!valid" @click="start">
      {{ settings.infinite ? 'Start endless' : 'Start session' }}
    </button>

    <button
      class="cues"
      :aria-pressed="settings.cues"
      @click="settings.cues = !settings.cues"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round">
        <path v-if="settings.cues" d="M11 5 6 9H3v6h3l5 4V5zM16 9a4 4 0 0 1 0 6" />
        <path v-else d="M11 5 6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" />
      </svg>
      {{ settings.cues ? 'Cues on' : 'Cues off' }}
    </button>
  </main>
</template>

<style scoped>
.level {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 12px 14px;
  border-radius: var(--r);
  border: 1px solid var(--line);
  background: var(--surface);
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.level--on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.level__name {
  font-size: 15px;
  font-weight: 560;
}

.level--on .level__name {
  color: var(--accent);
}

.level__meta {
  font-size: 11.5px;
  color: var(--dim);
  font-variant-numeric: tabular-nums;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}

.btn--primary:disabled {
  opacity: 0.35;
}

.cues {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  font-size: 12.5px;
  color: var(--faint);
}

.cues[aria-pressed='true'] {
  color: var(--dim);
}
</style>
