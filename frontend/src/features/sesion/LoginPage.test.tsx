import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { login } from '@/api/auth'
import { ApiError } from '@/api/client'
import { conSesion, USUARIO_PRUEBA } from '@/test/sesion'
import { LoginPage } from './LoginPage'

vi.mock('@/api/auth', () => ({ login: vi.fn() }))

function Url() {
  const { pathname, search } = useLocation()
  return <p data-testid="url">{pathname + search}</p>
}

function renderizar(ruta = '/login', sesion: typeof USUARIO_PRUEBA | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  conSesion(queryClient, sesion)
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Url />
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<h1>Dentro de la app</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { queryClient, user: userEvent.setup() }
}

const email = () => screen.getByLabelText('Email')
const clave = () => screen.getByLabelText('Contraseña')
const recordarme = () => screen.getByRole('checkbox', { name: 'Recordarme' })
const entrar = () => screen.getByRole('button', { name: 'Entrar' })

async function rellenar(user: ReturnType<typeof userEvent.setup>, e = 'felipe@agoals.local', c = 'secreta') {
  await user.type(email(), e)
  await user.type(clave(), c)
}

beforeEach(() => {
  vi.mocked(login).mockReset()
})

describe('LoginPage', () => {
  it('muestra el formulario con labels, autocomplete y «Recordarme» marcada por defecto', () => {
    renderizar()
    expect(screen.getByRole('heading', { name: 'Entrar', level: 1 })).toBeInTheDocument()
    expect(email()).toHaveAttribute('autocomplete', 'username')
    expect(email()).toHaveAttribute('type', 'email')
    expect(clave()).toHaveAttribute('autocomplete', 'current-password')
    expect(clave()).toHaveAttribute('type', 'password')
    expect(recordarme()).toBeChecked()
    expect(recordarme()).toHaveAccessibleDescription(/30 días/)
  })

  it('el foco inicial está en el email', () => {
    renderizar()
    expect(email()).toHaveFocus()
  })

  it('enviar vacío muestra los dos mensajes, enfoca el email y no llama a la API', async () => {
    const { user } = renderizar()
    await user.click(entrar())
    expect(await screen.findByText('Escribe tu email')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(email()).toHaveFocus()
    expect(login).not.toHaveBeenCalled()
  })

  it('con solo el email escrito, el foco va a la contraseña', async () => {
    const { user } = renderizar()
    await user.type(email(), 'a@b.c')
    await user.click(entrar())
    expect(await screen.findByText('Escribe tu contraseña')).toBeInTheDocument()
    expect(clave()).toHaveFocus()
    expect(login).not.toHaveBeenCalled()
  })

  it('un email de solo espacios cuenta como vacío', async () => {
    const { user } = renderizar()
    await user.type(email(), '   ')
    await user.type(clave(), 'x')
    await user.click(entrar())
    expect(await screen.findByText('Escribe tu email')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('envía el email recortado, la contraseña y recordarme: true', async () => {
    vi.mocked(login).mockResolvedValue(USUARIO_PRUEBA)
    const { user } = renderizar()
    await rellenar(user, '  felipe@agoals.local  ', 'secreta')
    await user.click(entrar())
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1))
    expect(vi.mocked(login).mock.calls[0]?.[0]).toEqual({ email: 'felipe@agoals.local', clave: 'secreta', recordarme: true })
  })

  it('con la casilla desmarcada envía recordarme: false', async () => {
    vi.mocked(login).mockResolvedValue(USUARIO_PRUEBA)
    const { user } = renderizar()
    await rellenar(user)
    await user.click(recordarme())
    await user.click(entrar())
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1))
    expect(vi.mocked(login).mock.calls[0]?.[0]).toMatchObject({ recordarme: false })
  })

  it('mientras envía el botón dice «Entrando…», está deshabilitado y no admite un segundo envío', async () => {
    vi.mocked(login).mockReturnValue(new Promise(() => {}))
    const { user } = renderizar()
    await rellenar(user)
    await user.click(entrar())
    const boton = await screen.findByRole('button', { name: 'Entrando…' })
    expect(boton).toBeDisabled()
    await user.click(boton)
    await user.type(clave(), '{Enter}')
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('401: error en línea con el mensaje del servidor, contraseña vacía y con foco; el email se conserva', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(401, 'Email o contraseña incorrectos'))
    const { user } = renderizar()
    await rellenar(user)
    await user.click(entrar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos')
    expect(clave()).toHaveValue('')
    expect(clave()).toHaveFocus()
    expect(email()).toHaveValue('felipe@agoals.local')
    expect(entrar()).toBeEnabled()
  })

  it('editar un campo quita el error del servidor', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(401, 'Email o contraseña incorrectos'))
    const { user } = renderizar()
    await rellenar(user)
    await user.click(entrar())
    await screen.findByRole('alert')
    await user.type(clave(), 'o')
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('429: muestra el mensaje del servidor y no vacía nada', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(429, 'Demasiados intentos fallidos. Espera 15 minutos.'))
    const { user } = renderizar()
    await rellenar(user)
    await user.click(entrar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos fallidos. Espera 15 minutos.')
    expect(clave()).toHaveValue('secreta')
    expect(email()).toHaveValue('felipe@agoals.local')
    // El botón se deshabilitó al enviar y el foco cayó a `body`: vuelve a «Entrar».
    await waitFor(() => expect(entrar()).toHaveFocus())
  })

  it('sin conexión: muestra el mensaje de conexión', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor. Revisa que el backend esté en marcha.'))
    const { user } = renderizar()
    await rellenar(user)
    await user.click(entrar())
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    expect(clave()).toHaveValue('secreta')
  })

  it('un nuevo intento tras el error vuelve a llamar a la API', async () => {
    vi.mocked(login).mockRejectedValueOnce(new ApiError(401, 'Email o contraseña incorrectos')).mockResolvedValue(USUARIO_PRUEBA)
    const { user } = renderizar()
    await rellenar(user)
    await user.click(entrar())
    await screen.findByRole('alert')
    await user.type(clave(), 'buena')
    await user.click(entrar())
    expect(await screen.findByRole('heading', { name: 'Dentro de la app' })).toBeInTheDocument()
    expect(login).toHaveBeenCalledTimes(2)
  })

  it('éxito: limpia la caché, fija la sesión y va a «/»', async () => {
    vi.mocked(login).mockResolvedValue(USUARIO_PRUEBA)
    const { user, queryClient } = renderizar()
    queryClient.setQueryData(['tareas', 'todas'], [{ id: 99 }])
    await rellenar(user)
    await user.click(entrar())
    expect(await screen.findByRole('heading', { name: 'Dentro de la app' })).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('/')
    expect(queryClient.getQueryData(['tareas', 'todas'])).toBeUndefined()
    expect(queryClient.getQueryData(['sesion'])).toEqual(USUARIO_PRUEBA)
  })

  it('éxito con volver=/cofre va a /cofre (con su búsqueda)', async () => {
    vi.mocked(login).mockResolvedValue(USUARIO_PRUEBA)
    const { user } = renderizar('/login?volver=%2Fcofre%3Ff%3D1')
    await rellenar(user)
    await user.click(entrar())
    expect(await screen.findByRole('heading', { name: 'Dentro de la app' })).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/cofre?f=1')
  })

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'cofre'])('un volver inválido (%s) va a «/»', async (volver) => {
    vi.mocked(login).mockResolvedValue(USUARIO_PRUEBA)
    const { user } = renderizar(`/login?volver=${encodeURIComponent(volver)}`)
    await rellenar(user)
    await user.click(entrar())
    expect(await screen.findByRole('heading', { name: 'Dentro de la app' })).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('/')
  })

  it('si ya hay sesión y se visita /login, va a «/»', async () => {
    renderizar('/login', USUARIO_PRUEBA)
    expect(await screen.findByRole('heading', { name: 'Dentro de la app' })).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('/')
  })
})
