import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { yo } from '@/api/auth'
import { ApiError } from '@/api/client'
import { conSesion, USUARIO_PRUEBA } from '@/test/sesion'
import { marcarSalidaVoluntaria, olvidarSalidaVoluntaria } from './limpiar'
import { RequiereSesion } from './RequiereSesion'

vi.mock('@/api/auth', () => ({ yo: vi.fn() }))

function Url() {
  const { pathname, search } = useLocation()
  return <p data-testid="url">{pathname + search}</p>
}

function renderizar(ruta: string, preparar?: (qc: QueryClient) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  preparar?.(queryClient)
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Url />
        <Routes>
          <Route path="login" element={<h1>Pantalla de login</h1>} />
          <Route element={<RequiereSesion />}>
            <Route path="cofre" element={<h1>Página del cofre</h1>} />
            <Route index element={<h1>Página de hoy</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

beforeEach(() => {
  vi.mocked(yo).mockReset()
  olvidarSalidaVoluntaria()
})

describe('RequiereSesion', () => {
  it('mientras /yo no responde muestra «Cargando…» y no monta la página', () => {
    vi.mocked(yo).mockReturnValue(new Promise(() => {}))
    renderizar('/cofre')
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.queryByText('Página del cofre')).not.toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/cofre')
  })

  it('con sesión (tras consultar /yo) muestra la página', async () => {
    vi.mocked(yo).mockResolvedValue(USUARIO_PRUEBA)
    renderizar('/cofre')
    expect(await screen.findByRole('heading', { name: 'Página del cofre' })).toBeInTheDocument()
    expect(yo).toHaveBeenCalledTimes(1)
  })

  it('con la sesión ya cargada no vuelve a consultar /yo', async () => {
    renderizar('/cofre', (qc) => conSesion(qc))
    expect(await screen.findByRole('heading', { name: 'Página del cofre' })).toBeInTheDocument()
    expect(yo).not.toHaveBeenCalled()
  })

  it('sin sesión (401) lleva a /login?volver= con la ruta completa y no monta la página', async () => {
    vi.mocked(yo).mockRejectedValue(new ApiError(401, 'Inicia sesión para continuar'))
    renderizar('/cofre?f=1')
    expect(await screen.findByRole('heading', { name: 'Pantalla de login' })).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/login?volver=%2Fcofre%3Ff%3D1')
    expect(screen.queryByText('Página del cofre')).not.toBeInTheDocument()
  })

  it('desde la raíz va a /login sin volver', async () => {
    renderizar('/', (qc) => conSesion(qc, null))
    expect(await screen.findByRole('heading', { name: 'Pantalla de login' })).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('/login')
  })

  it('tras una salida voluntaria («Salir») va a /login sin volver', async () => {
    marcarSalidaVoluntaria()
    renderizar('/cofre?f=1', (qc) => conSesion(qc, null))
    expect(await screen.findByRole('heading', { name: 'Pantalla de login' })).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('/login')
  })

  it('si /yo falla por el servidor no manda a /login: ofrece reintentar', async () => {
    const user = userEvent.setup()
    vi.mocked(yo).mockRejectedValueOnce(new ApiError(500, 'Error del servidor (500). Inténtalo de nuevo más tarde.'))
    renderizar('/cofre')
    expect(await screen.findByRole('heading', { name: 'No se pudo comprobar la sesión' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Error del servidor (500)')
    expect(screen.getByTestId('url')).toHaveTextContent('/cofre')

    vi.mocked(yo).mockResolvedValue(USUARIO_PRUEBA)
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Página del cofre' })).toBeInTheDocument()
  })

  it('al quedar la sesión en null estando dentro, redirige a /login con volver', async () => {
    const qc = renderizar('/cofre', (c) => conSesion(c))
    expect(await screen.findByRole('heading', { name: 'Página del cofre' })).toBeInTheDocument()
    conSesion(qc, null)
    expect(await screen.findByRole('heading', { name: 'Pantalla de login' })).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/login?volver=%2Fcofre')
  })
})
