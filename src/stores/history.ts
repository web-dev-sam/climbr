import { computed, reactive, watch } from 'vue'
import { randomSeed } from '../core/rng'

const STORAGE_KEY = 'climbr.history.v1'

export type HistoryEntry = {
  id: string
  /** Everything needed to replay the session exactly. */
  seed: string
  difficultyId: string
  infinite: boolean
  /** User label; empty means the seed is the label. */
  label: string
  /** User's own difficulty rating, 1-5. 0 = unrated. */
  rating: number
  createdAt: number
  /** Time actually trained, ms. */
  durationMs: number
  /** Seeded target length, ms. `null` for infinity mode. */
  plannedMs: number | null
  /** Angles actually held. */
  steps: number
  pulls: number
  /** Smallest angle reached, degrees. */
  deepest: number
  /** False when the session was ended early by a tap. */
  completed: boolean
}

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is HistoryEntry =>
        typeof entry?.id === 'string' && typeof entry?.seed === 'string',
    )
  } catch {
    return []
  }
}

export const entries = reactive<HistoryEntry[]>(load())

/** Newest first — the list order everywhere in the UI. */
export const sortedEntries = computed(() =>
  [...entries].sort((a, b) => b.createdAt - a.createdAt),
)

watch(
  entries,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Private mode or a full quota: history is a convenience, not a blocker.
    }
  },
  { deep: true },
)

export type NewEntry = Omit<HistoryEntry, 'id' | 'createdAt' | 'label' | 'rating'>

export function addEntry(record: NewEntry): HistoryEntry {
  const entry: HistoryEntry = {
    ...record,
    id: `${Date.now().toString(36)}-${randomSeed().slice(0, 4)}`,
    createdAt: Date.now(),
    label: '',
    rating: 0,
  }
  entries.push(entry)
  return entry
}

export function updateEntry(
  id: string,
  patch: Partial<Pick<HistoryEntry, 'label' | 'rating'>>,
): void {
  const entry = entries.find((candidate) => candidate.id === id)
  if (entry) Object.assign(entry, patch)
}

export function removeEntry(id: string): void {
  const index = entries.findIndex((candidate) => candidate.id === id)
  if (index >= 0) entries.splice(index, 1)
}

/** Every run of one seed, oldest first — this is the improvement trail. */
export function runsOfSeed(seed: string): HistoryEntry[] {
  return entries
    .filter((entry) => entry.seed === seed)
    .sort((a, b) => a.createdAt - b.createdAt)
}
