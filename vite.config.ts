import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// `base` must match the GitHub Pages repo name so asset URLs resolve.
export default defineConfig({
  base: '/dink-tank/',
  plugins: [react(), tailwindcss()],
})
