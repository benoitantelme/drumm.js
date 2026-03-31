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

type InstrumentId = 'bass-drum' | 'snare-drum' | 'hi-hat'
type KnobParam =
  | 'tune'
  | 'attack'
  | 'decay'
  | 'snare-tune'
  | 'snare-attack'
  | 'snare-decay'
  | 'hi-hat-tune'
  | 'hi-hat-attack'
  | 'hi-hat-decay'
  | 'bpm'

interface InstrumentConfig {
  id: InstrumentId
  label: string
  shortLabel: string
  domId: string
  faderId: string
  faderLabel: string
  knobs: Array<{
    label: string
    param: Exclude<KnobParam, 'bpm'>
    ariaLabel: string
  }>
}

interface FaderChangeDetail {
  param: string
  value: number
}

const BPM_KNOB = {
  param: 'bpm' as const,
  ariaLabel: 'BPM',
  initialValue: 25,
}

const INSTRUMENTS: InstrumentConfig[] = [
  {
    id: 'bass-drum',
    label: 'Bass Drum',
    shortLabel: 'BD',
    domId: 'instrument-bass-drum',
    faderId: 'fader-bass-drum',
    faderLabel: 'Bass drum volume',
    knobs: [
      { label: 'Tune', param: 'tune', ariaLabel: 'Tune' },
      { label: 'Attack', param: 'attack', ariaLabel: 'Attack' },
      { label: 'Decay', param: 'decay', ariaLabel: 'Decay' },
    ],
  },
  {
    id: 'snare-drum',
    label: 'Snare Drum',
    shortLabel: 'SD',
    domId: 'instrument-snare-drum',
    faderId: 'fader-snare-drum',
    faderLabel: 'Snare drum volume',
    knobs: [
      { label: 'Tune', param: 'snare-tune', ariaLabel: 'Snare tune' },
      { label: 'Attack', param: 'snare-attack', ariaLabel: 'Snare attack' },
      { label: 'Decay', param: 'snare-decay', ariaLabel: 'Snare decay' },
    ],
  },
  {
    id: 'hi-hat',
    label: 'Hi-Hat',
    shortLabel: 'HH',
    domId: 'instrument-hi-hat',
    faderId: 'fader-hi-hat',
    faderLabel: 'Hi-hat volume',
    knobs: [
      { label: 'Tune', param: 'hi-hat-tune', ariaLabel: 'Hi-hat tune' },
      { label: 'Attack', param: 'hi-hat-attack', ariaLabel: 'Hi-hat attack' },
      { label: 'Decay', param: 'hi-hat-decay', ariaLabel: 'Hi-hat decay' },
    ],
  },
]

const knobHandlers: Record<KnobParam, (root: HTMLElement, value: number) => void> = {
  tune: (_root, value) => audioEngine.setBassDrumTune(value),
  attack: (_root, value) => audioEngine.setBassDrumAttack(value),
  decay: (_root, value) => audioEngine.setBassDrumDecay(value),
  'snare-tune': (_root, value) => audioEngine.setSnareDrumTune(value),
  'snare-attack': (_root, value) => audioEngine.setSnareDrumAttack(value),
  'snare-decay': (_root, value) => audioEngine.setSnareDrumDecay(value),
  'hi-hat-tune': (_root, value) => audioEngine.setHiHatTune(value),
  'hi-hat-attack': (_root, value) => audioEngine.setHiHatAttack(value),
  'hi-hat-decay': (_root, value) => audioEngine.setHiHatDecay(value),
  bpm: (root, value) => {
    const bpm = Math.round(BPM_MIN + (value / 100) * (BPM_MAX - BPM_MIN))
    audioEngine.setBpm(bpm)
    const display = root.querySelector<HTMLElement>('#bpm-display')
    if (display) display.textContent = String(bpm)
  },
}

const faderHandlers: Record<InstrumentId, (value: number) => void> = {
  'bass-drum': (value) => audioEngine.setInstrumentVolume('bass-drum', value),
  'snare-drum': (value) => audioEngine.setInstrumentVolume('snare-drum', value),
  'hi-hat': (value) => audioEngine.setInstrumentVolume('hi-hat', value),
}

export function getLogoHTML(): string {
  return `Drumm<span>.js</span>`
}

function renderKnob(label: string, param: string, ariaLabel: string): string {
  return `
    <div class="dm-knob-group">
      <span class="dm-knob-label">${label}</span>
      <div class="dm-knob" data-param="${param}" role="slider" aria-label="${ariaLabel}" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
        <div class="dm-knob__indicator"></div>
      </div>
    </div>
  `
}

