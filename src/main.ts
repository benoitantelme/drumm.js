/**
 * drumm.js — main entry point
 * Phase 3: Web Audio API engine wired to machine page
 */

import { AudioEngine } from './AudioEngine.ts'
import { initKnobs } from './knob.ts'
import { initFaders } from './fader.ts'

interface AppInfo {
  name: string
  version: string
  buildTime: string
}

export const APP: AppInfo = {
  name: 'Drumm.js',
  version: '0.1.0',
  buildTime: new Date().toISOString(),
}

export const audioEngine = new AudioEngine()

export function getLogoHTML(): string {
  return `Drumm<span>.js</span>`
}

// ── Views ────────────────────────────────────────────────

function detectPlatform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Firefox/i.test(ua)) return 'Firefox'
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari'
  if (/Edg/i.test(ua)) return 'Edge'
  return 'Chromium'
}

function renderGreeting(root: HTMLElement): void {
  const platform = detectPlatform()

  root.innerHTML = /* html */ `
    <div class="dm-greeting">
      <div class="dm-greeting__logo">
        ${getLogoHTML()}
      </div>
      <p class="dm-greeting__sub">a drum machine for the browser</p>
      <button class="dm-start-btn" id="start-btn" aria-label="Start drum machine">
        START
      </button>
      <span class="dm-version">v${APP.version}</span>
      <div class="dm-greeting__info">
        <p class="dm-greeting__info-text">
          Welcome to the drum machine project.<br />
          Running on <strong>${platform}</strong>.<br />
          Instruments, sequencer, and audio engine coming next.
        </p>
        <div class="dm-badges">
          <span class="dm-badge">TypeScript</span>
          <span class="dm-badge">Vite</span>
          <span class="dm-badge">GitHub Pages</span>
          <span class="dm-badge">Web Audio API</span>
          <span class="dm-badge">Responsive</span>
        </div>
      </div>
    </div>
  `

  root.querySelector<HTMLButtonElement>('#start-btn')!
    .addEventListener('click', () => renderMachine(root))
}

