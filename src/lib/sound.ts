/**
 * Reality's voice — tiny synthesized chimes, no audio files.
 * gold = money (warm major arpeggio up), sky = progress (bright ping),
 * ok = neutral confirmation (soft single note).
 */

let ctx: AudioContext | null = null

function ensureContext(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(context: AudioContext, freq: number, start: number, duration: number, peak: number) {
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(context.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

const PATTERNS: Record<'gold' | 'sky' | 'ok', { freqs: number[]; step: number; dur: number; peak: number }> = {
  gold: { freqs: [523.25, 659.25, 783.99], step: 0.07, dur: 0.28, peak: 0.05 }, // C5-E5-G5
  sky: { freqs: [880, 1174.66], step: 0.09, dur: 0.22, peak: 0.045 }, // A5-D6
  ok: { freqs: [587.33], step: 0, dur: 0.18, peak: 0.035 }, // D5
}

export function playChime(kind: 'gold' | 'sky' | 'ok'): void {
  const context = ensureContext()
  if (!context) return
  const p = PATTERNS[kind]
  const now = context.currentTime
  p.freqs.forEach((f, i) => tone(context, f, now + i * p.step, p.dur, p.peak))
}
