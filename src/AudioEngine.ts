/**
 * drumm.js — AudioEngine
 * Phase 3: Web Audio API engine
 *
 * Owns the AudioContext, scheduler, synth voices, and instrument parameters.
 * Never touches the DOM — UI calls methods on this class.
 */

export type AudioEngineState = 'uninitialized' | 'running' | 'suspended' | 'closed'

// ── Bass drum synthesiser ────────────────────────────────

const KICK_INTERVAL_S   = 0.667  // ~90 BPM four-on-the-floor
const SCHEDULE_AHEAD_S  = 0.1    // how far ahead to schedule (seconds)
const SCHEDULER_TICK_MS = 50     // how often the scheduler runs (ms)
const KICK_BASE_VOLUME  = 0.35   // internal synth level (0–1)

// Tune: 0–100 maps the kick start frequency across 40–120 Hz.
// Default 50 → 80 Hz (the original hardcoded value, midpoint of range).
const TUNE_MIN_HZ = 40
const TUNE_MAX_HZ = 120
const SNARE_TUNE_MIN_HZ = 380
const SNARE_TUNE_MAX_HZ = 440

const ENVELOPE_FLOOR = 0.0001
const VOICE_TAIL_S = 0.01

export function tuneToHz(tune: number): number {
  return TUNE_MIN_HZ + (tune / 100) * (TUNE_MAX_HZ - TUNE_MIN_HZ)
}

export function snareTuneToHz(tune: number): number {
  return SNARE_TUNE_MIN_HZ + (tune / 100) * (SNARE_TUNE_MAX_HZ - SNARE_TUNE_MIN_HZ)
}

// Attack: 0–100 maps to 0.003–0.100 s (3 ms → 150 ms).
// At 0 the minimum 3 ms is kept to prevent clicking.
// Default 50 → ~76.5 ms.
const ATTACK_MIN_S = 0.003
const ATTACK_MAX_S = 0.150
const DECAY_MIN_S = 0.050
const DECAY_MAX_S = 0.500
const NOISE_DURATION_S = 0.008
const NOISE_EDGE_FADE_S = 0.002
const NOISE_MIN_GAIN = 0.005
const NOISE_MAX_GAIN = 0.03
const NOISE_HIGHPASS_HZ = 1800
const KICK_END_HZ_MIN = 45
const KICK_END_HZ_MAX = 70

export function attackToSeconds(attack: number): number {
  return ATTACK_MIN_S + (attack / 100) * (ATTACK_MAX_S - ATTACK_MIN_S)
}

export function decayToSeconds(decay: number): number {
  return DECAY_MIN_S + (decay / 100) * (DECAY_MAX_S - DECAY_MIN_S)
}

function attackSecondsToMix(attackS: number): number {
  return Math.max(0, Math.min(1, (attackS - ATTACK_MIN_S) / (ATTACK_MAX_S - ATTACK_MIN_S)))
}

function decaySecondsToMix(decayS: number): number {
  return Math.max(0, Math.min(1, (decayS - DECAY_MIN_S) / (DECAY_MAX_S - DECAY_MIN_S)))
}

function createShapedNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * NOISE_DURATION_S)
  const fadeSamples = Math.max(1, Math.floor(ctx.sampleRate * NOISE_EDGE_FADE_S))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    let amplitude = 1

    if (i < fadeSamples) {
      amplitude = i / fadeSamples
    } else if (i >= bufferSize - fadeSamples) {
      amplitude = (bufferSize - 1 - i) / fadeSamples
    }

    data[i] = (Math.random() * 2 - 1) * Math.max(0, amplitude)
  }

  data[0] = 0
  data[bufferSize - 1] = 0

  return buffer
}

