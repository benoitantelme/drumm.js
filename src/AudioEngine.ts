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

const ENVELOPE_FLOOR = 0.0001
const VOICE_TAIL_S = 0.01

export function tuneToHz(tune: number): number {
  return TUNE_MIN_HZ + (tune / 100) * (TUNE_MAX_HZ - TUNE_MIN_HZ)
}

// Attack: 0–100 maps to 0.003–0.100 s (3 ms → 150 ms).
// At 0 the minimum 3 ms is kept to prevent clicking.
// Default 50 → ~76.5 ms.
const ATTACK_MIN_S = 0.003
const ATTACK_MAX_S = 0.150
const NOISE_DURATION_S = 0.012
const NOISE_EDGE_FADE_S = 0.002
const NOISE_PEAK_GAIN = 0.08
const NOISE_HIGHPASS_HZ = 1800

export function attackToSeconds(attack: number): number {
  return ATTACK_MIN_S + (attack / 100) * (ATTACK_MAX_S - ATTACK_MIN_S)
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
): void {
  const envelopeStart = Math.max(time, ctx.currentTime)
  const attackEnd = envelopeStart + attackS
  const oscReleaseEnd = envelopeStart + 0.4
  const noiseRampEnd = envelopeStart + NOISE_EDGE_FADE_S
  const noiseReleaseEnd = envelopeStart + NOISE_DURATION_S

  // ── Pitch sweep oscillator ─────────────────────────────
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(tuneHz, envelopeStart)
  osc.frequency.exponentialRampToValueAtTime(30, envelopeStart + 0.35)
  // Hold the gain at silence until the hit starts so scheduled notes do not click.
  oscGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  oscGain.gain.exponentialRampToValueAtTime(KICK_BASE_VOLUME, attackEnd)
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
  noiseGain.gain.exponentialRampToValueAtTime(NOISE_PEAK_GAIN, noiseRampEnd)
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
  private bassDrumVolume:    number = 70   // 0–100, mirrors fader default
  private bassDrumTune:      number = 50   // 0–100, default = 80 Hz
  private bassDrumAttack:    number = 0    // 0–100, default = minimum attack
  private schedulerTimer:    ReturnType<typeof setInterval> | null = null
  private nextKickTime:      number = 0
  private _isPlaying:        boolean = false

  /** Initialise the AudioContext. Must be called from a user gesture. */
  init(): void {
    if (this.context) return
    this.context = new AudioContext()
    this.bassDrumGain = this.context.createGain()
    this.bassDrumGain.gain.value = this.bassDrumVolume / 100
    this.bassDrumGain.connect(this.context.destination)
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
    if (instrument !== 'bass-drum') return
    this.bassDrumVolume = value
    if (this.bassDrumGain) {
      this.bassDrumGain.gain.value = value / 100
    }
  }

  getInstrumentVolume(instrument: string): number | null {
    if (instrument !== 'bass-drum') return null
    return this.bassDrumVolume
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

  // ── Transport ────────────────────────────────────────

  /** Start the bass-drum loop. */
  async play(): Promise<void> {
    if (!this.context || this._isPlaying) return
    await this.context.resume()
    this._isPlaying = true
    this.nextKickTime = this.context.currentTime

    this.schedulerTimer = setInterval(() => {
      if (!this.context || !this.bassDrumGain) return
      while (this.nextKickTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
        scheduleKick(
          this.context,
          this.nextKickTime,
          this.bassDrumGain,
          tuneToHz(this.bassDrumTune),
          attackToSeconds(this.bassDrumAttack),
        )
        this.nextKickTime += KICK_INTERVAL_S
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
    this.context = null
  }
}
