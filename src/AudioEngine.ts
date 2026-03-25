/**
 * drumm.js — AudioEngine
 * Phase 3: Web Audio API engine
 *
 * Owns the AudioContext and exposes lifecycle methods.
 * Never touches the DOM — UI calls methods on this class.
 */

export type AudioEngineState = 'uninitialized' | 'running' | 'suspended' | 'closed'

export class AudioEngine {
  private context: AudioContext | null = null

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

  async resume(): Promise<void> {
    if (!this.context) return
    await this.context.resume()
  }

  async suspend(): Promise<void> {
    if (!this.context) return
    await this.context.suspend()
  }

  async close(): Promise<void> {
    if (!this.context) return
    await this.context.close()
    this.context = null
  }
}
