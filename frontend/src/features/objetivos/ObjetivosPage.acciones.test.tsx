import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo } from '@/features/jerarquia/fabrica'
import type { Objetivo } from '@/types/objetivo'
import { ObjetivosPage } from './ObjetivosPage'

vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn() }))
import { actualizarObjetivo, borrarObjetivo, crearObjetivo, getObjetivos } from '@/api/objetivos'

let datos: Objetivo[]

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ObjetivosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  datos = [objetivo({ id: 1, nombre: 'Salud', prioridad: 'ALTA' }), objetivo({ id: 2, nombre: 'Correr 10 km', padreId: 1, estado: 'EN_PROGRESO' })]
  vi.mocked(getObjetivos).mockImplementation(async () => datos.map((d) => ({ ...d })))
  vi.mocked(crearObjetivo).mockImplementation(async (r) => {
    const nuevo = objetivo({ ...r, id: 50 })
    datos.push(nuevo)
    return nuevo
  })
  vi.mocked(actualizarObjetivo).mockImplementation(async (id, r) => {
    datos = datos.map((d) => (d.id === id ? { ...d, ...r } : d))
    return datos.find((d) => d.id === id)!
  })
  vi.mocked(borrarObjetivo).mockImplementation(async (id) => {
    datos = datos.filter((d) => d.id !== id)
  })
})
afterEach(() => vi.resetAllMocks())

const aviso = () => screen.getByRole('status')

async function abrirMenu(user: ReturnType<typeof userEvent.setup>, nombre: string, opcion: 'Editar' | 'Borrar') {
  await user.click(await screen.findByRole('button', { name: `Acciones de «${nombre}»` }))
  await user.click(await screen.findByRole('menuitem', { name: opcion }))
  return screen.findByRole('dialog')
}

describe('ObjetivosPage: acciones', () => {
  it('crea un objetivo sin campo de objetivo y sin objetivoId en el cuerpo', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Salud')
    await user.click(screen.getByRole('button', { name: 'Nuevo objetivo' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('heading', { name: 'Nuevo objetivo' })).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText('Objetivo')).not.toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Viajar')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearObjetivo).toHaveBeenCalledTimes(1))
    expect(crearObjetivo).toHaveBeenCalledWith({ nombre: 'Viajar', descripcion: null, estado: 'PENDIENTE', prioridad: null, padreId: null })
    await waitFor(() => expect(aviso()).toHaveTextContent('Objetivo «Viajar» creado'))
    expect(await screen.findByRole('link', { name: 'Viajar' })).toBeInTheDocument()
  })

  it('edita reenviando estado, prioridad y padre', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Correr 10 km')
    const dialogo = await abrirMenu(user, 'Correr 10 km', 'Editar')
    expect(within(dialogo).getByLabelText('Estado')).toHaveValue('EN_PROGRESO')
    expect(within(dialogo).getByTestId('padre-actual')).toHaveTextContent('«Salud»')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarObjetivo).toHaveBeenCalledTimes(1))
    expect(actualizarObjetivo).toHaveBeenCalledWith(2, { nombre: 'Correr 10 km', descripcion: null, estado: 'EN_PROGRESO', prioridad: null, padreId: 1 })
    await waitFor(() => expect(aviso()).toHaveTextContent('«Correr 10 km» guardado'))
  })

  it('el padre de «Salud» no puede ser su subobjetivo', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Salud')
    const dialogo = await abrirMenu(user, 'Salud', 'Editar')
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar' }))
    const opciones = within(dialogo).getAllByRole('button').map((b) => b.textContent)
    expect(opciones.some((t) => t?.includes('Correr 10 km'))).toBe(false)
    expect(opciones.some((t) => t?.startsWith('Salud') && !t.includes('Cambiar'))).toBe(false)
  })

  it('cambia el estado sin propagarlo a los subobjetivos', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Salud')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambiar estado de «Salud»' }), 'EN_PAUSA')
    await waitFor(() => expect(actualizarObjetivo).toHaveBeenCalledWith(1, { nombre: 'Salud', descripcion: null, estado: 'EN_PAUSA', prioridad: 'ALTA', padreId: null }))
    await waitFor(() => expect(aviso()).toHaveTextContent('«Salud» pasó a En pausa'))
    expect(actualizarObjetivo).toHaveBeenCalledTimes(1)
  })

  it('borrar con proyectos (409) muestra el mensaje del servidor y no saca la fila', async () => {
    vi.mocked(borrarObjetivo).mockRejectedValue(new ApiError(409, 'El objetivo 1 tiene proyectos: cámbiales el objetivo o bórralos primero'))
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Salud')
    const dialogo = await abrirMenu(user, 'Salud', 'Borrar')
    expect(within(dialogo).getByRole('heading', { name: 'Borrar objetivo' })).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El objetivo 1 tiene proyectos: cámbiales el objetivo o bórralos primero')
    expect(screen.getByRole('link', { name: 'Salud', hidden: true })).toBeInTheDocument()
  })

  it('borra un objetivo vacío y avisa', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Correr 10 km')
    const dialogo = await abrirMenu(user, 'Correr 10 km', 'Borrar')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrarObjetivo).toHaveBeenCalledWith(2))
    await waitFor(() => expect(aviso()).toHaveTextContent('«Correr 10 km» borrado'))
  })
})
