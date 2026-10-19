import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site at https://trockkk.github.io/quiz-hub/ — must match the repository name.
  // Dev server stays at the root (http://localhost:5173/); build and preview use the Pages path.
  base: command === 'build' || isPreview ? '/quiz-hub/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    // Flags stay separate files loaded on demand instead of being inlined in the JavaScript bundle.
    assetsInlineLimit: (file: string) => (file.includes('flag-icons') ? false : undefined),
    // The main chunk is mostly game content (questions, countries): ~190 kB gzip is expected.
    chunkSizeWarningLimit: 800,
  },
}))
