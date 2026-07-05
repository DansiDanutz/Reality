/**
 * Reality's voice — tiny synthesized chimes, no audio files.
 * gold = money (warm major arpeggio up), sky = progress (bright ping),
 * ok = neutral confirmation (soft single note).
 */

let ctx: AudioContext | null = null
/** Master gain — all tones route through here so volume is centrally controllable. */
let masterGain: GainNode | null = null
/** Current volume 0..1, persisted by the store. Defaults to 1 (full). */
let volume = 1

function ensureContext(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext()
      masterGain = ctx.createGain()
      masterGain.gain.value = volume
      masterGain.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/**
 * Set the master volume (0..1). Persisted by the store; applied live so an
 * in-flight chime responds to a slider drag. Safe to call before any sound
 * has played (the gain node is created lazily in ensureContext).
 */
export function setSoundVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v))
  if (masterGain && ctx) {
    masterGain.gain.setValueAtTime(volume, ctx.currentTime)
  }
}

/** Current volume 0..1 — the store reads this on load to hydrate the slider. */
export function getSoundVolume(): number {
  return volume
}

function tone(context: AudioContext, freq: number, start: number, duration: number, peak: number) {
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  // Route through the master gain (volume control) instead of destination.
  osc.connect(gain)
  if (masterGain) gain.connect(masterGain)
  else gain.connect(context.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

/** The output node — master gain if initialized, else the raw destination. */
function out(context: AudioContext): AudioNode {
  return masterGain ?? context.destination
}

const PATTERNS: Record<ChimeKind, { freqs: number[]; step: number; dur: number; peak: number }> = {
  gold: { freqs: [523.25, 659.25, 783.99], step: 0.07, dur: 0.28, peak: 0.05 }, // C5-E5-G5
  sky: { freqs: [880, 1174.66], step: 0.09, dur: 0.22, peak: 0.045 }, // A5-D6
  ok: { freqs: [587.33], step: 0, dur: 0.18, peak: 0.035 }, // D5
  // "Meal cooked" — a warm major-third dyad an octave below the purchase
  // chime, with a slightly longer settle. Reads as "food's ready, come eat"
  // rather than the bright ka-ching of spending money (issue #30).
  meal: { freqs: [392.0, 523.25], step: 0.1, dur: 0.34, peak: 0.05 }, // G4-C5
  // Achievement unlock — a triumphant 4-note major arpeggio climbing to a
  // high tonic. Longer and brighter than gold (money); this is THE reward
  // sound. Distinct enough that the player learns "that one means I won".
  achieve: { freqs: [523.25, 659.25, 783.99, 1046.5], step: 0.08, dur: 0.42, peak: 0.055 }, // C5-E5-G5-C6
  // Streak flame — warm and sustaining, a perfect-fifth dyad with a slow
  // swell. Reads as "the fire continues" rather than a one-shot win.
  streak: { freqs: [659.25, 987.77], step: 0.12, dur: 0.5, peak: 0.045 }, // E5-B5
  // Lucky moment — a magical shimmer, three high notes falling like coins
  // from the sky. Distinct from the triumphant achieve chord; this is
  // serendipity, not earned.
  lucky: { freqs: [1318.51, 1567.98, 1318.51], step: 0.06, dur: 0.32, peak: 0.05 }, // E6-G6-E6
  // Legendary — the jackpot. A full triumphant 5-note fanfare climbing past
  // two octaves, louder and longer than anything else. The player should
  // instinctively look up when this plays.
  legendary: { freqs: [523.25, 659.25, 783.99, 1046.5, 1318.51], step: 0.09, dur: 0.6, peak: 0.065 }, // C5-E5-G5-C6-E6
  // Blocked — a soft low double-buzz. The "you can't do that" sound, distinct
  // from any positive chime. Lower octave, descending, short — communicates
  // "no" without being harsh.
  blocked: { freqs: [311.13, 261.63], step: 0.1, dur: 0.22, peak: 0.04 }, // Eb4-C4
}

export type ChimeKind = 'gold' | 'sky' | 'ok' | 'meal' | 'achieve' | 'streak' | 'lucky' | 'legendary' | 'blocked'

export function playChime(kind: ChimeKind): void {
  const context = ensureContext()
  if (!context) return
  const p = PATTERNS[kind]
  const now = context.currentTime
  p.freqs.forEach((f, i) => tone(context, f, now + i * p.step, p.dur, p.peak))
}

/**
 * A footstep — a very short, soft, low filtered-noise tick. Quieter and
 * shorter than the jump-landing thud (which is the same family of sound);
 * this is the rhythm of walking, not the punctuation of landing. Plays once
 * per bob-cycle via the StreetMode onStep hook.
 */
export function playFootstep(): void {
  const context = ensureContext()
  if (!context) return
  const now = context.currentTime
  // 40ms of decaying noise through a low-pass — the "shoe meets pavement" tick.
  const len = Math.floor(context.sampleRate * 0.04)
  const buffer = context.createBuffer(1, len, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const noise = context.createBufferSource()
  noise.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 380
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.025, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
  noise.connect(filter).connect(gain).connect(out(context))
  noise.start(now)
  noise.stop(now + 0.06)
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
  osc.connect(oscGain).connect(out(context))
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
  noise.connect(filter).connect(noiseGain).connect(out(context))
  noise.start(now)
  noise.stop(now + 0.1)
}

// ── Street ambience: a soft city hum, fully synthesized, day/night aware ──
let ambience: { gain: GainNode; source: AudioBufferSourceNode } | null = null
let ambienceNight = false // tracks which mode is currently playing

export function startAmbience(night = false): void {
  const context = ensureContext()
  if (!context) return
  // If already playing in the requested mode, no-op. If playing in the other
  // mode, restart with the new shaping (day ↔ night transition).
  if (ambience && ambienceNight === night) return
  if (ambience) stopAmbience()
  ambienceNight = night
  // 2s of gentle brown noise, looped through a low-pass — distant city air.
  // Day: slightly brighter cutoff (480Hz — more "city air", distant traffic)
  // and a touch louder. Night: deeper cutoff (320Hz — rumble, stillness).
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
  filter.frequency.value = night ? 320 : 480
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, context.currentTime)
  gain.gain.linearRampToValueAtTime(night ? 0.05 : 0.065, context.currentTime + 1.2)
  source.connect(filter).connect(gain).connect(out(context))
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

/**
 * A distant one-shot ambient event — a faint siren, a dog bark, a distant
 * horn. Played probabilistically by StreetMode to make the world feel alive
 * beyond the visual. Each call picks one randomly. Very quiet (0.02 peak)
 * and low-passed so it reads as "far away", not "in your ear".
 */
const AMBIENT_ONE_SHOTS: { freq: number; type: OscillatorType; dur: number; slide: number }[] = [
  { freq: 880, type: 'sine', dur: 1.4, slide: 1.18 },     // siren rising
  { freq: 1046, type: 'sine', dur: 1.2, slide: 0.85 },     // siren falling
  { freq: 180, type: 'sawtooth', dur: 0.3, slide: 0.7 },   // dog bark (low)
  { freq: 220, type: 'triangle', dur: 0.8, slide: 0.6 },   // distant horn
]

export function playAmbientOneShot(): void {
  const context = ensureContext()
  if (!context) return
  const shot = AMBIENT_ONE_SHOTS[Math.floor(Math.random() * AMBIENT_ONE_SHOTS.length)]
  const now = context.currentTime
  const osc = context.createOscillator()
  const gain = context.createGain()
  const filter = context.createBiquadFilter()
  osc.type = shot.type
  osc.frequency.setValueAtTime(shot.freq, now)
  osc.frequency.exponentialRampToValueAtTime(shot.freq * shot.slide, now + shot.dur)
  filter.type = 'lowpass'
  filter.frequency.value = 600 // muffled — far away
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.02, now + 0.15) // fade in
  gain.gain.exponentialRampToValueAtTime(0.0001, now + shot.dur)
  osc.connect(filter).connect(gain).connect(out(context))
  osc.start(now)
  osc.stop(now + shot.dur + 0.05)
}
