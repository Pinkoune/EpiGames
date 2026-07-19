import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' + HashRouter => deployable on GitHub Pages or any static host without path config
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
