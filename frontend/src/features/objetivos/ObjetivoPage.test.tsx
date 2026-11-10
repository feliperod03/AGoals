import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { tarea } from '@/features/cofre/fabrica'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import type { Objetivo } from '@/types/objetivo'
import { ObjetivoPage } from './ObjetivoPage'
import { ObjetivosPage } from './ObjetivosPage'

vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
import { actualizarObjetivo, borrarObjetivo, getImpactoBorradoObjetivo, getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'
import { SIN_DEPENDENCIAS_OBJETIVO } from '@/test/impactoBorrado'

let datos: Objetivo[]

function renderizar(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/objetivos" element={<ObjetivosPage />} />
          <Route path="/objetivos/:id" element={<ObjetivoPage />} />
          <Route path="/proyectos/:id" element={<p>Detalle del proyecto</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  datos = [
    objetivo({ id: 1, nombre: 'Salud', prioridad: 'ALTA', descripcion: 'Estar bien' }),
    objetivo({ id: 2, nombre: 'Correr 10 km', padreId: 1 }),
    objetivo({ id: 3, nombre: 'Viajar' }),
  ]
  vi.mocked(getObjetivos).mockImplementation(async () => datos.map((d) => ({ ...d })))
  vi.mocked(getProyectos).mockResolvedValue([
    proyecto({ id: 10, nombre: 'Plan de entrenamiento', objetivoId: 1, prioridad: 'MEDIA' }),
    proyecto({ id: 11, nombre: 'Chequeo médico', objetivoId: 1, estado: 'HECHO' }),
    proyecto({ id: 12, nombre: 'Proyecto de otro objetivo', objetivoId: 3 }),
    proyecto({ id: 13, nombre: 'Proyecto suelto' }),
  ])
  vi.mocked(getTareas).mockResolvedValue([
    tarea({ id: 20, titulo: 'Comprar zapatillas', objetivoId: 1 }),
    tarea({ id: 21, titulo: 'Tarea de su proyecto', proyectoId: 10 }),
    tarea({ id: 22, titulo: 'Tarea de otro objetivo', objetivoId: 3 }),
  ])
  vi.mocked(actualizarObjetivo).mockImplementation(async (id, r) => {
    datos = datos.map((d) => (d.id === id ? { ...d, ...r } : d))
    return datos.find((d) => d.id === id)!
  })
  vi.mocked(getImpactoBorradoObjetivo).mockResolvedValue(SIN_DEPENDENCIAS_OBJETIVO)
  vi.mocked(borrarObjetivo).mockImplementation(async (id) => {
    datos = datos.filter((d) => d.id !== id)
  })
})
afterEach(() => vi.resetAllMocks())

const seccion = (titulo: string) => screen.getByRole('heading', { name: titulo, level: 2 }).closest('section')!

describe('ObjetivoPage', () => {
  it('muestra los datos, los subobjetivos y los proyectos del objetivo', async () => {
    renderizar('/objetivos/1')
    expect(await screen.findByRole('heading', { name: 'Salud', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Estar bien')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Cambiar estado de «Salud»' })).toHaveValue('PENDIENTE')
    expect(within(seccion('Datos')).getByText('Sin padre')).toBeInTheDocument()
    expect(within(seccion('Datos')).queryByText('Objetivo')).not.toBeInTheDocument() // los objetivos no tienen objetivo
    expect(within(seccion('Subobjetivos')).getByRole('link', { name: 'Correr 10 km' })).toHaveAttribute('href', '/objetivos/2')

    const proyectos = await screen.findByText('Plan de entrenamiento').then(() => seccion('Proyectos del objetivo'))
    expect(within(proyectos).getAllByRole('link').map((a) => a.textContent)).toEqual(['Plan de entrenamiento', 'Chequeo médico'])
    expect(within(proyectos).getByRole('link', { name: 'Plan de entrenamiento' })).toHaveAttribute('href', '/proyectos/10')
    expect(within(proyectos).queryByText('Proyecto de otro objetivo')).not.toBeInTheDocument()
    expect(within(proyectos).queryByText('Proyecto suelto')).not.toBeInTheDocument()
  })

  it('titula «Tareas ligadas directamente», aclara dónde ver las de sus proyectos y solo lista las suyas', async () => {
    renderizar('/objetivos/1')
    await screen.findByRole('heading', { name: 'Salud', level: 1 })
    const tareas = seccion('Tareas ligadas directamente')
    expect(within(tareas).getByText('Las tareas de sus proyectos se ven en cada proyecto.')).toBeInTheDocument()
    expect(await within(tareas).findByText('Comprar zapatillas')).toBeInTheDocument()
    expect(within(tareas).queryByText('Tarea de su proyecto')).not.toBeInTheDocument()
    expect(within(tareas).queryByText('Tarea de otro objetivo')).not.toBeInTheDocument()
    expect(within(tareas).getAllByRole('button').map((b) => b.textContent)).toEqual(['Vincular una existente', 'Quitar'])
  })

  it('un objetivo sin proyectos, hijos ni tareas lo dice en cada sección', async () => {
    vi.mocked(getTareas).mockResolvedValue([])
    vi.mocked(getProyectos).mockResolvedValue([])
    renderizar('/objetivos/2')
    await screen.findByRole('heading', { name: 'Correr 10 km', level: 1 })
    expect(within(seccion('Datos')).getByRole('link', { name: 'Salud' })).toHaveAttribute('href', '/objetivos/1')
    expect(within(seccion('Subobjetivos')).getByText('Este objetivo no tiene subobjetivos.')).toBeInTheDocument()
    expect(await within(seccion('Proyectos del objetivo')).findByText('Este objetivo no tiene proyectos.')).toBeInTheDocument()
    expect(await within(seccion('Tareas ligadas directamente')).findByText('Este objetivo no tiene tareas ligadas directamente.')).toBeInTheDocument()
  })

  it('si los proyectos fallan, el resto del detalle se muestra', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar('/objetivos/1')
    await screen.findByRole('heading', { name: 'Salud', level: 1 })
    expect(await within(seccion('Proyectos del objetivo')).findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.getByText('Estar bien')).toBeInTheDocument()
  })

  it('un id que no existe muestra «Objetivo no encontrado»', async () => {
    renderizar('/objetivos/999')
    expect(await screen.findByRole('heading', { name: 'Objetivo no encontrado', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Objetivos' })).toHaveAttribute('href', '/objetivos')
  })

  it('Editar guarda sin objetivoId; Borrar con proyectos (409) muestra el mensaje y se queda', async () => {
    const user = userEvent.setup()
    renderizar('/objetivos/1')
    await screen.findByRole('heading', { name: 'Salud', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    let dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarObjetivo).toHaveBeenCalledWith(1, { nombre: 'Salud', descripcion: 'Estar bien', estado: 'PENDIENTE', prioridad: 'ALTA', padreId: null }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    vi.mocked(borrarObjetivo).mockRejectedValue(new ApiError(409, 'El objetivo 1 tiene subobjetivos: muévelos o bórralos primero'))
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El objetivo 1 tiene subobjetivos: muévelos o bórralos primero')
  })

  it('Borrar un objetivo vacío vuelve a la lista con el aviso', async () => {
    const user = userEvent.setup()
    renderizar('/objetivos/3')
    await screen.findByRole('heading', { name: 'Viajar', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await screen.findByRole('heading', { name: 'Objetivos', level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Viajar» borrado'))
  })
})
