/**
 * drumm.js — AudioEngine
 * Phase 3: Web Audio API engine
 *
 * Owns the AudioContext, scheduler, synth voices, and instrument parameters.
 * Never touches the DOM — UI calls methods on this class.
 */

import { scheduleBassDrum, tuneToHz } from './instruments/BassDrum.ts'
import { scheduleSnareDrum, snareTuneToHz } from './instruments/SnareDrum.ts'
import { scheduleHiHat, hiHatTuneToHz } from './instruments/HiHat.ts'

export { tuneToHz } from './instruments/BassDrum.ts'
export { snareTuneToHz } from './instruments/SnareDrum.ts'
export { hiHatTuneToHz } from './instruments/HiHat.ts'

export type AudioEngineState = 'uninitialized' | 'running' | 'suspended' | 'closed'

export const DEFAULT_BPM = 90
export const BPM_MIN = 60
export const BPM_MAX = 180
const SCHEDULE_AHEAD_S = 0.1
const SCHEDULER_TICK_MS = 50
const ATTACK_MIN_S = 0.003
const ATTACK_MAX_S = 0.150
const DECAY_MIN_S = 0.050
const DECAY_MAX_S = 0.500
const HIHAT_ATTACK_MIN_S = 0.001
const HIHAT_ATTACK_MAX_S = 0.020
const HIHAT_DECAY_MIN_S = 0.020
const HIHAT_DECAY_MAX_S = 0.200

export function attackToSeconds(attack: number): number {
  return ATTACK_MIN_S + (attack / 100) * (ATTACK_MAX_S - ATTACK_MIN_S)
}

export function decayToSeconds(decay: number): number {
  return DECAY_MIN_S + (decay / 100) * (DECAY_MAX_S - DECAY_MIN_S)
}

export function hiHatAttackToSeconds(attack: number): number {
  return HIHAT_ATTACK_MIN_S + (attack / 100) * (HIHAT_ATTACK_MAX_S - HIHAT_ATTACK_MIN_S)
}

export function hiHatDecayToSeconds(decay: number): number {
  return HIHAT_DECAY_MIN_S + (decay / 100) * (HIHAT_DECAY_MAX_S - HIHAT_DECAY_MIN_S)
}

export class AudioEngine {
  private context: AudioContext | null = null
  private bassDrumGain: GainNode | null = null
  private snareDrumGain: GainNode | null = null
  private hiHatGain: GainNode | null = null
  private bassDrumVolume = 70
  private bassDrumTune = 50
  private bassDrumAttack = 50
  private bassDrumDecay = 50
  private snareDrumVolume = 70
  private snareDrumTune = 50
  private snareDrumAttack = 50
  private snareDrumDecay = 50
  private hiHatVolume = 70
  private hiHatTune = 50
  private hiHatAttack = 50
  private hiHatDecay = 50
  private _bpm = DEFAULT_BPM
  private schedulerTimer: ReturnType<typeof setInterval> | null = null
  private nextKickTime = 0
  private nextSnareTime = 0
  private nextHiHatTime = 0
  private _isPlaying = false

  init(): void {
    if (this.context) return
    this.context = new AudioContext()
    this.bassDrumGain = this.context.createGain()
    this.snareDrumGain = this.context.createGain()
    this.hiHatGain = this.context.createGain()
    this.bassDrumGain.gain.value = this.bassDrumVolume / 100
    this.snareDrumGain.gain.value = this.snareDrumVolume / 100
    this.hiHatGain.gain.value = this.hiHatVolume / 100
    this.bassDrumGain.connect(this.context.destination)
    this.snareDrumGain.connect(this.context.destination)
    this.hiHatGain.connect(this.context.destination)
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

  setInstrumentVolume(instrument: string, value: number): void {
    if (instrument === 'bass-drum') {
      this.bassDrumVolume = value
      if (this.bassDrumGain) this.bassDrumGain.gain.value = value / 100
    }

    if (instrument === 'snare-drum') {
      this.snareDrumVolume = value
      if (this.snareDrumGain) this.snareDrumGain.gain.value = value / 100
    }

    if (instrument === 'hi-hat') {
      this.hiHatVolume = value
      if (this.hiHatGain) this.hiHatGain.gain.value = value / 100
    }
  }

  getInstrumentVolume(instrument: string): number | null {
    if (instrument === 'bass-drum') return this.bassDrumVolume
    if (instrument === 'snare-drum') return this.snareDrumVolume
    if (instrument === 'hi-hat') return this.hiHatVolume
    return null
  }

  setBassDrumTune(value: number): void { this.bassDrumTune = value }
  getBassDrumTune(): number { return this.bassDrumTune }

  setBassDrumAttack(value: number): void { this.bassDrumAttack = value }
  getBassDrumAttack(): number { return this.bassDrumAttack }

  setBassDrumDecay(value: number): void { this.bassDrumDecay = value }
  getBassDrumDecay(): number { return this.bassDrumDecay }

  setSnareDrumTune(value: number): void { this.snareDrumTune = value }
  getSnareDrumTune(): number { return this.snareDrumTune }

  setSnareDrumAttack(value: number): void { this.snareDrumAttack = value }
  getSnareDrumAttack(): number { return this.snareDrumAttack }

  setSnareDrumDecay(value: number): void { this.snareDrumDecay = value }
  getSnareDrumDecay(): number { return this.snareDrumDecay }

  setHiHatTune(value: number): void { this.hiHatTune = value }
  getHiHatTune(): number { return this.hiHatTune }

  setHiHatAttack(value: number): void { this.hiHatAttack = value }
  getHiHatAttack(): number { return this.hiHatAttack }

  setHiHatDecay(value: number): void { this.hiHatDecay = value }
  getHiHatDecay(): number { return this.hiHatDecay }

  async play(): Promise<void> {
    if (!this.context || this._isPlaying) return
    await this.context.resume()
    this._isPlaying = true
    this.nextKickTime = this.context.currentTime
    this.nextSnareTime = this.context.currentTime + (60 / this._bpm) / 2
    // Hi-hat plays on every eighth note (twice per beat interval)
    this.nextHiHatTime = this.context.currentTime

    this.schedulerTimer = setInterval(() => {
      if (!this.context || !this.bassDrumGain || !this.snareDrumGain || !this.hiHatGain) return
      const beatS = 60 / this._bpm

      while (this.nextKickTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
        scheduleBassDrum(
          this.context,
          this.nextKickTime,
          this.bassDrumGain,
          tuneToHz(this.bassDrumTune),
          attackToSeconds(this.bassDrumAttack),
          decayToSeconds(this.bassDrumDecay),
        )
        this.nextKickTime += beatS
      }

      while (this.nextSnareTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
        scheduleSnareDrum(
          this.context,
          this.nextSnareTime,
          this.snareDrumGain,
          snareTuneToHz(this.snareDrumTune),
          attackToSeconds(this.snareDrumAttack),
          decayToSeconds(this.snareDrumDecay),
        )
        this.nextSnareTime += beatS
      }

      while (this.nextHiHatTime < this.context.currentTime + SCHEDULE_AHEAD_S) {
        scheduleHiHat(
          this.context,
          this.nextHiHatTime,
          this.hiHatGain,
          hiHatTuneToHz(this.hiHatTune),
          hiHatAttackToSeconds(this.hiHatAttack),
          hiHatDecayToSeconds(this.hiHatDecay),
        )
        this.nextHiHatTime += beatS / 2
      }
    }, SCHEDULER_TICK_MS)
  }

  getBpm(): number { return this._bpm }
  setBpm(value: number): void { this._bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, value)) }

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
    this.hiHatGain = null
    this.context = null
  }
}
