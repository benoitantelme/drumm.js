import { defineConfig } from 'vite'

export default defineConfig({
  // Must exactly match your GitHub repo name
  base: '/drumm.js/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
})
