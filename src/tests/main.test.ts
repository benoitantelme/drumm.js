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
      Q: { value: 1 },
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

  describe('hi-hat instrument panel', () => {
    beforeEach(() => {
      root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    })

    it('renders the hi-hat instrument panel', () => {
      expect(root.querySelector('#instrument-hi-hat')).not.toBeNull()
    })

    it('renders exactly three knobs', () => {
      const knobs = root.querySelectorAll('#instrument-hi-hat .dm-knob')
      expect(knobs).toHaveLength(3)
    })

    it('renders a Tune knob', () => {
      expect(root.querySelector('.dm-knob[data-param="hi-hat-tune"]')).not.toBeNull()
    })

    it('renders an Attack knob', () => {
      expect(root.querySelector('.dm-knob[data-param="hi-hat-attack"]')).not.toBeNull()
    })

    it('renders a Decay knob', () => {
      expect(root.querySelector('.dm-knob[data-param="hi-hat-decay"]')).not.toBeNull()
    })

    it('renders the hi-hat volume fader', () => {
      expect(root.querySelector('#fader-hi-hat')).not.toBeNull()
    })

    it('hi-hat fader at 42 sets engine volume to 42', () => {
      const fader = root.querySelector<HTMLInputElement>('#fader-hi-hat')!
      fader.value = '42'
      fader.dispatchEvent(new Event('input', { bubbles: true }))
      expect(audioEngine.getInstrumentVolume('hi-hat')).toBe(42)
    })

    it('hi-hat fader at 0 sets engine volume to 0', () => {
      const fader = root.querySelector<HTMLInputElement>('#fader-hi-hat')!
      fader.value = '0'
      fader.dispatchEvent(new Event('input', { bubbles: true }))
      expect(audioEngine.getInstrumentVolume('hi-hat')).toBe(0)
    })

    it('hi-hat fader at 100 sets engine volume to 100', () => {
      const fader = root.querySelector<HTMLInputElement>('#fader-hi-hat')!
      fader.value = '100'
      fader.dispatchEvent(new Event('input', { bubbles: true }))
      expect(audioEngine.getInstrumentVolume('hi-hat')).toBe(100)
    })

    it('hi-hat tune knob defaults to 50 in the engine', () => {
      expect(audioEngine.getHiHatTune()).toBe(50)
    })

    it('hi-hat tune knob drag upward increases engine tune', () => {
      const tuneKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="hi-hat-tune"]')!
      const before = audioEngine.getHiHatTune()
      tuneKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getHiHatTune()).toBeGreaterThan(before)
    })

    it('hi-hat tune knob drag downward decreases engine tune', () => {
      const tuneKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="hi-hat-tune"]')!
      const before = audioEngine.getHiHatTune()
      tuneKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getHiHatTune()).toBeLessThan(before)
    })

    it('hi-hat attack knob defaults to 50 in the engine', () => {
      expect(audioEngine.getHiHatAttack()).toBe(50)
    })

    it('hi-hat attack knob drag upward increases engine attack', () => {
      const attackKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="hi-hat-attack"]')!
      const before = audioEngine.getHiHatAttack()
      attackKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getHiHatAttack()).toBeGreaterThan(before)
    })

    it('hi-hat decay knob defaults to 50 in the engine', () => {
      expect(audioEngine.getHiHatDecay()).toBe(50)
    })

    it('hi-hat decay knob drag upward increases engine decay', () => {
      const decayKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="hi-hat-decay"]')!
      const before = audioEngine.getHiHatDecay()
      decayKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getHiHatDecay()).toBeGreaterThan(before)
    })

    it('hi-hat decay knob drag downward decreases engine decay', () => {
      audioEngine.setHiHatDecay(50)
      const decayKnob = root.querySelector<HTMLElement>('.dm-knob[data-param="hi-hat-decay"]')!
      const before = audioEngine.getHiHatDecay()
      decayKnob.dispatchEvent(new MouseEvent('mousedown', { clientY: 50, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(audioEngine.getHiHatDecay()).toBeLessThan(before)
    })
  })

  describe('BPM knob', () => {
    beforeEach(() => {
      root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    })

    it('renders the BPM knob', () => {
      expect(root.querySelector('.dm-knob[data-param="bpm"]')).not.toBeNull()
    })

    it('renders the BPM display with the default value', () => {
      const display = root.querySelector<HTMLElement>('#bpm-display')
      expect(display).not.toBeNull()
      expect(display!.textContent).toBe('90')
    })

    it('engine BPM defaults to 90', () => {
      expect(audioEngine.getBpm()).toBe(90)
    })

    it('dragging the BPM knob upward increases the engine BPM', () => {
      const knob = root.querySelector<HTMLElement>('.dm-knob[data-param="bpm"]')!
      const before = audioEngine.getBpm()
      knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50,  bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      expect(audioEngine.getBpm()).toBeGreaterThan(before)
    })

    it('dragging the BPM knob downward decreases the engine BPM', () => {
      const knob = root.querySelector<HTMLElement>('.dm-knob[data-param="bpm"]')!
      const before = audioEngine.getBpm()
      knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 50,  bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      expect(audioEngine.getBpm()).toBeLessThan(before)
    })

    it('dragging the BPM knob updates the display label', () => {
      const knob = root.querySelector<HTMLElement>('.dm-knob[data-param="bpm"]')!
      const display = root.querySelector<HTMLElement>('#bpm-display')!
      knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50,  bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      expect(display.textContent).not.toBe('90')
      expect(Number(display.textContent)).toBeGreaterThan(90)
    })

    it('BPM display shows an integer', () => {
      const knob = root.querySelector<HTMLElement>('.dm-knob[data-param="bpm"]')!
      knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 60,  bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      const display = root.querySelector<HTMLElement>('#bpm-display')!
      expect(Number.isInteger(Number(display.textContent))).toBe(true)
    })

    it('engine BPM never goes below 60', () => {
      const knob = root.querySelector<HTMLElement>('.dm-knob[data-param="bpm"]')!
      knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 0,   bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 999, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      expect(audioEngine.getBpm()).toBeGreaterThanOrEqual(60)
    })

    it('engine BPM never exceeds 180', () => {
      const knob = root.querySelector<HTMLElement>('.dm-knob[data-param="bpm"]')!
      knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 999, bubbles: true }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 0,   bubbles: true }))
      window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))
      expect(audioEngine.getBpm()).toBeLessThanOrEqual(180)
    })

    it('setBpm(60) sets exactly 60', () => {
      audioEngine.setBpm(60)
      expect(audioEngine.getBpm()).toBe(60)
    })

    it('setBpm(180) sets exactly 180', () => {
      audioEngine.setBpm(180)
      expect(audioEngine.getBpm()).toBe(180)
    })

    it('setBpm below 60 is clamped to 60', () => {
      audioEngine.setBpm(0)
      expect(audioEngine.getBpm()).toBe(60)
    })

    it('setBpm above 180 is clamped to 180', () => {
      audioEngine.setBpm(999)
      expect(audioEngine.getBpm()).toBe(180)
    })
  })

  describe('sequencer', () => {
    beforeEach(() => {
      root.querySelector<HTMLButtonElement>('#start-btn')!.click()
    })

    // ── Structure ──────────────────────────────────────────

    it('renders the sequencer section', () => {
      expect(root.querySelector('#sequencer')).not.toBeNull()
    })

    it('renders a row for the bass drum', () => {
      expect(root.querySelector('#seq-bass-drum')).not.toBeNull()
    })

    it('renders a row for the snare drum', () => {
      expect(root.querySelector('#seq-snare-drum')).not.toBeNull()
    })

    it('renders a row for the hi-hat', () => {
      expect(root.querySelector('#seq-hi-hat')).not.toBeNull()
    })

    it('each row has exactly 16 step buttons', () => {
      for (const rowId of ['#seq-bass-drum', '#seq-snare-drum', '#seq-hi-hat']) {
        const steps = root.querySelectorAll(`${rowId} .dm-seq-step`)
        expect(steps).toHaveLength(16)
      }
    })

    it('renders 48 step buttons in total (3 × 16)', () => {
      expect(root.querySelectorAll('.dm-seq-step')).toHaveLength(48)
    })

    // ── Initial state ──────────────────────────────────────

    it('all steps start inactive (aria-pressed="false")', () => {
      const steps = root.querySelectorAll<HTMLButtonElement>('.dm-seq-step')
      steps.forEach(step => {
        expect(step.getAttribute('aria-pressed')).toBe('false')
      })
    })

    it('no step starts with the --on class', () => {
      expect(root.querySelectorAll('.dm-seq-step--on')).toHaveLength(0)
    })

    // ── Step attributes ────────────────────────────────────

    it('each bass-drum step carries the correct data-instrument', () => {
      root.querySelectorAll('#seq-bass-drum .dm-seq-step').forEach(btn => {
        expect(btn.getAttribute('data-instrument')).toBe('bass-drum')
      })
    })

    it('each snare-drum step carries the correct data-instrument', () => {
      root.querySelectorAll('#seq-snare-drum .dm-seq-step').forEach(btn => {
        expect(btn.getAttribute('data-instrument')).toBe('snare-drum')
      })
    })

    it('each hi-hat step carries the correct data-instrument', () => {
      root.querySelectorAll('#seq-hi-hat .dm-seq-step').forEach(btn => {
        expect(btn.getAttribute('data-instrument')).toBe('hi-hat')
      })
    })

    it('steps are numbered 0–15 via data-step', () => {
      const steps = root.querySelectorAll('#seq-bass-drum .dm-seq-step')
      steps.forEach((btn, i) => {
        expect(btn.getAttribute('data-step')).toBe(String(i))
      })
    })

    // ── Toggle behaviour ───────────────────────────────────

    it('clicking an inactive step activates it', () => {
      const step = root.querySelector<HTMLButtonElement>('#seq-bass-drum .dm-seq-step')!
      step.click()
      expect(step.getAttribute('aria-pressed')).toBe('true')
      expect(step.classList.contains('dm-seq-step--on')).toBe(true)
    })

    it('clicking an active step deactivates it', () => {
      const step = root.querySelector<HTMLButtonElement>('#seq-bass-drum .dm-seq-step')!
      step.click()
      step.click()
      expect(step.getAttribute('aria-pressed')).toBe('false')
      expect(step.classList.contains('dm-seq-step--on')).toBe(false)
    })

    it('toggling one step does not affect its neighbours', () => {
      const steps = root.querySelectorAll<HTMLButtonElement>('#seq-bass-drum .dm-seq-step')
      steps[0].click()
      expect(steps[1].getAttribute('aria-pressed')).toBe('false')
      expect(steps[2].getAttribute('aria-pressed')).toBe('false')
    })

    it('steps in different rows are independent', () => {
      const bdStep = root.querySelector<HTMLButtonElement>('#seq-bass-drum .dm-seq-step')!
      const sdStep = root.querySelector<HTMLButtonElement>('#seq-snare-drum .dm-seq-step')!
      bdStep.click()
      expect(sdStep.getAttribute('aria-pressed')).toBe('false')
    })

    it('multiple steps in the same row can be active simultaneously', () => {
      const steps = root.querySelectorAll<HTMLButtonElement>('#seq-hi-hat .dm-seq-step')
      steps[0].click()
      steps[4].click()
      steps[8].click()
      expect(steps[0].getAttribute('aria-pressed')).toBe('true')
      expect(steps[4].getAttribute('aria-pressed')).toBe('true')
      expect(steps[8].getAttribute('aria-pressed')).toBe('true')
    })
  })
})
