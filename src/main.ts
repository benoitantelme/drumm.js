/**
 * drumm.js — main entry point
 * Phase 2: Greeting page → machine page transition
 */

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
  root.innerHTML = /* html */ `
    <div class="dm-machine">
      <div class="dm-machine__body">
        <header class="dm-machine__header">
          <div class="dm-logo">${getLogoHTML()}</div>
          <span class="dm-version">v${APP.version}</span>
        </header>
        <div class="dm-machine__stage">
          <span class="dm-machine__placeholder">instruments &amp; sequencer coming soon</span>
        </div>
      </div>
    </div>
  `
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
