import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tarea } from '@/features/cofre/fabrica'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import type { Objetivo } from '@/types/objetivo'
import type { Tarea } from '@/types/tarea'
import { ObjetivoPage } from './ObjetivoPage'

vi.mock('@/api/proyectos', () => ({
  getProyectos: vi.fn(),
  crearProyecto: vi.fn(),
  actualizarProyecto: vi.fn(),
  borrarProyecto: vi.fn(),
  getImpactoBorradoProyecto: vi.fn(),
  asignarTarea: vi.fn(),
  quitarTarea: vi.fn(),
}))
vi.mock('@/api/objetivos', () => ({
  getObjetivos: vi.fn(),
  crearObjetivo: vi.fn(),
  actualizarObjetivo: vi.fn(),
  borrarObjetivo: vi.fn(),
  getImpactoBorradoObjetivo: vi.fn(),
  asignarTarea: vi.fn(),
  quitarTarea: vi.fn(),
}))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
import { asignarTarea, getObjetivos, quitarTarea } from '@/api/objetivos'
import { asignarTarea as asignarProyecto, getProyectos, quitarTarea as quitarProyecto } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'

let objetivos: Objetivo[]
let tareas: Tarea[]

beforeEach(() => {
  vi.resetAllMocks()
  objetivos = [objetivo({ id: 1, nombre: 'Salud' }), objetivo({ id: 3, nombre: 'Viajar' }), objetivo({ id: 4, nombre: 'Cerrado', estado: 'HECHO' })]
  tareas = [
    tarea({ id: 20, titulo: 'Comprar zapatillas', objetivoId: 1, proyectoId: 10 }),
    tarea({ id: 21, titulo: 'De otro objetivo', objetivoId: 3 }),
    tarea({ id: 22, titulo: 'Suelta' }),
  ]
  vi.mocked(getObjetivos).mockImplementation(async () => objetivos.map((o) => ({ ...o })))
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 10, nombre: 'Plan' })])
  vi.mocked(getTareas).mockImplementation(async () => tareas.map((t) => ({ ...t })))
  vi.mocked(asignarTarea).mockImplementation(async (id, tareaId) => {
    tareas = tareas.map((t) => (t.id === tareaId ? { ...t, objetivoId: id } : t))
    return tareas.find((t) => t.id === tareaId)!
  })
  vi.mocked(quitarTarea).mockImplementation(async (_id, tareaId) => {
    tareas = tareas.map((t) => (t.id === tareaId ? { ...t, objetivoId: null } : t))
  })
})

function renderizar(ruta = '/objetivos/1') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/objetivos/:id" element={<ObjetivoPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const seccion = () => screen.getByRole('heading', { name: 'Tareas ligadas directamente', level: 2 }).closest('section') as HTMLElement

describe('ObjetivoPage: tareas ligadas directamente (8.4b)', () => {
  it('quitar usa la API de objetivos, avisa y no toca el proyecto de la tarea', async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await within(await waitSeccion()).findByRole('button', { name: 'Quitar «Comprar zapatillas» del objetivo' }))
    await waitFor(() => expect(quitarTarea).toHaveBeenCalledWith(1, 20))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Comprar zapatillas» ya no es del objetivo «Salud»'))
    expect(quitarProyecto).not.toHaveBeenCalled()
    expect(tareas.find((t) => t.id === 20)?.proyectoId).toBe(10)
  })

  it('vincular una de otro objetivo: avisa que se moverá, llama a objetivos y no a proyectos', async () => {
    const user = userEvent.setup()
    renderizar()
    await waitSeccion()
    await user.click(await within(seccion()).findByRole('button', { name: 'Vincular una existente' }))
    expect(within(seccion()).getByRole('button', { name: /^De otro objetivo/ })).toHaveTextContent('Ahora es del objetivo «Viajar»; se moverá')
    await user.click(within(seccion()).getByRole('button', { name: /^De otro objetivo/ }))
    await waitFor(() => expect(asignarTarea).toHaveBeenCalledWith(1, 21))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«De otro objetivo» ahora es del objetivo «Salud»'))
    expect(asignarProyecto).not.toHaveBeenCalled()
  })

  it('con el objetivo cerrado no se ofrece vincular', async () => {
    renderizar('/objetivos/4')
    await screen.findByRole('heading', { name: 'Cerrado', level: 1 })
    await screen.findByText('Este objetivo no tiene tareas ligadas directamente.')
    expect(within(seccion()).queryByRole('button', { name: 'Vincular una existente' })).not.toBeInTheDocument()
  })
})

async function waitSeccion() {
  await screen.findByRole('heading', { name: 'Salud', level: 1 })
  await within(seccion()).findByText('Comprar zapatillas')
  return seccion()
}