function scheduleKick(
  ctx: AudioContext,
  time: number,
  gainNode: GainNode,
  tuneHz: number,
  attackS: number,
  decayS: number,
): void {
  const envelopeStart = Math.max(time, ctx.currentTime)
  const attackEnd = envelopeStart + attackS
  const decayEnd = attackEnd + decayS
  const oscReleaseEnd = decayEnd
  const noiseRampEnd = envelopeStart + NOISE_EDGE_FADE_S
  const noiseReleaseEnd = envelopeStart + NOISE_DURATION_S
  const attackMix = attackSecondsToMix(attackS)
  const decayMix = decaySecondsToMix(decayS)
  const noisePeakGain = NOISE_MAX_GAIN - ((NOISE_MAX_GAIN - NOISE_MIN_GAIN) * attackMix)
  const kickEndHz = KICK_END_HZ_MAX - ((KICK_END_HZ_MAX - KICK_END_HZ_MIN) * decayMix)

  // ── Pitch sweep oscillator ─────────────────────────────
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(tuneHz, envelopeStart)
  osc.frequency.exponentialRampToValueAtTime(kickEndHz, decayEnd)
  // Hold the gain at silence until the hit starts so scheduled notes do not click.
  oscGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  oscGain.gain.linearRampToValueAtTime(KICK_BASE_VOLUME, attackEnd)
  oscGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, oscReleaseEnd)
  osc.connect(oscGain)
  oscGain.connect(gainNode)
  osc.start(time)
  osc.stop(oscReleaseEnd + VOICE_TAIL_S)

  // ── Noise transient ───────────────────────────────────
  // Noise always uses the minimum ramp — it defines the initial punch
  // character and should not be affected by the attack knob.
  const noise = ctx.createBufferSource()
  noise.buffer = createShapedNoiseBuffer(ctx)
  const noiseFilter = ctx.createBiquadFilter()
  const noiseGain = ctx.createGain()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.setValueAtTime(NOISE_HIGHPASS_HZ, envelopeStart)
  noiseGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  noiseGain.gain.linearRampToValueAtTime(noisePeakGain, noiseRampEnd)
  noiseGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, noiseReleaseEnd)
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(gainNode)
  noise.start(time)
  noise.stop(noiseReleaseEnd + VOICE_TAIL_S)
}

function scheduleSnare(
  ctx: AudioContext,
  time: number,
  gainNode: GainNode,
  tuneHz: number,
  attackS: number,
  decayS: number,
): void {
  const envelopeStart = Math.max(time, ctx.currentTime)
  const attackEnd = envelopeStart + attackS
  const decayEnd = attackEnd + decayS
  const noiseReleaseEnd = envelopeStart + Math.min(0.12, decayS * 0.6 + 0.04)

  const toneOsc = ctx.createOscillator()
  const toneGain = ctx.createGain()
  toneOsc.type = 'triangle'
  toneOsc.frequency.setValueAtTime(tuneHz, envelopeStart)
  toneGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  toneGain.gain.linearRampToValueAtTime(0.18, attackEnd)
  toneGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, decayEnd)
  toneOsc.connect(toneGain)
  toneGain.connect(gainNode)
  toneOsc.start(time)
  toneOsc.stop(decayEnd + VOICE_TAIL_S)

  const noise = ctx.createBufferSource()
  noise.buffer = createShapedNoiseBuffer(ctx)
  const noiseFilter = ctx.createBiquadFilter()
  const noiseGain = ctx.createGain()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.setValueAtTime(2200, envelopeStart)
  noiseGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  noiseGain.gain.linearRampToValueAtTime(0.22, envelopeStart + NOISE_EDGE_FADE_S)
  noiseGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, noiseReleaseEnd)
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(gainNode)
  noise.start(time)
  noise.stop(noiseReleaseEnd + VOICE_TAIL_S)
}

// ── AudioEngine ──────────────────────────────────────────

export class AudioEngine {
  private context:           AudioContext | null = null
  private bassDrumGain:      GainNode | null = null
  private snareDrumGain:     GainNode | null = null
  private bassDrumVolume:    number = 70   // 0–100, mirrors fader default
  private bassDrumTune:      number = 50   // 0–100, default = 80 Hz
  private bassDrumAttack:    number = 0    // 0–100, default = minimum attack
  private schedulerTimer:    ReturnType<typeof setInterval> | null = null
  private nextKickTime:      number = 0
  private _isPlaying:        boolean = false
  private bassDrumDecay:     number = 50
  private snareDrumVolume:   number = 70
  private snareDrumTune:     number = 50
  private snareDrumAttack:   number = 50
  private snareDrumDecay:    number = 50
  private nextSnareTime:     number = 0

  constructor() {
    this.bassDrumAttack = 50
  }