function renderMachine(root: HTMLElement): void {
  // Initialise the AudioContext — must happen inside a user gesture (the
  // START button click), which is why it lives here and not at module level.
  audioEngine.init()

  root.innerHTML = /* html */ `
    <div class="dm-machine">
      <div class="dm-machine__body">
        <header class="dm-machine__header">
          <div class="dm-logo">${getLogoHTML()}</div>
          <span class="dm-version">v${APP.version}</span>
        </header>
        <div class="dm-machine__stage">

          <div class="dm-instruments">
            <div class="dm-instrument" id="instrument-bass-drum">
              <div class="dm-instrument__panel">

                <div class="dm-knob-row">
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Tune</span>
                    <div class="dm-knob" data-param="tune" role="slider" aria-label="Tune" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Attack</span>
                    <div class="dm-knob" data-param="attack" role="slider" aria-label="Attack" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Decay</span>
                    <div class="dm-knob" data-param="decay" role="slider" aria-label="Decay" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                </div>

                <div class="dm-fader-row">
                  <div class="dm-fader-group">
                    <input class="dm-fader" id="fader-bass-drum" type="range" min="0" max="100" value="70" orient="vertical" aria-label="Bass drum volume" />
                  </div>
                </div>

              </div>
              <span class="dm-instrument__label">Bass Drum</span>
            </div>

            <div class="dm-instrument" id="instrument-snare-drum">
              <div class="dm-instrument__panel">

                <div class="dm-knob-row">
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Tune</span>
                    <div class="dm-knob" data-param="snare-tune" role="slider" aria-label="Snare tune" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Attack</span>
                    <div class="dm-knob" data-param="snare-attack" role="slider" aria-label="Snare attack" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Decay</span>
                    <div class="dm-knob" data-param="snare-decay" role="slider" aria-label="Snare decay" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                </div>

                <div class="dm-fader-row">
                  <div class="dm-fader-group">
                    <input class="dm-fader" id="fader-snare-drum" type="range" min="0" max="100" value="70" orient="vertical" aria-label="Snare drum volume" />
                  </div>
                </div>

              </div>
              <span class="dm-instrument__label">Snare Drum</span>
            </div>

            <div class="dm-instrument" id="instrument-hi-hat">
              <div class="dm-instrument__panel">

                <div class="dm-knob-row">
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Tune</span>
                    <div class="dm-knob" data-param="hi-hat-tune" role="slider" aria-label="Hi-hat tune" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Attack</span>
                    <div class="dm-knob" data-param="hi-hat-attack" role="slider" aria-label="Hi-hat attack" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                  <div class="dm-knob-group">
                    <span class="dm-knob-label">Decay</span>
                    <div class="dm-knob" data-param="hi-hat-decay" role="slider" aria-label="Hi-hat decay" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                      <div class="dm-knob__indicator"></div>
                    </div>
                  </div>
                </div>

                <div class="dm-fader-row">
                  <div class="dm-fader-group">
                    <input class="dm-fader" id="fader-hi-hat" type="range" min="0" max="100" value="70" orient="vertical" aria-label="Hi-hat volume" />
                  </div>
                </div>

              </div>
              <span class="dm-instrument__label">Hi-Hat</span>
            </div>
          </div>

          <div class="dm-machine__footer">
            <div class="dm-transport">
              <button class="dm-play-btn" id="play-btn" aria-label="Play">▶</button>
              <button class="dm-stop-btn" id="stop-btn" aria-label="Stop">■</button>
            </div>
            <span class="dm-machine__placeholder">instruments &amp; sequencer coming soon</span>
          </div>

        </div>
      </div>
    </div>
  `

  root.querySelector<HTMLButtonElement>('#play-btn')!
    .addEventListener('click', () => audioEngine.play())

  root.querySelector<HTMLButtonElement>('#stop-btn')!
    .addEventListener('click', () => audioEngine.stop())

  initKnobs(root, (param, value) => {
    if (param === 'tune')   audioEngine.setBassDrumTune(value)
    if (param === 'attack') audioEngine.setBassDrumAttack(value)
    if (param === 'decay')  audioEngine.setBassDrumDecay(value)
    if (param === 'snare-tune')   audioEngine.setSnareDrumTune(value)
    if (param === 'snare-attack') audioEngine.setSnareDrumAttack(value)
    if (param === 'snare-decay')  audioEngine.setSnareDrumDecay(value)
    if (param === 'hi-hat-tune')   audioEngine.setHiHatTune(value)
    if (param === 'hi-hat-attack') audioEngine.setHiHatAttack(value)
    if (param === 'hi-hat-decay')  audioEngine.setHiHatDecay(value)
  })
  initFaders(root)

  // Wire fader directly → engine volume
  const bassDrumFaderEl = root.querySelector<HTMLInputElement>('#fader-bass-drum')
  if (bassDrumFaderEl) {
    bassDrumFaderEl.addEventListener('input', () => {
      audioEngine.setInstrumentVolume('bass-drum', Number(bassDrumFaderEl.value))
    })
  }

  const snareDrumFaderEl = root.querySelector<HTMLInputElement>('#fader-snare-drum')
  if (snareDrumFaderEl) {
    snareDrumFaderEl.addEventListener('input', () => {
      audioEngine.setInstrumentVolume('snare-drum', Number(snareDrumFaderEl.value))
    })
  }

  const hiHatFaderEl = root.querySelector<HTMLInputElement>('#fader-hi-hat')
  if (hiHatFaderEl) {
    hiHatFaderEl.addEventListener('input', () => {
      audioEngine.setInstrumentVolume('hi-hat', Number(hiHatFaderEl.value))
    })
  }
}

/** Public entry point — renders the greeting view into the given root element. */
export function render(root: HTMLElement): void {
  renderGreeting(root)
}

// ── Boot — only runs in a browser context, not during tests ──
if (typeof document !== 'undefined') {
  const appRoot = document.getElementById('app')
  if (appRoot) {
    renderGreeting(appRoot)
  } else {
    console.error('[drumm.js] #app root element not found')
  }

  console.info(`%c${APP.name} %cv${APP.version}`,
    'font-weight:bold;color:#e85d04;',
    'color:#5a5a5a;'
  )
}
