import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/query': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
      '/docs/list': 'http://localhost:8000',
      '/queries/recent': 'http://localhost:8000',
    }
  }
})
