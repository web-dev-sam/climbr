/** `0:07`, `1:00` — session lengths are always under an hour. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** `12s`, `1m 04s` — compact form for lists and metadata rows. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total}s`
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`
}

/** `today 14:32`, `3 Aug` — recency matters more than the exact date here. */
export function when(timestamp: number): string {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const dayStart = new Date().setHours(0, 0, 0, 0)
  if (timestamp >= dayStart) return `today ${time}`
  if (timestamp >= dayStart - 86_400_000) return `yesterday ${time}`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