  /** Initialise the AudioContext. Must be called from a user gesture. */
  init(): void {
    if (this.context) return
    this.context = new AudioContext()
    this.bassDrumGain = this.context.createGain()
    this.snareDrumGain = this.context.createGain()
    this.bassDrumGain.gain.value = this.bassDrumVolume / 100
    this.snareDrumGain.gain.value = this.snareDrumVolume / 100
    this.bassDrumGain.connect(this.context.destination)
    this.snareDrumGain.connect(this.context.destination)
  }

  getContext(): AudioContext | null {
    return this.context
  }

  getState(): AudioEngineState {
    if (!this.context) return 'uninitialized'
    return this.context.state as AudioEngineState
  }

  get isPlaying(): boolean {
    return this._isPlaying
  }

  // ── Volume ───────────────────────────────────────────

  setInstrumentVolume(instrument: string, value: number): void {
    if (instrument === 'bass-drum') {
      this.bassDrumVolume = value
      if (this.bassDrumGain) {
        this.bassDrumGain.gain.value = value / 100
      }
    }

    if (instrument === 'snare-drum') {
      this.snareDrumVolume = value
      if (this.snareDrumGain) {
        this.snareDrumGain.gain.value = value / 100
      }
    }
  }

  getInstrumentVolume(instrument: string): number | null {
    if (instrument === 'bass-drum') return this.bassDrumVolume
    if (instrument === 'snare-drum') return this.snareDrumVolume
    return null
  }

  // ── Tune ─────────────────────────────────────────────

  setBassDrumTune(value: number): void {
    this.bassDrumTune = value
  }

  getBassDrumTune(): number {
    return this.bassDrumTune
  }

  // ── Attack ───────────────────────────────────────────

  /** Set bass drum attack. value is 0–100 (knob range). */
  setBassDrumAttack(value: number): void {
    this.bassDrumAttack = value
  }

  getBassDrumAttack(): number {
    return this.bassDrumAttack
  }

  setBassDrumDecay(value: number): void {
    this.bassDrumDecay = value
  }

  getBassDrumDecay(): number {
    return this.bassDrumDecay
  }

  setSnareDrumTune(value: number): void {
    this.snareDrumTune = value
  }

  getSnareDrumTune(): number {
    return this.snareDrumTune
  }

  setSnareDrumAttack(value: number): void {
    this.snareDrumAttack = value
  }

  getSnareDrumAttack(): number {
    return this.snareDrumAttack
  }

  setSnareDrumDecay(value: number): void {
    this.snareDrumDecay = value
  }

  getSnareDrumDecay(): number {
    return this.snareDrumDecay
  }

  // ── Transport ────────────────────────────────────────

  /** Start the bass-drum loop. */
  async play(): Promise<void> {
    if (!this.context || this._isPlaying) return
    await this.context.resume()
    this._isPlaying = true
    this.nextKickTime = this.context.currentTime
    this.nextSnareTime = this.context.currentTime + (KICK_INTERVAL_S / 2)

    this.schedulerTimer = setInterval(() => {
      if (!this.context || !this.bassDrumGain || !this.snareDrumGain) return
      while (this.nextKickTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
        scheduleKick(
          this.context,
          this.nextKickTime,
          this.bassDrumGain,
          tuneToHz(this.bassDrumTune),
          attackToSeconds(this.bassDrumAttack),
          decayToSeconds(this.bassDrumDecay),
        )
        this.nextKickTime += KICK_INTERVAL_S
      }

      while (this.nextSnareTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
        scheduleSnare(
          this.context,
          this.nextSnareTime,
          this.snareDrumGain,
          snareTuneToHz(this.snareDrumTune),
          attackToSeconds(this.snareDrumAttack),
          decayToSeconds(this.snareDrumDecay),
        )
        this.nextSnareTime += KICK_INTERVAL_S
      }
    }, SCHEDULER_TICK_MS)
  }

  /** Stop the loop. Already-scheduled notes will still complete (inaudible). */
  stop(): void {
    if (!this._isPlaying) return
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
    this._isPlaying = false
  }

  async resume(): Promise<void> {
    if (!this.context) return
    await this.context.resume()
  }

  async suspend(): Promise<void> {
    if (!this.context) return
    await this.context.suspend()
  }

  async close(): Promise<void> {
    this.stop()
    if (!this.context) return
    await this.context.close()
    this.bassDrumGain = null
    this.snareDrumGain = null
    this.context = null
  }
}
