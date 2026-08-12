/**
 * Change cues. On a bar you are looking at your hands, not the phone, so the
 * angle change is announced by a click and a buzz as well as on screen.
 */

let audio: AudioContext | null = null

/** Must be called from a user gesture (the start tap) or iOS keeps audio muted. */
export function primeCues(): void {
  if (audio) {
    void audio.resume()
    return
  }
  try {
    audio = new AudioContext()
  } catch {
    audio = null
  }
}

export function releaseCues(): void {
  void audio?.close()
  audio = null
}

type CueKind = 'change' | 'pull' | 'end'

const TONE: Record<CueKind, { hz: number; ms: number; gain: number }> = {
  change: { hz: 660, ms: 60, gain: 0.16 },
  pull: { hz: 990, ms: 80, gain: 0.2 },
  end: { hz: 330, ms: 220, gain: 0.22 },
}

const BUZZ: Record<CueKind, number | number[]> = {
  change: 30,
  pull: [0, 25, 45, 25],
  end: 180,
}

export function cue(kind: CueKind, enabled: boolean): void {
  if (!enabled) return

  if (audio && audio.state === 'running') {
    const { hz, ms, gain } = TONE[kind]
    const now = audio.currentTime
    const osc = audio.createOscillator()
    const amp = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = hz
    // Exponential fade: a hard stop on a sine clicks audibly.
    amp.gain.setValueAtTime(gain, now)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
    osc.connect(amp).connect(audio.destination)
    osc.start(now)
    osc.stop(now + ms / 1000)
  }

  navigator.vibrate?.(BUZZ[kind])
}
