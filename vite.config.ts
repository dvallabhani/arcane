/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js alone is ~700 kB minified; that's expected for a 3D app.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    // Unit tests cover the pure game/vision logic and run in plain Node.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
