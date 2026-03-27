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

export function tuneToHz(tune: number): number {
  return TUNE_MIN_HZ + (tune / 100) * (TUNE_MAX_HZ - TUNE_MIN_HZ)
}

function scheduleKick(
  ctx: AudioContext,
  time: number,
  gainNode: GainNode,
  tuneHz: number,
): void {
  // ── Pitch sweep oscillator ─────────────────────────────
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(tuneHz, time)
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.35)
  oscGain.gain.setValueAtTime(KICK_BASE_VOLUME, time)
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4)
  osc.connect(oscGain)
  oscGain.connect(gainNode)
  osc.start(time)
  osc.stop(time + 0.4)

  // ── Noise transient (attack click) ────────────────────
  const bufferSize = ctx.sampleRate * 0.05
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.3, time)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
  noise.connect(noiseGain)
  noiseGain.connect(gainNode)
  noise.start(time)
  noise.stop(time + 0.05)
}

// ── AudioEngine ──────────────────────────────────────────

export class AudioEngine {
  private context:           AudioContext | null = null
  private bassDrumGain:      GainNode | null = null
  private bassDrumVolume:    number = 70   // 0–100, mirrors fader default
  private bassDrumTune:      number = 50   // 0–100, default = 80 Hz
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

  /** Set bass drum tune. value is 0–100 (knob range). */
  setBassDrumTune(value: number): void {
    this.bassDrumTune = value
  }

  getBassDrumTune(): number {
    return this.bassDrumTune
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
