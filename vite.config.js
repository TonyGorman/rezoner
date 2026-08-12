import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths keep static hosting simple (GitHub Pages, S3, etc.)
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
