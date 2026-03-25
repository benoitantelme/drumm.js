import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioEngine } from '../AudioEngine.ts'

// jsdom does not ship AudioContext — provide a minimal mock
const mockResume  = vi.fn().mockResolvedValue(undefined)
const mockSuspend = vi.fn().mockResolvedValue(undefined)
const mockClose   = vi.fn().mockResolvedValue(undefined)

class MockAudioContext {
  state: string = 'running'
  resume  = mockResume
  suspend = mockSuspend
  close   = mockClose
}

vi.stubGlobal('AudioContext', MockAudioContext)

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    engine = new AudioEngine()
    vi.clearAllMocks()
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
})
