/**
 * drumm.js — Fader interaction
 * Wraps the native <input type="range"> vertical fader.
 * Fires a custom "dm:fader-change" event with { param, value } on change.
 */

export interface FaderChangeDetail {
  param: string
  value: number  // 0–100
}

function initFader(fader: HTMLInputElement): void {
  fader.addEventListener('input', () => {
    const param = fader.dataset.param ?? fader.id
    const value = Number(fader.value)
    fader.dispatchEvent(
      new CustomEvent<FaderChangeDetail>('dm:fader-change', {
        bubbles: true,
        detail: { param, value },
      })
    )
  })
}

/** Attach change behaviour to all .dm-fader elements inside a root element. */
export function initFaders(root: HTMLElement): void {
  root.querySelectorAll<HTMLInputElement>('.dm-fader').forEach(initFader)
}
