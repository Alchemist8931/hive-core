import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/hive-core/',  // GitHub Pages subpath — change if repo name differs
})
