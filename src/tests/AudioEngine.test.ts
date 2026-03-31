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
  DEFAULT_BPM,
  BPM_MIN,
  BPM_MAX,
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
  private readonly _startMs: number = Date.now()
  get currentTime(): number { return (Date.now() - this._startMs) / 1000 }
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
  createBufferSource = vi.fn().mockReturnValue(
    { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  )
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

  it('schedules a bass drum hit at the correct audio time when step is active', async () => {
    engine.init()
    const context = engine.getContext() as unknown as MockAudioContext

    // Activate step 0 for bass-drum so the scheduler fires it
    engine.setStepActiveQuery((instrument, step) =>
      instrument === 'bass-drum' && step === 0
    )

    await engine.play()
    vi.advanceTimersByTime(50)

    // oscGain and noiseGain are createGain calls 3 and 4 (after the 3 master gains)
    const createdGains = context.createGain.mock.results.map((result) => result.value)
    const oscGain = createdGains[3]
    const noiseGain = createdGains[4]

    expect(oscGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0.05)
    expect(noiseGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0.05)
  })

  it('does not schedule any instruments when no steps are active', async () => {
    engine.init()
    const context = engine.getContext() as unknown as MockAudioContext

    engine.setStepActiveQuery(() => false)
    await engine.play()
    vi.advanceTimersByTime(500)

    // Only the 3 master gain nodes should have been created (no instrument voices)
    expect(context.createGain.mock.calls.length).toBe(3)
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
    it('maps 0 to 150 Hz', () => {
      expect(snareTuneToHz(0)).toBe(150)
    })

    it('maps 100 to 280 Hz', () => {
      expect(snareTuneToHz(100)).toBe(280)
    })

    it('maps 50 to 215 Hz', () => {
      expect(snareTuneToHz(50)).toBe(215)
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

  describe('BPM constants', () => {
    it('BPM_MIN is 60', () => {
      expect(BPM_MIN).toBe(60)
    })

    it('BPM_MAX is 180', () => {
      expect(BPM_MAX).toBe(180)
    })

    it('DEFAULT_BPM is within the allowed range', () => {
      expect(DEFAULT_BPM).toBeGreaterThanOrEqual(BPM_MIN)
      expect(DEFAULT_BPM).toBeLessThanOrEqual(BPM_MAX)
    })
  })

  describe('getBpm / setBpm', () => {
    it('defaults to DEFAULT_BPM (90)', () => {
      expect(engine.getBpm()).toBe(90)
    })

    it('sets an arbitrary value within range', () => {
      engine.setBpm(120)
      expect(engine.getBpm()).toBe(120)
    })

    it('sets the minimum boundary value 60', () => {
      engine.setBpm(60)
      expect(engine.getBpm()).toBe(60)
    })

    it('sets the maximum boundary value 180', () => {
      engine.setBpm(180)
      expect(engine.getBpm()).toBe(180)
    })

    it('clamps values below 60 to 60', () => {
      engine.setBpm(0)
      expect(engine.getBpm()).toBe(60)
    })

    it('clamps values above 180 to 180', () => {
      engine.setBpm(999)
      expect(engine.getBpm()).toBe(180)
    })

    it('clamps negative values to 60', () => {
      engine.setBpm(-50)
      expect(engine.getBpm()).toBe(60)
    })

    it('accepts a mid-range value like 90', () => {
      engine.setBpm(90)
      expect(engine.getBpm()).toBe(90)
    })
  })

  describe('step sequencer cursor', () => {
    it('getCurrentStep starts at 0', () => {
      engine.init()
      expect(engine.getCurrentStep()).toBe(0)
    })

    it('onStep callback fires when a step is scheduled', async () => {
      engine.init()
      const cb = vi.fn()
      engine.setOnStep(cb)
      await engine.play()
      vi.advanceTimersByTime(50)
      expect(cb).toHaveBeenCalled()
    })

    it('onStep callback is called with step 0 first', async () => {
      engine.init()
      const steps: number[] = []
      engine.setOnStep(s => steps.push(s))
      await engine.play()
      vi.advanceTimersByTime(50)
      expect(steps[0]).toBe(0)
    })

    it('step increments by 1 on each sixteenth note', async () => {
      engine.init()
      const steps: number[] = []
      engine.setOnStep(s => steps.push(s))
      await engine.play()
      // At 90 BPM a step (sixteenth note) is ~167ms; advance 500ms → ~3 steps
      vi.advanceTimersByTime(500)
      expect(steps.length).toBeGreaterThan(1)
      // Each consecutive step is exactly 1 more than the previous (mod 16)
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]).toBe((steps[i - 1] + 1) % 16)
      }
    })

    it('step wraps back to 0 after step 15', async () => {
      engine.init()
      const steps: number[] = []
      engine.setOnStep(s => steps.push(s))
      await engine.play()
      // 17 steps at 90 BPM ≈ 2.84s; advance 3s to guarantee a full wrap
      vi.advanceTimersByTime(3000)
      expect(steps).toContain(0)
      expect(steps).toContain(15)
      const wrapIndex = steps.indexOf(0, 1)   // first wrap back to 0
      expect(wrapIndex).toBeGreaterThan(-1)
      expect(steps[wrapIndex - 1]).toBe(15)
    })

    it('getCurrentStep resets to 0 after stop()', async () => {
      engine.init()
      await engine.play()
      vi.advanceTimersByTime(500)
      engine.stop()
      expect(engine.getCurrentStep()).toBe(0)
    })

    it('onStep is not called after stop()', async () => {
      engine.init()
      const cb = vi.fn()
      engine.setOnStep(cb)
      await engine.play()
      vi.advanceTimersByTime(50)
      engine.stop()
      const callsBeforeStop = cb.mock.calls.length
      vi.advanceTimersByTime(500)
      expect(cb.mock.calls.length).toBe(callsBeforeStop)
    })

    it('setOnStep(null) removes the callback', async () => {
      engine.init()
      const cb = vi.fn()
      engine.setOnStep(cb)
      engine.setOnStep(null)
      await engine.play()
      vi.advanceTimersByTime(500)
      expect(cb).not.toHaveBeenCalled()
    })

    it('restarts from step 0 after stop then play', async () => {
      engine.init()
      const steps: number[] = []
      engine.setOnStep(s => steps.push(s))

      // Play for a while, then stop
      await engine.play()
      vi.advanceTimersByTime(500)
      engine.stop()
      steps.length = 0   // clear recorded steps

      // Restart and capture the first step fired
      await engine.play()
      vi.advanceTimersByTime(50)
      expect(steps[0]).toBe(0)
    })

    it('schedules an instrument when its step query returns true', async () => {
      engine.init()
      const context = engine.getContext() as unknown as MockAudioContext

      engine.setStepActiveQuery((instrument, step) =>
        instrument === 'hi-hat' && step === 0
      )
      await engine.play()
      vi.advanceTimersByTime(50)

      // hi-hat uses createBufferSource; if it fired, one source was created
      expect(context.createBufferSource).toHaveBeenCalled()
    })

    it('does not schedule an instrument when its step query returns false', async () => {
      engine.init()
      const context = engine.getContext() as unknown as MockAudioContext

      engine.setStepActiveQuery(() => false)
      await engine.play()
      vi.advanceTimersByTime(500)

      // No instrument voices created beyond the 3 master gain nodes
      expect(context.createGain.mock.calls.length).toBe(3)
    })

    it('setStepActiveQuery(null) means no instruments fire', async () => {
      engine.init()
      const context = engine.getContext() as unknown as MockAudioContext

      engine.setStepActiveQuery(null)
      await engine.play()
      vi.advanceTimersByTime(500)

      expect(context.createGain.mock.calls.length).toBe(3)
    })
  })
})
