/**
 * Tests for knob interaction and pure helper functions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { initKnobs, valueToAngle, angleToValue } from '../components/knob.ts'

// ── Pure helper tests ────────────────────────────────────

describe('valueToAngle', () => {
  it('maps 0 to -135deg', () => {
    expect(valueToAngle(0)).toBe(-135)
  })

  it('maps 100 to +135deg', () => {
    expect(valueToAngle(100)).toBe(135)
  })

  it('maps 50 to 0deg', () => {
    expect(valueToAngle(50)).toBe(0)
  })
})

describe('angleToValue', () => {
  it('maps -135deg to 0', () => {
    expect(angleToValue(-135)).toBe(0)
  })

  it('maps +135deg to 100', () => {
    expect(angleToValue(135)).toBe(100)
  })

  it('maps 0deg to 50', () => {
    expect(angleToValue(0)).toBe(50)
  })
})

// ── DOM interaction tests ────────────────────────────────

describe('initKnobs', () => {
  let root: HTMLElement
  let knob: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    knob = document.createElement('div')
    knob.className = 'dm-knob'
    knob.setAttribute('aria-valuenow', '50')
    knob.setAttribute('aria-valuemin', '0')
    knob.setAttribute('aria-valuemax', '100')
    knob.setAttribute('tabindex', '0')
    root.appendChild(knob)
    document.body.appendChild(root)
    initKnobs(root)
  })

  it('sets the initial --knob-angle from aria-valuenow', () => {
    expect(knob.style.getPropertyValue('--knob-angle')).toBe('0deg')
  })

  it('falls back to 50 when aria-valuenow is invalid', () => {
    const invalidRoot = document.createElement('div')
    const invalidKnob = document.createElement('div')
    invalidKnob.className = 'dm-knob'
    invalidKnob.setAttribute('aria-valuenow', 'not-a-number')
    invalidKnob.setAttribute('aria-valuemin', '0')
    invalidKnob.setAttribute('aria-valuemax', '100')
    invalidKnob.setAttribute('tabindex', '0')
    invalidRoot.appendChild(invalidKnob)
    document.body.appendChild(invalidRoot)

    initKnobs(invalidRoot)

    expect(invalidKnob.style.getPropertyValue('--knob-angle')).toBe('0deg')
    expect(invalidKnob.getAttribute('aria-valuenow')).toBe('50')
  })

  it('rotates clockwise when dragging upward (mouse)', () => {
    const before = knob.style.getPropertyValue('--knob-angle')

    knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50,  bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))

    const after = knob.style.getPropertyValue('--knob-angle')
    const angleBefore = parseFloat(before)
    const angleAfter  = parseFloat(after)
    expect(angleAfter).toBeGreaterThan(angleBefore)
  })

  it('rotates counter-clockwise when dragging downward (mouse)', () => {
    const before = parseFloat(knob.style.getPropertyValue('--knob-angle'))

    knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 50,  bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))

    const after = parseFloat(knob.style.getPropertyValue('--knob-angle'))
    expect(after).toBeLessThan(before)
  })

  it('clamps at max (+135deg) when dragged far up', () => {
    knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 500, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 0,   bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))

    const angle = parseFloat(knob.style.getPropertyValue('--knob-angle'))
    expect(angle).toBe(135)
  })

  it('clamps at min (-135deg) when dragged far down', () => {
    knob.dispatchEvent(new MouseEvent('mousedown', { clientY: 0,   bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 500, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }))

    const angle = parseFloat(knob.style.getPropertyValue('--knob-angle'))
    expect(angle).toBe(-135)
  })

  it('increases value with ArrowUp key', () => {
    const before = parseInt(knob.getAttribute('aria-valuenow') ?? '50', 10)
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    const after = parseInt(knob.getAttribute('aria-valuenow') ?? '50', 10)
    expect(after).toBeGreaterThan(before)
  })

  it('decreases value with ArrowDown key', () => {
    const before = parseInt(knob.getAttribute('aria-valuenow') ?? '50', 10)
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    const after = parseInt(knob.getAttribute('aria-valuenow') ?? '50', 10)
    expect(after).toBeLessThan(before)
  })
})
