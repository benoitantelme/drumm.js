import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioEngine } from '../AudioEngine.ts'

// ── Mock AudioContext ────────────────────────────────────
const mockResume  = vi.fn().mockResolvedValue(undefined)
const mockSuspend = vi.fn().mockResolvedValue(undefined)
const mockClose   = vi.fn().mockResolvedValue(undefined)

class MockAudioContext {
  state: string = 'running'
  currentTime: number = 0
  sampleRate: number = 44100
  resume  = mockResume
  suspend = mockSuspend
  close   = mockClose
  destination = {}
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    }
  }
  createBuffer(_ch: number, length: number, _rate: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  }
}

vi.stubGlobal('AudioContext', MockAudioContext)

// ── Tests ────────────────────────────────────────────────
describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    engine = new AudioEngine()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(async () => {
    await engine.close()
    vi.useRealTimers()
  })

  it('starts uninitialized', () => {
    expect(engine.getState()).toBe('uninitialized')
    expect(engine.getContext()).toBeNull()
  })

  it('creates an AudioContext when init() is called', () => {
    engine.init()
    expect(engine.getContext()).not.toBeNull()
    expect(engine.getState()).toBe('running')
  })

  it('does not create a second context if init() is called twice', () => {
    engine.init()
    const first = engine.getContext()
    engine.init()
    expect(engine.getContext()).toBe(first)
  })

  it('calls resume on the context', async () => {
    engine.init()
    await engine.resume()
    expect(mockResume).toHaveBeenCalledOnce()
  })

  it('calls suspend on the context', async () => {
    engine.init()
    await engine.suspend()
    expect(mockSuspend).toHaveBeenCalledOnce()
  })

  it('isPlaying is false before play() is called', () => {
    engine.init()
    expect(engine.isPlaying).toBe(false)
  })

  it('isPlaying is true after play() is called', async () => {
    engine.init()
    await engine.play()
    expect(engine.isPlaying).toBe(true)
  })

  it('isPlaying is false after stop() is called', async () => {
    engine.init()
    await engine.play()
    engine.stop()
    expect(engine.isPlaying).toBe(false)
  })

  it('stop() is a no-op when not playing', () => {
    engine.init()
    expect(() => engine.stop()).not.toThrow()
    expect(engine.isPlaying).toBe(false)
  })
})
