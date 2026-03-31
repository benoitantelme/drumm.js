/**
 * Tests for fader interaction.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initFaders } from '../components/fader.ts'

describe('initFaders', () => {
  let root: HTMLElement
  let fader: HTMLInputElement

  beforeEach(() => {
    root = document.createElement('div')
    fader = document.createElement('input')
    fader.type = 'range'
    fader.className = 'dm-fader'
    fader.id = 'fader-bass-drum'
    fader.min = '0'
    fader.max = '100'
    fader.value = '70'
    root.appendChild(fader)
    document.body.appendChild(root)
    initFaders(root)
  })

  it('fires dm:fader-change event when value changes', () => {
    const listener = vi.fn()
    root.addEventListener('dm:fader-change', listener)

    fader.value = '80'
    fader.dispatchEvent(new Event('input', { bubbles: true }))

    expect(listener).toHaveBeenCalledOnce()
  })

  it('event detail contains the correct param and value', () => {
    let detail: { param: string; value: number } | null = null
    root.addEventListener('dm:fader-change', (e) => {
      detail = (e as CustomEvent).detail
    })

    fader.value = '42'
    fader.dispatchEvent(new Event('input', { bubbles: true }))

    expect(detail).not.toBeNull()
    expect(detail!.param).toBe('fader-bass-drum')
    expect(detail!.value).toBe(42)
  })

  it('prefers data-param over id in event detail', () => {
    let detail: { param: string; value: number } | null = null
    fader.dataset.param = 'bass-drum'

    root.addEventListener('dm:fader-change', (e) => {
      detail = (e as CustomEvent).detail
    })

    fader.value = '64'
    fader.dispatchEvent(new Event('input', { bubbles: true }))

    expect(detail).not.toBeNull()
    expect(detail!.param).toBe('bass-drum')
    expect(detail!.value).toBe(64)
  })

  it('event bubbles up from the fader', () => {
    const parentListener = vi.fn()
    document.body.addEventListener('dm:fader-change', parentListener)

    fader.value = '55'
    fader.dispatchEvent(new Event('input', { bubbles: true }))

    expect(parentListener).toHaveBeenCalledOnce()
    document.body.removeEventListener('dm:fader-change', parentListener)
  })
})
