import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // El frontend usa rutas relativas (/api/...): el proxy evita CORS y no toca Spring.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
