/**
 * drumm.js — Knob interaction
 * Handles mouse and touch drag to rotate knobs.
 *
 * Range: -135deg (min=0) to +135deg (max=100), total 270deg sweep.
 */

const MIN_ANGLE = -135
const MAX_ANGLE =  135
const DRAG_PX_PER_DEG = 1.5  // pixels of vertical drag per degree of rotation

function valueToAngle(value: number): number {
  return MIN_ANGLE + (value / 100) * (MAX_ANGLE - MIN_ANGLE)
}

function angleToValue(angle: number): number {
  return Math.round((angle - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE) * 100)
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function setKnobAngle(knob: HTMLElement, angle: number): void {
  knob.style.setProperty('--knob-angle', `${angle}deg`)
  knob.setAttribute('aria-valuenow', String(angleToValue(angle)))
}

function initKnob(knob: HTMLElement): void {
  // Read initial value from aria attribute
  const initialValue = parseInt(knob.getAttribute('aria-valuenow') ?? '50', 10)
  let currentAngle = valueToAngle(initialValue)
  setKnobAngle(knob, currentAngle)

  let dragStartY = 0
  let dragStartAngle = 0

  // ── Mouse ──────────────────────────────────────────────
  function onMouseMove(e: MouseEvent): void {
    const delta = dragStartY - e.clientY          // up = positive
    const newAngle = clamp(
      dragStartAngle + delta / DRAG_PX_PER_DEG,
      MIN_ANGLE,
      MAX_ANGLE
    )
    currentAngle = newAngle
    setKnobAngle(knob, currentAngle)
  }

  function onMouseUp(): void {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    knob.style.cursor = ''
  }

  knob.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault()
    dragStartY = e.clientY
    dragStartAngle = currentAngle
    document.body.style.cursor = 'ns-resize'
    knob.style.cursor = 'ns-resize'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  })

  // ── Touch ──────────────────────────────────────────────
  function onTouchMove(e: TouchEvent): void {
    e.preventDefault()
    const touch = e.touches[0]
    const delta = dragStartY - touch.clientY
    const newAngle = clamp(
      dragStartAngle + delta / DRAG_PX_PER_DEG,
      MIN_ANGLE,
      MAX_ANGLE
    )
    currentAngle = newAngle
    setKnobAngle(knob, currentAngle)
  }

  function onTouchEnd(): void {
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
  }

  knob.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault()
    dragStartY = e.touches[0].clientY
    dragStartAngle = currentAngle
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
  }, { passive: false })

  // ── Keyboard (accessibility) ───────────────────────────
  knob.addEventListener('keydown', (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      currentAngle = clamp(currentAngle + step * (270 / 100), MIN_ANGLE, MAX_ANGLE)
      setKnobAngle(knob, currentAngle)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      currentAngle = clamp(currentAngle - step * (270 / 100), MIN_ANGLE, MAX_ANGLE)
      setKnobAngle(knob, currentAngle)
    }
  })
}

/** Attach drag behaviour to all .dm-knob elements inside a root element. */
export function initKnobs(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.dm-knob').forEach(initKnob)
}
