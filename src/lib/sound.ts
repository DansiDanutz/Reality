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

// ── Street ambience: a soft city-night hum, fully synthesized ──
let ambience: { gain: GainNode; source: AudioBufferSourceNode } | null = null

export function startAmbience(): void {
  const context = ensureContext()
  if (!context || ambience) return
  // 2s of gentle brown noise, looped through a low-pass — distant city air
  const length = context.sampleRate * 2
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  let lastOut = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    lastOut = (lastOut + 0.02 * white) / 1.02
    data[i] = lastOut * 3.5
  }
  const source = context.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 320
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(0.05, context.currentTime + 1.2)
  source.connect(filter).connect(gain).connect(context.destination)
  source.start()
  ambience = { gain, source }
}

export function stopAmbience(): void {
  if (!ambience || !ctx) return
  const { gain, source } = ambience
  ambience = null
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
  setTimeout(() => {
    try {
      source.stop()
    } catch {
      /* already stopped */
    }
  }, 600)
}
