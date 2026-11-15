import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom no implementa `scrollTo` (solo avisa por consola): la semana lo usa al abrirse (H-30).
window.scrollTo = vi.fn()

afterEach(() => cleanup())
