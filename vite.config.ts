import { defineConfig } from 'vite'

export default defineConfig({
  // Replace 'drummjs' with your actual GitHub repo name if different
  base: '/drummjs/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
