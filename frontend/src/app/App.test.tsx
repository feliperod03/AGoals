import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

vi.mock('@/api/eventos', () => ({ getEventos: vi.fn().mockResolvedValue([]), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatorios: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/tareas', () => ({
  getTarea: vi.fn(),
  getTareas: vi.fn().mockResolvedValue([]),
  getAgenda: vi.fn().mockResolvedValue({ fecha: '2026-11-10', conHora: [], sinHora: [] }),
}))

type Oyente = () => void

/** jsdom no implementa matchMedia: un doble mínimo cuyo valor podemos cambiar. */
function simularPreferenciaDelSistema(oscuro: boolean) {
  const oyentes = new Set<Oyente>()
  const media = {
    matches: oscuro,
    addEventListener: (_: string, f: Oyente) => oyentes.add(f),
    removeEventListener: (_: string, f: Oyente) => oyentes.delete(f),
  }
  vi.stubGlobal('matchMedia', () => media)
  return {
    cambiarA(valor: boolean) {
      media.matches = valor
      oyentes.forEach((f) => f())
    },
  }
}

function renderizar(ruta = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => simularPreferenciaDelSistema(false))
afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

describe('App', () => {
  it('la barra lateral tiene las seis secciones', () => {
    renderizar()
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    for (const nombre of ['Hoy', 'Cofre', 'Calendario', 'Proyectos', 'Objetivos', 'Ideas']) {
      expect(nav).toHaveTextContent(nombre)
    }
  })

  it('la ruta raíz muestra la página Hoy', async () => {
    renderizar('/')
    expect(await screen.findByText('No tienes tareas sin hora para hoy.')).toBeInTheDocument()
  })

  it('navega a una sección todavía no construida', async () => {
    renderizar('/')
    await userEvent.click(screen.getByRole('link', { name: 'Proyectos' }))
    expect(screen.getByRole('heading', { name: 'Proyectos' })).toBeInTheDocument()
    expect(screen.getByText('Próximamente.')).toBeInTheDocument()
  })

  it('marca la sección activa', () => {
    renderizar('/ideas')
    expect(screen.getByRole('link', { name: 'Ideas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current')
  })
})

describe('modo oscuro', () => {
  it('aplica .dark cuando el sistema prefiere oscuro', () => {
    simularPreferenciaDelSistema(true)
    renderizar()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('no aplica .dark cuando el sistema prefiere claro', () => {
    renderizar()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('reacciona al cambio de preferencia con la app abierta', () => {
    const sistema = simularPreferenciaDelSistema(false)
    renderizar()
    expect(document.documentElement).not.toHaveClass('dark')
    sistema.cambiarA(true)
    expect(document.documentElement).toHaveClass('dark')
    sistema.cambiarA(false)
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
