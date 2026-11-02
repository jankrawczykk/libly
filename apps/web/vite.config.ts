import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { DEV_API_PROXY_OPTIONS } from './dev-api-proxy.js'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    cors: false,
    proxy: {
      '/api': DEV_API_PROXY_OPTIONS,
    },
  },
})
