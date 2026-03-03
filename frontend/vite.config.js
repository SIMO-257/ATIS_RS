import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.dev', 'evonne-unradical-jingly.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://api:5000',
        changeOrigin: true,
      }
    }
  }
})
