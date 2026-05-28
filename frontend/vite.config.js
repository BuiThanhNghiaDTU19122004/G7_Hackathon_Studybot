import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = 'https://nivk4mptfj.execute-api.us-east-1.amazonaws.com'
const proxyConfig = { target: apiTarget, changeOrigin: true, secure: true }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': proxyConfig,
      '/query': proxyConfig,
      '/upload': proxyConfig,
      '/action': proxyConfig,
      '/docs/list': proxyConfig,
      '/queries/recent': proxyConfig,
    }
  }
})
