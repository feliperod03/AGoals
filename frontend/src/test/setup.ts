import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { fijarCookieCsrf, TOKEN_CSRF_PRUEBA } from './csrf'

// jsdom no implementa `scrollTo` (solo avisa por consola): la semana lo usa al abrirse (H-30).
window.scrollTo = vi.fn()

// Con una cookie XSRF-TOKEN presente, el cliente real no hace el GET /api/auth/csrf previo y los tests que
// cuentan llamadas a `fetch` siguen viendo solo las suyas. Los que prueban el caso sin cookie la borran.
beforeEach(() => fijarCookieCsrf(TOKEN_CSRF_PRUEBA))

afterEach(() => {
  cleanup()
  fijarCookieCsrf(null)
})
