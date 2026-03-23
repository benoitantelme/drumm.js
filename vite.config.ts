import { defineConfig } from 'vite'

export default defineConfig({
  // base is the actual GitHub repo name if different
  base: '/drumm.js/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
