import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logout } from '@/api/auth'
import { ApiError, get } from '@/api/client'
import { getIdeas } from '@/api/ideas'
import { getRecordatoriosVencidos } from '@/api/recordatorios'
import { conSesion, USUARIO_PRUEBA } from '@/test/sesion'
import type { Usuario } from '@/types/usuario'
import { App } from './App'

// La sesión se simula con `conSesion` (['sesion'] ya cargado): el guard no consulta /yo.
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  yo: vi.fn(),
  pedirCsrf: vi.fn(),
}))

vi.mock('@/api/eventos', () => ({ getEventos: vi.fn().mockResolvedValue([]), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({
  getRecordatorios: vi.fn().mockResolvedValue([]),
  getRecordatoriosVencidos: vi.fn().mockResolvedValue([]),
  marcarRecordatorioEnviado: vi.fn(),
}))
vi.mock('@/api/proyectos', () => ({
  getProyectos: vi.fn().mockResolvedValue([]),
  crearProyecto: vi.fn(),
  actualizarProyecto: vi.fn(),
  borrarProyecto: vi.fn(),
  getImpactoBorradoProyecto: vi.fn(),
}))
vi.mock('@/api/objetivos', () => ({
  getObjetivos: vi.fn().mockResolvedValue([]),
  crearObjetivo: vi.fn(),
  actualizarObjetivo: vi.fn(),
  borrarObjetivo: vi.fn(),
  getImpactoBorradoObjetivo: vi.fn(),
}))
vi.mock('@/api/ideas', () => ({
  getIdeas: vi.fn().mockResolvedValue([]),
  crearIdea: vi.fn(),
  actualizarIdea: vi.fn(),
  concluirIdea: vi.fn(),
  reabrirIdea: vi.fn(),
  borrarIdea: vi.fn(),
}))
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

function Url() {
  const { pathname, search } = useLocation()
  return <p data-testid="url">{pathname + search}</p>
}

function renderizar(ruta = '/', usuario: Usuario | null = USUARIO_PRUEBA) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  conSesion(queryClient, usuario)
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Url />
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

beforeEach(() => simularPreferenciaDelSistema(false))
afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
  localStorage.clear()
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

  it('navega a Calendario desde la barra lateral y muestra el mes actual', async () => {
    renderizar('/')
    await userEvent.click(screen.getByRole('link', { name: 'Calendario' }))
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^[A-Z][a-zé]+ de \d{4}$/)
    expect(screen.queryByText('Próximamente.')).not.toBeInTheDocument()
  })

  it('una ruta inexistente muestra «No encontrada»', () => {
    renderizar('/no-existe')
    expect(screen.getByRole('heading', { name: 'No encontrada' })).toBeInTheDocument()
    expect(screen.getByText('Próximamente.')).toBeInTheDocument()
  })

  it('las rutas /proyectos y /objetivos muestran sus páginas', async () => {
    renderizar('/proyectos')
    expect(await screen.findByRole('heading', { name: 'Proyectos', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('Aún no tienes proyectos.')).toBeInTheDocument()
  })

  it('navega a Objetivos desde la barra lateral', async () => {
    renderizar('/')
    await userEvent.click(screen.getByRole('link', { name: 'Objetivos' }))
    expect(await screen.findByText('Aún no tienes objetivos.')).toBeInTheDocument()
  })

  it('la ruta /ideas muestra la página de Ideas', async () => {
    renderizar('/ideas')
    expect(await screen.findByRole('heading', { name: 'Ideas', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('Aún no tienes ideas.')).toBeInTheDocument()
  })

  it('navega a Ideas desde la barra lateral', async () => {
    renderizar('/')
    await userEvent.click(screen.getByRole('link', { name: 'Ideas' }))
    expect(await screen.findByText('Aún no tienes ideas.')).toBeInTheDocument()
  })

  it('marca la sección activa', async () => {
    renderizar('/ideas')
    expect(screen.getByRole('link', { name: 'Ideas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current')
    // Espera a que termine de cargar la página para no dejar actualizaciones fuera de `act`.
    await screen.findByText('Aún no tienes ideas.')
  })
})

describe('aviso de vencidos', () => {
  it('se muestra en cualquier página, no solo en Hoy', async () => {
    vi.mocked(getRecordatoriosVencidos).mockResolvedValueOnce([
      { id: 1, tareaId: null, eventoId: null, fechaHora: '2026-11-10T08:00:00-03:00', canal: 'APP', enviado: false, descripcion: 'Llamar al médico' },
    ])
    renderizar('/ideas')
    expect(await screen.findByText('Llamar al médico')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entendido: Llamar al médico' })).toBeInTheDocument()
    await screen.findByText('Aún no tienes ideas.')
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

  it('el botón de tema cicla Sistema → Claro → Oscuro y lo recuerda', async () => {
    const user = userEvent.setup()
    simularPreferenciaDelSistema(true)
    renderizar()
    const boton = () => screen.getByRole('button', { name: /^Tema:/ })
    expect(boton()).toHaveAccessibleName('Tema: Sistema. Cambiar a Claro')
    expect(document.documentElement).toHaveClass('dark')

    await user.click(boton())
    expect(boton()).toHaveAccessibleName('Tema: Claro. Cambiar a Oscuro')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('agoals:tema')).toBe('claro')

    await user.click(boton())
    expect(boton()).toHaveAccessibleName('Tema: Oscuro. Cambiar a Sistema')
    expect(document.documentElement).toHaveClass('dark')

    await user.click(boton())
    expect(localStorage.getItem('agoals:tema')).toBeNull()
  })

  it('parte de la preferencia guardada al montar', () => {
    localStorage.setItem('agoals:tema', 'oscuro')
    renderizar()
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Tema: Oscuro. Cambiar a Sistema' })).toBeInTheDocument()
  })
})

describe('sesión: guard', () => {
  it('sin sesión, un deep link lleva a /login?volver= y no monta la página', async () => {
    renderizar('/cofre', null)
    expect(await screen.findByRole('heading', { name: 'Entrar', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/login?volver=%2Fcofre')
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument()
  })

  it('con sesión, /login lleva a la app', async () => {
    renderizar('/login')
    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('/')
    await screen.findByText('No tienes tareas sin hora para hoy.')
  })
})

describe('sesión: Salir', () => {
  it('muestra el nombre del usuario en la barra lateral', async () => {
    renderizar('/ideas')
    expect(screen.getByText('felipe')).toHaveAttribute('title', 'felipe@agoals.local')
    await screen.findByText('Aún no tienes ideas.')
  })

  it('si no hay nombre de usuario muestra el email', async () => {
    renderizar('/ideas', { ...USUARIO_PRUEBA, nombreUsuario: '' })
    expect(screen.getByText('felipe@agoals.local')).toBeInTheDocument()
    await screen.findByText('Aún no tienes ideas.')
  })

  it('«Salir» llama a logout, limpia la caché y lleva a /login sin volver', async () => {
    const user = userEvent.setup()
    const queryClient = renderizar('/ideas')
    await screen.findByText('Aún no tienes ideas.')
    queryClient.setQueryData(['zz-otro-usuario'], { dato: 1 })

    await user.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByRole('heading', { name: 'Entrar', level: 1 })).toBeInTheDocument()
    expect(logout).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('url').textContent).toBe('/login')
    expect(queryClient.getQueryData(['sesion'])).toBeNull()
    expect(queryClient.getQueryData(['zz-otro-usuario'])).toBeUndefined()
    expect(queryClient.getQueryData(['ideas'])).toBeUndefined()
  })

  it('si el logout falla igual limpia y va a /login', async () => {
    const user = userEvent.setup()
    vi.mocked(logout).mockRejectedValueOnce(new ApiError(0, 'No se pudo conectar con el servidor.'))
    const queryClient = renderizar('/ideas')
    await screen.findByText('Aún no tienes ideas.')
    queryClient.setQueryData(['zz-otro-usuario'], { dato: 1 })

    await user.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByRole('heading', { name: 'Entrar', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('/login')
    expect(queryClient.getQueryData(['sesion'])).toBeNull()
    expect(queryClient.getQueryData(['zz-otro-usuario'])).toBeUndefined()
  })
})

describe('sesión: 401 global', () => {
  const respuesta401 = () => new Response(JSON.stringify({ mensaje: 'Inicia sesión para continuar', errores: [] }), { status: 401 })

  it('un 401 en una consulta de la página limpia la caché y lleva a /login?volver= sin errores en rojo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => respuesta401()))
    vi.mocked(getIdeas).mockImplementationOnce(() => get('/api/ideas'))
    const queryClient = renderizar('/ideas')
    queryClient.setQueryData(['zz-otro-usuario'], { dato: 1 })

    expect(await screen.findByRole('heading', { name: 'Entrar', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/login?volver=%2Fideas')
    expect(queryClient.getQueryData(['sesion'])).toBeNull()
    expect(queryClient.getQueryData(['zz-otro-usuario'])).toBeUndefined()
    expect(screen.queryByText(/Inicia sesión para continuar/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un 401 del aviso de vencidos (el mismo que usa el polling) hace lo mismo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => respuesta401()))
    vi.mocked(getRecordatoriosVencidos).mockImplementationOnce(() => get('/api/recordatorios/vencidos'))
    renderizar('/ideas')

    expect(await screen.findByRole('heading', { name: 'Entrar', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/login?volver=%2Fideas')
  })
})
