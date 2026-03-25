# 🥁 drumm.js

An interactive browser-based drum machine built with TypeScript + Vite, deployed via GitHub Pages.

## Project Roadmap

- [x] **Phase 1** — Responsive TypeScript scaffold
- [x] **Phase 2** — Start-up flow: greeting page → machine page (empty shell, no audio yet)
- [x] **Phase 3** — Web Audio API engine (AudioContext, scheduler, timing loop)
- [ ] **Phase 4** — Instrument definitions (synth/sample abstraction, basic sounds)
- [ ] **Phase 5** — Step sequencer UI (grid, transport controls, BPM)
- [ ] **Phase 6** — Instrument parameter controls (tune, decay, filter…)
- [ ] **Phase 7** — Save / load patterns

## Local Development

### Using pnpm (recommended)

```bash
pnpm install
pnpm dev
```

### Using npm

```bash
npm install
npm run dev
```

Open `http://localhost:5173/drummjs/`

## Build & Preview

```bash
# pnpm
pnpm build      # compile TypeScript + bundle to /dist
pnpm preview    # preview the production build locally

# npm
npm run build
npm run preview
```

## Deploying to GitHub Pages

1. Create a GitHub repo named `drummjs` (or update `base` in `vite.config.ts` to match your repo name)
2. Push this project to the `main` branch
3. Go to **Settings → Pages → Source** and select **GitHub Actions**
4. The workflow in `.github/workflows/deploy.yml` handles everything automatically on every push to `main`

## Browser Support

- ✅ Chrome / Chromium
- ✅ Firefox
- ✅ Safari (desktop + iOS)
- ✅ Edge
- ✅ Mobile (Android + iOS) — responsive layout with safe-area support
