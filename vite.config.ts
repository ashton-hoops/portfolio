import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    // Vite's default modulePreload eagerly fetches every lazy chunk's transitive
    // deps from the entry HTML, so the homepage was pulling the 717KB three.js
    // shot-chart bundle even though /#/ never renders it. That pushed mobile
    // Total Blocking Time over 600ms. Disabling preloads means chunks load on
    // demand: the homepage stays light and a click into /shot-chart pays the
    // ~200ms download (with a Suspense fallback already in place).
    modulePreload: false,
  },
})
