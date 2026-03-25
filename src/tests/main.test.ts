import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getLogoHTML, APP, render, audioEngine } from '../main.ts'

// ── Mock AudioContext ────────────────────────────────────
class MockAudioContext {
  state: string = 'running'
  currentTime: number = 0
  sampleRate: number = 44100
  destination = {}
  resume  = vi.fn().mockResolvedValue(undefined)
  suspend = vi.fn().mockResolvedValue(undefined)
  close   = vi.fn().mockResolvedValue(undefined)
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
})
