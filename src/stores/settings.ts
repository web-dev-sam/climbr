import { reactive, watch } from 'vue'
import { DEFAULT_DIFFICULTY } from '../core/difficulty'

const STORAGE_KEY = 'climbr.settings.v1'

export type Settings = {
  difficultyId: string
  infinite: boolean
  /** Click + vibrate on every angle change. */
  cues: boolean
}

const defaults: Settings = {
  difficultyId: DEFAULT_DIFFICULTY,
  infinite: false,
  cues: true,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) } : { ...defaults }
  } catch {
    return { ...defaults }
  }
}

export const settings = reactive<Settings>(load())

watch(settings, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Non-fatal: settings just won't survive a reload.
  }
})
