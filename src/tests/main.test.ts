import { describe, it, expect, beforeEach } from 'vitest'
import { getLogoHTML, APP, render } from '../main.ts'

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
    root = document.createElement('div')
    document.body.appendChild(root)
    render(root)
  })

  it('starts on the greeting page with a start button', () => {
    expect(root.querySelector('#start-btn')).not.toBeNull()
    expect(root.querySelector('.dm-greeting')).not.toBeNull()
  })

  it('navigates to the machine page when start button is clicked', () => {
    const btn = root.querySelector<HTMLButtonElement>('#start-btn')!
    btn.click()
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
})