function renderInstrument(instrument: InstrumentConfig): string {
  return `
    <div class="dm-instrument" id="${instrument.domId}">
      <div class="dm-instrument__panel">
        <div class="dm-knob-row">
          ${instrument.knobs.map(knob => renderKnob(knob.label, knob.param, knob.ariaLabel)).join('')}
        </div>
        <div class="dm-fader-row">
          <div class="dm-fader-group">
            <input class="dm-fader" id="${instrument.faderId}" data-param="${instrument.id}" type="range" min="0" max="100" value="70" orient="vertical" aria-label="${instrument.faderLabel}" />
          </div>
        </div>
      </div>
      <span class="dm-instrument__label">${instrument.label}</span>
    </div>
  `
}

function renderSequencerRow(instrument: InstrumentConfig): string {
  return `
    <div class="dm-seq-row" id="seq-${instrument.id}">
      <span class="dm-seq-label">${instrument.shortLabel}</span>
      <div class="dm-seq-steps">
        ${Array.from({ length: 16 }, (_, i) => `<button class="dm-seq-step" data-instrument="${instrument.id}" data-step="${i}" aria-label="${instrument.label} step ${i + 1}" aria-pressed="false"></button>`).join('')}
      </div>
    </div>
  `
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

function bindFaders(root: HTMLElement): void {
  root.addEventListener('dm:fader-change', ((event: Event) => {
    const { param, value } = (event as CustomEvent<FaderChangeDetail>).detail
    const handler = faderHandlers[param as InstrumentId]
    if (handler) handler(value)
  }) as EventListener)

  for (const instrument of INSTRUMENTS) {
    const fader = root.querySelector<HTMLInputElement>(`#${instrument.faderId}`)
    if (fader) {
      faderHandlers[instrument.id](Number(fader.value))
    }
  }
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
              <div class="dm-knob dm-knob--bpm" data-param="${BPM_KNOB.param}" role="slider" aria-label="${BPM_KNOB.ariaLabel}" aria-valuenow="${BPM_KNOB.initialValue}" aria-valuemin="0" aria-valuemax="100" tabindex="0">
                <div class="dm-knob__indicator"></div>
              </div>
              <span class="dm-bpm-value" id="bpm-display">${DEFAULT_BPM}</span>
            </div>

            <div class="dm-instruments">
              ${INSTRUMENTS.map(renderInstrument).join('')}
            </div><!-- /.dm-instruments -->
          </div><!-- /.dm-machine__controls -->

          <div class="dm-sequencer" id="sequencer">
            ${INSTRUMENTS.map(renderSequencerRow).join('')}
          </div><!-- /.dm-sequencer -->

          <div class="dm-machine__footer">
            <div class="dm-transport">
              <button class="dm-play-btn" id="play-btn" aria-label="Play">▶</button>
              <button class="dm-stop-btn" id="stop-btn" aria-label="Stop">■</button>
              <button class="dm-clear-btn" id="clear-btn" aria-label="Clear sequence">CLEAR</button>
            </div>
          </div>

        </div><!-- /.dm-machine__stage -->
      </div><!-- /.dm-machine__body -->
    </div><!-- /.dm-machine -->
  `

  // ── Sequencer cursor ─────────────────────────────────────
  // Collect all step buttons grouped by row for fast lookup
  const seqRows: Record<InstrumentId, NodeListOf<HTMLButtonElement>> = Object.fromEntries(
    INSTRUMENTS.map(instrument => [
      instrument.id,
      root.querySelectorAll<HTMLButtonElement>(`#seq-${instrument.id} .dm-seq-step`),
    ])
  ) as Record<InstrumentId, NodeListOf<HTMLButtonElement>>

  // Tell the engine which steps are active for each instrument
  audioEngine.setStepActiveQuery((instrument, step) =>
    seqRows[instrument as InstrumentId]?.[step]?.getAttribute('aria-pressed') === 'true'
  )

  function clearCursor(): void {
    root.querySelectorAll('.dm-seq-step--current').forEach(el => {
      el.classList.remove('dm-seq-step--current')
    })
  }

  function clearSequence(): void {
    root.querySelectorAll<HTMLButtonElement>('.dm-seq-step').forEach(step => {
      step.setAttribute('aria-pressed', 'false')
      step.classList.remove('dm-seq-step--on')
    })
    clearCursor()
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

  root.querySelector<HTMLButtonElement>('#clear-btn')!
    .addEventListener('click', () => clearSequence())

  initKnobs(root, (param, value) => {
    const handler = knobHandlers[param as KnobParam]
    if (handler) handler(root, value)
  })
  initFaders(root)
  bindFaders(root)

  // Wire sequencer step buttons — toggle active state on click
  root.querySelectorAll<HTMLButtonElement>('.dm-seq-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const active = btn.getAttribute('aria-pressed') === 'true'
      btn.setAttribute('aria-pressed', String(!active))
      btn.classList.toggle('dm-seq-step--on', !active)
    })
  })
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
