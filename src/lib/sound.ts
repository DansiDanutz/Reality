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

const PATTERNS: Record<'gold' | 'sky' | 'ok' | 'meal', { freqs: number[]; step: number; dur: number; peak: number }> = {
  gold: { freqs: [523.25, 659.25, 783.99], step: 0.07, dur: 0.28, peak: 0.05 }, // C5-E5-G5
  sky: { freqs: [880, 1174.66], step: 0.09, dur: 0.22, peak: 0.045 }, // A5-D6
  ok: { freqs: [587.33], step: 0, dur: 0.18, peak: 0.035 }, // D5
  // "Meal cooked" — a warm major-third dyad an octave below the purchase
  // chime, with a slightly longer settle. Reads as "food's ready, come eat"
  // rather than the bright ka-ching of spending money (issue #30).
  meal: { freqs: [392.0, 523.25], step: 0.1, dur: 0.34, peak: 0.05 }, // G4-C5
}

export function playChime(kind: 'gold' | 'sky' | 'ok' | 'meal'): void {
  const context = ensureContext()
  if (!context) return
  const p = PATTERNS[kind]
  const now = context.currentTime
  p.freqs.forEach((f, i) => tone(context, f, now + i * p.step, p.dur, p.peak))
}

/**
 * Street Mode jump-landing thud (issue #30). A short filtered-noise burst with
 * a low-sine body — the sound of shoes meeting pavement. Distinct instrument
 * from the chimes (which are pure tonal sines); this is broad-band + low end.
 */
export function playThud(): void {
  const context = ensureContext()
  if (!context) return
  const now = context.currentTime
  // Low sine body (the "thud" thump)
  const osc = context.createOscillator()
  const oscGain = context.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(110, now)
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.12)
  oscGain.gain.setValueAtTime(0.0001, now)
  oscGain.gain.linearRampToValueAtTime(0.12, now + 0.008)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
  osc.connect(oscGain).connect(context.destination)
  osc.start(now)
  osc.stop(now + 0.22)
  // Brief noise click (the "step" transient) through a low-pass
  const len = Math.floor(context.sampleRate * 0.08)
  const buffer = context.createBuffer(1, len, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const noise = context.createBufferSource()
  noise.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 480
  const noiseGain = context.createGain()
  noiseGain.gain.setValueAtTime(0.06, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
  noise.connect(filter).connect(noiseGain).connect(context.destination)
  noise.start(now)
  noise.stop(now + 0.1)
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
