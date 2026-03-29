import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AudioEngine,
  tuneToHz,
  snareTuneToHz,
  hiHatTuneToHz,
  attackToSeconds,
  decayToSeconds,
  hiHatAttackToSeconds,
  hiHatDecayToSeconds,
} from '../AudioEngine.ts'

// ── Mock AudioContext ────────────────────────────────────
// GainNode mock tracks .gain.value so volume tests can read it back.
function makeMockGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
}

const mockResume  = vi.fn().mockResolvedValue(undefined)
const mockSuspend = vi.fn().mockResolvedValue(undefined)
const mockClose   = vi.fn().mockResolvedValue(undefined)

class MockAudioContext {
  state: string = 'running'
  currentTime: number = 0
  sampleRate: number = 44100
  destination = {}
  resume  = mockResume
  suspend = mockSuspend
  close   = mockClose
  createGain   = vi.fn().mockImplementation(makeMockGainNode)
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
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn() },
      Q: { value: 1 },
      connect: vi.fn(),
    }
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

  it('anchors future note envelopes to the scheduled hit time', async () => {
    engine.init()
    const context = engine.getContext() as unknown as MockAudioContext

    await engine.play()
    ;(engine as any).nextKickTime = 0.05
    vi.advanceTimersByTime(50)

    const createdGains = context.createGain.mock.results.map((result) => result.value)
    const oscGain = createdGains[3]
    const noiseGain = createdGains[4]

    expect(oscGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0.05)
    expect(noiseGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0.05)
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

  describe('instrument volume', () => {
    it('returns default 70 before init()', () => {
      expect(engine.getInstrumentVolume('bass-drum')).toBe(70)
    })

    it('defaults to 70 after init() matching fader default', () => {
      engine.init()
      expect(engine.getInstrumentVolume('bass-drum')).toBe(70)
    })

    it('sets bass-drum volume to 0', () => {
      engine.init()
      engine.setInstrumentVolume('bass-drum', 0)
      expect(engine.getInstrumentVolume('bass-drum')).toBe(0)
    })

    it('sets bass-drum volume to 100', () => {
      engine.init()
      engine.setInstrumentVolume('bass-drum', 100)
      expect(engine.getInstrumentVolume('bass-drum')).toBe(100)
    })

    it('sets bass-drum volume to an arbitrary value', () => {
      engine.init()
      engine.setInstrumentVolume('bass-drum', 42)
      expect(engine.getInstrumentVolume('bass-drum')).toBe(42)
    })

    it('ignores unknown instrument names', () => {
      engine.init()
      expect(() => engine.setInstrumentVolume('snare', 50)).not.toThrow()
    })

    it('sets snare-drum volume to an arbitrary value', () => {
      engine.init()
      engine.setInstrumentVolume('snare-drum', 37)
      expect(engine.getInstrumentVolume('snare-drum')).toBe(37)
    })

    it('sets hi-hat volume to an arbitrary value', () => {
      engine.init()
      engine.setInstrumentVolume('hi-hat', 55)
      expect(engine.getInstrumentVolume('hi-hat')).toBe(55)
    })

    it('hi-hat volume defaults to 70', () => {
      expect(engine.getInstrumentVolume('hi-hat')).toBe(70)
    })

    it('sets hi-hat volume to 0', () => {
      engine.init()
      engine.setInstrumentVolume('hi-hat', 0)
      expect(engine.getInstrumentVolume('hi-hat')).toBe(0)
    })

    it('sets hi-hat volume to 100', () => {
      engine.init()
      engine.setInstrumentVolume('hi-hat', 100)
      expect(engine.getInstrumentVolume('hi-hat')).toBe(100)
    })
  })

  describe('bass drum tune', () => {
    it('defaults to 50', () => {
      expect(engine.getBassDrumTune()).toBe(50)
    })

    it('sets tune to an arbitrary value', () => {
      engine.setBassDrumTune(75)
      expect(engine.getBassDrumTune()).toBe(75)
    })

    it('sets tune to 0', () => {
      engine.setBassDrumTune(0)
      expect(engine.getBassDrumTune()).toBe(0)
    })

    it('sets tune to 100', () => {
      engine.setBassDrumTune(100)
      expect(engine.getBassDrumTune()).toBe(100)
    })
  })

  describe('tuneToHz', () => {
    it('maps 0 to 40 Hz', () => {
      expect(tuneToHz(0)).toBe(40)
    })

    it('maps 100 to 120 Hz', () => {
      expect(tuneToHz(100)).toBe(120)
    })

    it('maps 50 to 80 Hz (original default)', () => {
      expect(tuneToHz(50)).toBe(80)
    })
  })

  describe('snareTuneToHz', () => {
    it('maps 0 to 380 Hz', () => {
      expect(snareTuneToHz(0)).toBe(380)
    })

    it('maps 100 to 440 Hz', () => {
      expect(snareTuneToHz(100)).toBe(440)
    })

    it('maps 50 to 410 Hz', () => {
      expect(snareTuneToHz(50)).toBe(410)
    })
  })

  describe('hiHatTuneToHz', () => {
    it('maps 0 to 6000 Hz', () => {
      expect(hiHatTuneToHz(0)).toBe(6000)
    })

    it('maps 100 to 12000 Hz', () => {
      expect(hiHatTuneToHz(100)).toBe(12000)
    })

    it('maps 50 to 9000 Hz', () => {
      expect(hiHatTuneToHz(50)).toBe(9000)
    })
  })

  describe('bass drum attack', () => {
    it('defaults to 50', () => {
      expect(engine.getBassDrumAttack()).toBe(50)
    })

    it('sets attack to an arbitrary value', () => {
      engine.setBassDrumAttack(60)
      expect(engine.getBassDrumAttack()).toBe(60)
    })

    it('sets attack to 0', () => {
      engine.setBassDrumAttack(0)
      expect(engine.getBassDrumAttack()).toBe(0)
    })

    it('sets attack to 100', () => {
      engine.setBassDrumAttack(100)
      expect(engine.getBassDrumAttack()).toBe(100)
    })
  })

  describe('bass drum decay', () => {
    it('defaults to 50', () => {
      expect(engine.getBassDrumDecay()).toBe(50)
    })

    it('sets decay to an arbitrary value', () => {
      engine.setBassDrumDecay(60)
      expect(engine.getBassDrumDecay()).toBe(60)
    })

    it('sets decay to 0', () => {
      engine.setBassDrumDecay(0)
      expect(engine.getBassDrumDecay()).toBe(0)
    })

    it('sets decay to 100', () => {
      engine.setBassDrumDecay(100)
      expect(engine.getBassDrumDecay()).toBe(100)
    })
  })

  describe('snare drum controls', () => {
    it('defaults snare tune to 50', () => {
      expect(engine.getSnareDrumTune()).toBe(50)
    })

    it('defaults snare attack to 50', () => {
      expect(engine.getSnareDrumAttack()).toBe(50)
    })

    it('defaults snare decay to 50', () => {
      expect(engine.getSnareDrumDecay()).toBe(50)
    })

    it('sets snare tune', () => {
      engine.setSnareDrumTune(75)
      expect(engine.getSnareDrumTune()).toBe(75)
    })

    it('sets snare attack', () => {
      engine.setSnareDrumAttack(25)
      expect(engine.getSnareDrumAttack()).toBe(25)
    })

    it('sets snare decay', () => {
      engine.setSnareDrumDecay(80)
      expect(engine.getSnareDrumDecay()).toBe(80)
    })
  })

  describe('hi-hat controls', () => {
    it('defaults hi-hat tune to 50', () => {
      expect(engine.getHiHatTune()).toBe(50)
    })

    it('defaults hi-hat attack to 50', () => {
      expect(engine.getHiHatAttack()).toBe(50)
    })

    it('defaults hi-hat decay to 50', () => {
      expect(engine.getHiHatDecay()).toBe(50)
    })

    it('sets hi-hat tune', () => {
      engine.setHiHatTune(80)
      expect(engine.getHiHatTune()).toBe(80)
    })

    it('sets hi-hat tune to 0', () => {
      engine.setHiHatTune(0)
      expect(engine.getHiHatTune()).toBe(0)
    })

    it('sets hi-hat tune to 100', () => {
      engine.setHiHatTune(100)
      expect(engine.getHiHatTune()).toBe(100)
    })

    it('sets hi-hat attack', () => {
      engine.setHiHatAttack(25)
      expect(engine.getHiHatAttack()).toBe(25)
    })

    it('sets hi-hat attack to 0', () => {
      engine.setHiHatAttack(0)
      expect(engine.getHiHatAttack()).toBe(0)
    })

    it('sets hi-hat attack to 100', () => {
      engine.setHiHatAttack(100)
      expect(engine.getHiHatAttack()).toBe(100)
    })

    it('sets hi-hat decay', () => {
      engine.setHiHatDecay(60)
      expect(engine.getHiHatDecay()).toBe(60)
    })

    it('sets hi-hat decay to 0', () => {
      engine.setHiHatDecay(0)
      expect(engine.getHiHatDecay()).toBe(0)
    })

    it('sets hi-hat decay to 100', () => {
      engine.setHiHatDecay(100)
      expect(engine.getHiHatDecay()).toBe(100)
    })
  })

  describe('attackToSeconds', () => {
    it('maps 0 to minimum 0.003 s', () => {
      expect(attackToSeconds(0)).toBeCloseTo(0.003)
    })

    it('maps 100 to maximum 0.060 s', () => {
      expect(attackToSeconds(100)).toBeCloseTo(0.150)
    })

    it('maps 50 to midpoint ~0.0315 s', () => {
      expect(attackToSeconds(50)).toBeCloseTo(0.0765)
    })

    it('always returns a value >= minimum to prevent clicking', () => {
      expect(attackToSeconds(0)).toBeGreaterThanOrEqual(0.003)
    })
  })

  describe('decayToSeconds', () => {
    it('maps 0 to minimum 0.010 s', () => {
      expect(decayToSeconds(0)).toBeCloseTo(0.05)
    })

    it('maps 100 to maximum 0.300 s', () => {
      expect(decayToSeconds(100)).toBeCloseTo(0.500)
    })

    it('maps 50 to midpoint 0.155 s', () => {
      expect(decayToSeconds(50)).toBeCloseTo(0.275)
    })

    it('always returns a value >= minimum', () => {
      expect(decayToSeconds(0)).toBeGreaterThanOrEqual(0.05)
    })
  })

  describe('hiHatAttackToSeconds', () => {
    it('maps 0 to minimum 0.001 s', () => {
      expect(hiHatAttackToSeconds(0)).toBeCloseTo(0.001)
    })

    it('maps 100 to maximum 0.020 s', () => {
      expect(hiHatAttackToSeconds(100)).toBeCloseTo(0.020)
    })

    it('maps 50 to midpoint ~0.0105 s', () => {
      expect(hiHatAttackToSeconds(50)).toBeCloseTo(0.0105)
    })

    it('always returns a value >= minimum', () => {
      expect(hiHatAttackToSeconds(0)).toBeGreaterThanOrEqual(0.001)
    })
  })

  describe('hiHatDecayToSeconds', () => {
    it('maps 0 to minimum 0.020 s', () => {
      expect(hiHatDecayToSeconds(0)).toBeCloseTo(0.020)
    })

    it('maps 100 to maximum 0.200 s', () => {
      expect(hiHatDecayToSeconds(100)).toBeCloseTo(0.200)
    })

    it('maps 50 to midpoint ~0.110 s', () => {
      expect(hiHatDecayToSeconds(50)).toBeCloseTo(0.110)
    })

    it('always returns a value >= minimum', () => {
      expect(hiHatDecayToSeconds(0)).toBeGreaterThanOrEqual(0.020)
    })
  })
})
