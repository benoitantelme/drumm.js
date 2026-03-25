/**
 * drumm.js — AudioEngine
 * Phase 3: Web Audio API engine
 *
 * Owns the AudioContext, scheduler, and synth voices.
 * Never touches the DOM — UI calls methods on this class.
 */

export type AudioEngineState = 'uninitialized' | 'running' | 'suspended' | 'closed'

// ── Bass drum synthesiser ────────────────────────────────
// One kick = a sine oscillator with a fast pitch drop (80→30 Hz)
// plus a short noise burst for the attack transient, shaped by
// gain envelopes. No samples — fully synthetic, very lightweight.

const KICK_INTERVAL_S  = 0.667  // ~90 BPM four-on-the-floor (4 beats/bar ÷ 6)
const SCHEDULE_AHEAD_S = 0.1    // how far ahead to schedule (seconds)
const SCHEDULER_TICK_MS = 50    // how often the scheduler runs (ms)
const KICK_VOLUME       = 0.35  // master gain (0–1)

function scheduleKick(ctx: AudioContext, time: number): void {
  const masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(KICK_VOLUME, time)
  masterGain.connect(ctx.destination)

  // ── Pitch sweep oscillator ─────────────────────────────
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(80, time)
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.35)
  oscGain.gain.setValueAtTime(1, time)
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4)
  osc.connect(oscGain)
  oscGain.connect(masterGain)
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
  noiseGain.connect(masterGain)
  noise.start(time)
  noise.stop(time + 0.05)
}

// ── AudioEngine ──────────────────────────────────────────

export class AudioEngine {
  private context:      AudioContext | null = null
  private schedulerTimer: ReturnType<typeof setInterval> | null = null
  private nextKickTime:   number = 0
  private _isPlaying:     boolean = false

  /** Initialise the AudioContext. Must be called from a user gesture. */
  init(): void {
    if (this.context) return
    this.context = new AudioContext()
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

  /** Start the bass-drum loop. */
  async play(): Promise<void> {
    if (!this.context || this._isPlaying) return
    await this.context.resume()
    this._isPlaying = true
    this.nextKickTime = this.context.currentTime

    this.schedulerTimer = setInterval(() => {
      if (!this.context) return
      while (this.nextKickTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
        scheduleKick(this.context, this.nextKickTime)
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
    this.context = null
  }
}
