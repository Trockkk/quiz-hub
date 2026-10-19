import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base + hash routing: the build works on any GitHub Pages repo name without config.
  base: './',
  plugins: [react(), tailwindcss()],
})
