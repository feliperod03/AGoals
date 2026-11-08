import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Zona horaria fija para que los tests de fechas den lo mismo en cualquier máquina.
// Se fija aquí (antes de que arranquen los workers, que heredan el entorno) porque
// `TZ=... vitest` no funciona en Windows y cross-env sería una dependencia nueva.
process.env.TZ = 'America/Argentina/Buenos_Aires'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }),
)
