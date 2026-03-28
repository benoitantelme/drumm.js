import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getLogoHTML, APP, render, audioEngine } from '../main.ts'

// ── Mock AudioContext ────────────────────────────────────
// createGain must always return the same shared object so that
// setInstrumentVolume and getInstrumentVolume operate on the same node.
function makeMockAudioContext() {
  const sharedGain = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume:  vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close:   vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn().mockReturnValue(sharedGain),
    createOscillator: vi.fn().mockReturnValue({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    }),
    createBuffer: vi.fn().mockImplementation((_ch: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    })),
    createBiquadFilter: vi.fn().mockReturnValue({
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    }),
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    }),
  }
}

vi.stubGlobal('AudioContext', vi.fn().mockImplementation(makeMockAudioContext))

// ── Tests ────────────────────────────────────────────────
describe('getLogoHTML', () => {
  it('matches the exact expected markup', () => {
    expect(getLogoHTML()).toBe('Drumm<span>.js</span>')
  })
})

describe('APP', () => {
  it('has the correct name', () => {
    expect(APP.name).toBe('Drumm.js')
  })

  it('has a version string', () => {
    expect(APP.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('render', () => {
  let root: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    root = document.createElement('div')
    document.body.appendChild(root)
    render(root)
  })

  afterEach(async () => {
    await audioEngine.close()
    vi.useRealTimers()
  })

  it('starts on the greeting page with a start button', () => {
    expect(root.querySelector('#start-btn')).not.toBeNull()
    expect(root.querySelector('.dm-greeting')).not.toBeNull()
  })

  it('navigates to the machine page when start button is clicked', () => {
    root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    expect(root.querySelector('.dm-machine')).not.toBeNull()
    expect(root.querySelector('#start-btn')).toBeNull()
  })

  it('shows a play button on the machine page', () => {
    root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    expect(root.querySelector('#play-btn')).not.toBeNull()
  })

  it('shows a stop button on the machine page', () => {
    root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    expect(root.querySelector('#stop-btn')).not.toBeNull()
  })

  it('creates an AudioContext when navigating to the machine page', () => {
    expect(audioEngine.getContext()).toBeNull()
    root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    expect(audioEngine.getContext()).not.toBeNull()
  })

  it('starts playing when the play button is clicked', async () => {
    root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    expect(audioEngine.isPlaying).toBe(false)
    await root.querySelector<HTMLButtonElement>('#play-btn')!.click()
    expect(audioEngine.isPlaying).toBe(true)
  })

  it('stops playing when the stop button is clicked', async () => {
    root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    await root.querySelector<HTMLButtonElement>('#play-btn')!.click()
    root.querySelector<HTMLButtonElement>('#stop-btn')!.click()
    expect(audioEngine.isPlaying).toBe(false)
  })

  describe('bass drum instrument panel', () => {
    beforeEach(() => {
      root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    })

    it('renders the bass drum instrument panel', () => {
      expect(root.querySelector('#instrument-bass-drum')).not.toBeNull()
    })

    it('renders exactly three knobs', () => {
      const knobs = root.querySelectorAll('#instrument-bass-drum .dm-knob')
      expect(knobs).toHaveLength(3)
    })

    it('renders a Tune knob', () => {
      expect(root.querySelector('.dm-knob[data-param="tune"]')).not.toBeNull()
    })

    it('renders an Attack knob', () => {
      expect(root.querySelector('.dm-knob[data-param="attack"]')).not.toBeNull()
    })

    it('renders a Decay knob', () => {
      expect(root.querySelector('.dm-knob[data-param="decay"]')).not.toBeNull()
    })

    it('renders the volume fader', () => {
      expect(root.querySelector('#fader-bass-drum')).not.toBeNull()
    })

    it('fader at 42 sets engine volume to 42', () => {
      const fader = root.querySelector<HTMLInputElement>('#fader-bass-drum')!
      fader.value = '42'
      fader.dispatchEvent(new Event('input', { bubbles: true }))
      expect(audioEngine.getInstrumentVolume('bass-drum')).toBe(42)
    })

    it('fader at 0 sets engine volume to 0', () => {
      const fader = root.querySelector<HTMLInputElement>('#fader-bass-drum')!
      fader.value = '0'
      fader.dispatchEvent(new Event('input', { bubbles: true }))
      expect(audioEngine.getInstrumentVolume('bass-drum')).toBe(0)
    })

    it('fader at 100 sets engine volume to 100', () => {
      const fader = root.querySelector<HTMLInputElement>('#fader-bass-drum')!
      fader.value = '100'
      fader.dispatchEvent(new Event('input', { bubbles: true }))
      expect(audioEngine.getInstrumentVolume('bass-drum')).toBe(100)
    })

    it('tune knob defaults to 50 in the engine', () => {
      expect(audioEngine.getBassDrumTune()).toBe(50)
    })

    it('tune knob drag upward increases engine tune', () => {
      const tuneKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="tune"]')!
      const before = audioEngine.getBassDrumTune()
      tuneKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getBassDrumTune()).toBeGreaterThan(before)
    })

    it('tune knob drag downward decreases engine tune', () => {
      const tuneKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="tune"]')!
      const before = audioEngine.getBassDrumTune()
      tuneKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getBassDrumTune()).toBeLessThan(before)
    })

    it('attack knob defaults to 50 in the engine', () => {
      expect(audioEngine.getBassDrumAttack()).toBe(50)
    })

    it('attack knob drag upward increases engine attack', () => {
      const attackKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="attack"]')!
      const before = audioEngine.getBassDrumAttack()
      attackKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getBassDrumAttack()).toBeGreaterThan(before)
    })

    it('attack knob drag downward decreases engine attack', () => {
      audioEngine.setBassDrumAttack(50)
      const attackKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="attack"]')!
      const before = audioEngine.getBassDrumAttack()
      attackKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getBassDrumAttack()).toBeLessThan(before)
    })

    it('decay knob defaults to 50 in the engine', () => {
      expect(audioEngine.getBassDrumDecay()).toBe(50)
    })

    it('decay knob drag upward increases engine decay', () => {
      const decayKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="decay"]')!
      const before = audioEngine.getBassDrumDecay()
      decayKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getBassDrumDecay()).toBeGreaterThan(before)
    })

    it('decay knob drag downward decreases engine decay', () => {
      audioEngine.setBassDrumDecay(50)
      const decayKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="decay"]')!
      const before = audioEngine.getBassDrumDecay()
      decayKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getBassDrumDecay()).toBeLessThan(before)
    })
  })

  describe('snare drum instrument panel', () => {
    beforeEach(() => {
      root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    })

    it('renders the snare drum instrument panel', () => {
      expect(root.querySelector('#instrument-snare-drum')).not.toBeNull()
    })

    it('renders the snare drum volume fader', () => {
      expect(root.querySelector('#fader-snare-drum')).not.toBeNull()
    })

    it('snare fader at 42 sets engine volume to 42', () => {
      const fader = root.querySelector<HTMLInputElement>('#fader-snare-drum')!
      fader.value = '42'
      fader.dispatchEvent(new Event('input', { bubbles: true }))
      expect(audioEngine.getInstrumentVolume('snare-drum')).toBe(42)
    })

    it('snare tune knob drag upward increases engine tune', () => {
      const tuneKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="snare-tune"]')!
      const before = audioEngine.getSnareDrumTune()
      tuneKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getSnareDrumTune()).toBeGreaterThan(before)
    })

    it('snare attack knob drag upward increases engine attack', () => {
      const attackKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="snare-attack"]')!
      const before = audioEngine.getSnareDrumAttack()
      attackKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getSnareDrumAttack()).toBeGreaterThan(before)
    })

    it('snare decay knob drag upward increases engine decay', () => {
      const decayKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="snare-decay"]')!
      const before = audioEngine.getSnareDrumDecay()
      decayKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getSnareDrumDecay()).toBeGreaterThan(before)
    })
  })
})
