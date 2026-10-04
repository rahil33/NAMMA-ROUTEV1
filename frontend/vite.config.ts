import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API lives in server/ (npm run dev:server). Same-origin proxying keeps session cookies first-party.
    proxy: { '/api': { target: `http://localhost:${process.env.PORT ?? 8787}`, changeOrigin: false } },
  },
  build: {
    // maplibre-gl is inherently ~1MB; it is isolated in a lazy-loaded map chunk.
    chunkSizeWarningLimit: 1100,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
