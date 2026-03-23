/**
 * drum-machine — main entry point
 * Phase 1: Hello World scaffold
 */

interface AppInfo {
  name: string
  version: string
  buildTime: string
}

const APP: AppInfo = {
  name: 'DRUM MACHINE',
  version: '0.1.0',
  buildTime: new Date().toISOString(),
}

function detectPlatform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Firefox/i.test(ua)) return 'Firefox'
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari'
  if (/Edg/i.test(ua)) return 'Edge'
  return 'Chromium'
}

function createLED(active = false): HTMLSpanElement {
  const led = document.createElement('span')
  led.className = `dm-led${active ? ' active' : ''}`
  led.setAttribute('aria-hidden', 'true')
  return led
}

function render(root: HTMLElement): void {
  const platform = detectPlatform()

  root.innerHTML = /* html */ `
    <header class="dm-header">
      <div class="dm-logo">
        Drumm<span>.js</span>
      </div>
      <span class="dm-version">v${APP.version}</span>
    </header>

    <section class="dm-panel" aria-label="Welcome">
      <h1>Hello,<br /><em>World.</em></h1>

      <div class="dm-status" id="status-bar">
        <!-- LEDs injected by JS -->
      </div>

      <hr class="dm-divider" />

      <p>
        Welcome to the drum machine project.<br />
        This is your responsive TypeScript foundation — running on
        <strong style="color:var(--text-hi)">${platform}</strong>.<br />
        Instruments, sequencer, and audio engine coming next.
      </p>

      <div class="dm-badges">
        <span class="dm-badge">TypeScript</span>
        <span class="dm-badge">Vite</span>
        <span class="dm-badge">GitHub Pages</span>
        <span class="dm-badge">Web Audio API</span>
        <span class="dm-badge">Responsive</span>
      </div>
    </section>
  `

  // Animate LEDs to confirm JS is running
  const statusBar = document.getElementById('status-bar')!
  const labels = ['POWER', 'AUDIO', 'MIDI', 'SYNC']

  labels.forEach((label, i) => {
    const wrapper = document.createElement('span')
    wrapper.style.display = 'flex'
    wrapper.style.alignItems = 'center'
    wrapper.style.gap = '4px'

    const led = createLED(false)
    wrapper.appendChild(led)
    wrapper.appendChild(document.createTextNode(label))

    if (i < labels.length - 1) {
      const sep = document.createElement('span')
      sep.textContent = '·'
      sep.style.color = 'var(--border)'
      sep.style.marginLeft = '4px'
      wrapper.appendChild(sep)
    }

    statusBar.appendChild(wrapper)

    // Staggered power-on sequence
    setTimeout(() => led.classList.add('active'), 200 + i * 180)
  })
}

// Boot
const appRoot = document.getElementById('app')
if (appRoot) {
  render(appRoot)
} else {
  console.error('[drum-machine] #app root element not found')
}

console.info(`%c${APP.name} %cv${APP.version}`, 
  'font-weight:bold;color:#e85d04;', 
  'color:#5a5a5a;'
)
