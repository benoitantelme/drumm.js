/**
 * drumm.js — main entry point
 * Phase 3: Web Audio API engine wired to machine page
 */

import { AudioEngine, DEFAULT_BPM, BPM_MIN, BPM_MAX } from './AudioEngine.ts'
import { initKnobs } from './components/knob.ts'
import { initFaders } from './components/fader.ts'

interface AppInfo {
  name: string
  version: string
  buildTime: string
}

export const APP: AppInfo = {
  name: 'Drumm.js',
  version: '0.5.0',
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

          <div class="dm-machine__controls">

            <div class="dm-bpm-panel">
              <span class="dm-knob-label">BPM</span>
              <div class="dm-knob dm-knob--bpm" data-param="bpm" role="slider" aria-label="BPM" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                <div class="dm-knob__indicator"></div>
              </div>
              <span class="dm-bpm-value" id="bpm-display">${DEFAULT_BPM}</span>
            </div>

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

            </div><!-- /.dm-instruments -->
          </div><!-- /.dm-machine__controls -->

          <div class="dm-sequencer" id="sequencer">

            <div class="dm-seq-row" id="seq-bass-drum">
              <span class="dm-seq-label">BD</span>
              <div class="dm-seq-steps">
                ${Array.from({ length: 16 }, (_, i) => `<button class="dm-seq-step" data-instrument="bass-drum" data-step="${i}" aria-label="Bass drum step ${i + 1}" aria-pressed="false"></button>`).join('')}
              </div>
            </div>

            <div class="dm-seq-row" id="seq-snare-drum">
              <span class="dm-seq-label">SD</span>
              <div class="dm-seq-steps">
                ${Array.from({ length: 16 }, (_, i) => `<button class="dm-seq-step" data-instrument="snare-drum" data-step="${i}" aria-label="Snare drum step ${i + 1}" aria-pressed="false"></button>`).join('')}
              </div>
            </div>

            <div class="dm-seq-row" id="seq-hi-hat">
              <span class="dm-seq-label">HH</span>
              <div class="dm-seq-steps">
                ${Array.from({ length: 16 }, (_, i) => `<button class="dm-seq-step" data-instrument="hi-hat" data-step="${i}" aria-label="Hi-hat step ${i + 1}" aria-pressed="false"></button>`).join('')}
              </div>
            </div>

          </div><!-- /.dm-sequencer -->

          <div class="dm-machine__footer">
            <div class="dm-transport">
              <button class="dm-play-btn" id="play-btn" aria-label="Play">▶</button>
              <button class="dm-stop-btn" id="stop-btn" aria-label="Stop">■</button>
            </div>
          </div>

        </div><!-- /.dm-machine__stage -->
      </div><!-- /.dm-machine__body -->
    </div><!-- /.dm-machine -->
  `

  // ── Sequencer cursor ─────────────────────────────────────
  // Collect all step buttons grouped by row for fast lookup
  const seqRows: Record<string, NodeListOf<HTMLButtonElement>> = {
    'bass-drum':  root.querySelectorAll<HTMLButtonElement>('#seq-bass-drum .dm-seq-step'),
    'snare-drum': root.querySelectorAll<HTMLButtonElement>('#seq-snare-drum .dm-seq-step'),
    'hi-hat':     root.querySelectorAll<HTMLButtonElement>('#seq-hi-hat .dm-seq-step'),
  }

  // Tell the engine which steps are active for each instrument
  audioEngine.setStepActiveQuery((instrument, step) =>
    seqRows[instrument]?.[step]?.getAttribute('aria-pressed') === 'true'
  )

  function clearCursor(): void {
    root.querySelectorAll('.dm-seq-step--current').forEach(el => {
      el.classList.remove('dm-seq-step--current')
    })
  }

  audioEngine.setOnStep((step: number) => {
    clearCursor()
    for (const row of Object.values(seqRows)) {
      row[step]?.classList.add('dm-seq-step--current')
    }
  })

  root.querySelector<HTMLButtonElement>('#play-btn')!
    .addEventListener('click', () => audioEngine.play())

  root.querySelector<HTMLButtonElement>('#stop-btn')!
    .addEventListener('click', () => {
      audioEngine.stop()
      clearCursor()
    })

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
    if (param === 'bpm') {
      const bpm = Math.round(BPM_MIN + (value / 100) * (BPM_MAX - BPM_MIN))
      audioEngine.setBpm(bpm)
      const display = root.querySelector<HTMLElement>('#bpm-display')
      if (display) display.textContent = String(bpm)
    }
  })
  initFaders(root)

  // Wire sequencer step buttons — toggle active state on click
  root.querySelectorAll<HTMLButtonElement>('.dm-seq-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const active = btn.getAttribute('aria-pressed') === 'true'
      btn.setAttribute('aria-pressed', String(!active))
      btn.classList.toggle('dm-seq-step--on', !active)
    })
  })

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
