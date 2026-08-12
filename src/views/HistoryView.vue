<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SessionShape from '../components/SessionShape.vue'
import { findDifficulty } from '../core/difficulty'
import { duration, when } from '../core/format'
import {
  entries,
  removeEntry,
  runsOfSeed,
  sortedEntries,
  updateEntry,
} from '../stores/history'
import type { HistoryEntry } from '../stores/history'

const route = useRoute()
const router = useRouter()

/** Saving a session lands here with it already open, so it can be labelled at once. */
const openId = ref(typeof route.query.focus === 'string' ? route.query.focus : '')
const confirmId = ref('')

function toggle(id: string): void {
  openId.value = openId.value === id ? '' : id
  confirmId.value = ''
}

function runAgain(entry: HistoryEntry): void {
  router.push({
    name: 'session',
    query: { seed: entry.seed, d: entry.difficultyId, inf: entry.infinite ? '1' : '0' },
  })
}

function remove(id: string): void {
  if (confirmId.value !== id) {
    confirmId.value = id
    return
  }
  removeEntry(id)
  confirmId.value = ''
  openId.value = ''
}
</script>

<template>
  <main class="screen">
    <div class="topbar">
      <button class="icon-btn" aria-label="Back" @click="router.push('/')">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h1 class="wordmark">History</h1>
      <span class="meta">{{ entries.length }}</span>
    </div>

    <p v-if="!entries.length" class="empty">
      Nothing saved yet.<br />
      <span class="dim">Finish a session and keep the seed to train it again.</span>
    </p>

    <ul class="list">
      <li v-for="entry in sortedEntries" :key="entry.id" class="card entry">
        <button class="entry__head" @click="toggle(entry.id)">
          <div class="entry__title">
            <span :class="entry.label ? 'entry__label' : 'entry__label mono'">
              {{ entry.label || entry.seed }}
            </span>
            <span class="chip">{{ findDifficulty(entry.difficultyId).name }}</span>
            <span v-if="entry.infinite" class="chip chip--accent">∞</span>
            <span v-if="!entry.completed" class="chip">early</span>
          </div>
          <p class="meta">
            {{ when(entry.createdAt) }} · {{ duration(entry.durationMs) }} ·
            {{ entry.pulls }} pulls · to {{ entry.deepest }}°
            <template v-if="entry.rating"> · {{ '★'.repeat(entry.rating) }}</template>
          </p>
          <SessionShape
            :seed="entry.seed"
            :difficulty-id="entry.difficultyId"
            :infinite="entry.infinite"
          />
        </button>

        <div v-if="openId === entry.id" class="entry__body">
          <div class="field">
            <input
              :value="entry.label"
              placeholder="Label this session"
              maxlength="40"
              spellcheck="false"
              aria-label="Label"
              @input="updateEntry(entry.id, { label: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="rate">
            <span class="label">How hard was it</span>
            <div class="rate__stars">
              <button
                v-for="score in 5"
                :key="score"
                class="star"
                :class="{ 'star--on': score <= entry.rating }"
                :aria-label="`Rate ${score} of 5`"
                @click="updateEntry(entry.id, { rating: entry.rating === score ? 0 : score })"
              >
                ★
              </button>
            </div>
          </div>

          <div class="trail">
            <span class="label">Seed <span class="mono">{{ entry.seed }}</span></span>
            <div class="trail__runs">
              <span
                v-for="(run, i) in runsOfSeed(entry.seed)"
                :key="run.id"
                class="chip"
                :class="{ 'chip--accent': run.id === entry.id }"
              >
                {{ i + 1 }}. {{ duration(run.durationMs) }} · {{ run.pulls }}p
                <template v-if="!run.completed">· early</template>
              </span>
            </div>
          </div>

          <div class="entry__actions">
            <button class="btn btn--sm btn--primary" @click="runAgain(entry)">Run again</button>
            <button class="btn btn--sm btn--danger" @click="remove(entry.id)">
              {{ confirmId === entry.id ? 'Tap to confirm' : 'Delete' }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry {
  padding: 0;
  overflow: hidden;
}

.entry__head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 7px;
  width: 100%;
  padding: 13px 14px;
  text-align: left;
}

.entry__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.entry__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 560;
}

.entry__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 14px 16px;
  border-top: 1px solid var(--line);
}

.field input {
  font-size: 15px;
  font-weight: 500;
}

.field input::placeholder {
  color: var(--faint);
  font-weight: 400;
}

.rate,
.trail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rate__stars {
  display: flex;
  gap: 4px;
}

.star {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 20px;
  color: var(--line);
  background: var(--surface-hi);
  transition: color 0.12s ease;
}

.star--on {
  color: var(--accent);
}

.trail__runs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.entry__actions {
  display: flex;
  gap: 8px;
}

.entry__actions .btn {
  flex: 1;
}

.empty {
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  line-height: 1.7;
}
</style>
