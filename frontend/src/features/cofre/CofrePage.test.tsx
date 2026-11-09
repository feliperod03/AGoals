import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Proyecto } from '@/types/proyecto'
import { CLAVE_ANCLADOS } from './anclados'
import { CofrePage } from './CofrePage'
import { tarea } from './fabrica'

vi.mock('@/api/tareas', () => ({
  getTareas: vi.fn(),
  crearTarea: vi.fn(),
  actualizarTarea: vi.fn(),
  marcarHecha: vi.fn(),
  reabrirTarea: vi.fn(),
  posponerTarea: vi.fn(),
  borrarTarea: vi.fn(),
  agendarTarea: vi.fn(),
}))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeTarea: vi.fn(), borrarRecordatorio: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, agendarTarea, borrarTarea, crearTarea, getTareas, marcarHecha } from '@/api/tareas'

const HOY = '2026-11-10'

function proyecto(parcial: Partial<Proyecto>): Proyecto {
  return { id: 1, nombre: 'Proyecto', descripcion: null, estado: 'PENDIENTE', prioridad: null, padreId: null, objetivoId: null, fechaCreacion: '2026-11-01T10:00:00-03:00', ...parcial }
}

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CofrePage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  // Solo se falsea `Date` (no los timers): TanStack Query sigue funcionando normal.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  localStorage.clear()
  vi.mocked(getTareas).mockResolvedValue([])
  vi.mocked(getProyectos).mockResolvedValue([])
  vi.mocked(getObjetivos).mockResolvedValue([])
  vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([])
})
afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

/** Los títulos de las filas en el orden en que aparecen. */
function titulos() {
  return screen.getAllByRole('listitem').flatMap((li) => {
    const titulo = li.querySelector('span.truncate')
    return titulo ? [titulo.textContent ?? ''] : []
  })
}

describe('CofrePage: vista por defecto y estados', () => {
  it('muestra solo las tareas abiertas sin fecha', async () => {
    vi.mocked(getTareas).mockResolvedValue([
      tarea({ id: 1, titulo: 'Idea suelta' }),
      tarea({ id: 2, titulo: 'Con fecha', fecha: '2026-11-12' }),
      tarea({ id: 3, titulo: 'Ya hecha', estado: 'HECHO' }),
    ])
    renderizar()
    expect(await screen.findByText('Idea suelta')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cofre', level: 1 })).toBeInTheDocument()
    expect(screen.queryByText('Con fecha')).not.toBeInTheDocument()
    expect(screen.queryByText('Ya hecha')).not.toBeInTheDocument()
    expect(screen.getByText('1 tarea')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sin fecha' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('muestra cargando, error y vacío', async () => {
    vi.mocked(getTareas).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar()
    expect(screen.getByText('Cargando tus tareas…')).toBeInTheDocument()
    expect(await screen.findByText('Error del servidor')).toBeInTheDocument()
  })

  it('vacío: texto de la vista por defecto o de filtros activos', async () => {
    const user = userEvent.setup()
    renderizar()
    expect(await screen.findByText('No hay tareas sin fecha.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar por título'), 'zzz')
    expect(screen.getByText('Ninguna tarea coincide con los filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a la vista por defecto' }))
    expect(screen.getByText('No hay tareas sin fecha.')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por título')).toHaveValue('')
  })
})

describe('CofrePage: filtros y orden', () => {
  const TAREAS = [
    tarea({ id: 1, titulo: 'Sin fecha media', prioridad: 'MEDIA' }),
    tarea({ id: 2, titulo: 'Atrasada alta', prioridad: 'ALTA', fecha: '2026-11-01' }),
    tarea({ id: 3, titulo: 'Futura', fecha: '2026-11-20' }),
    tarea({ id: 4, titulo: 'Sin fecha alta', prioridad: 'ALTA' }),
    tarea({ id: 5, titulo: 'Hecha', estado: 'HECHO', prioridad: 'BAJA' }),
  ]

  it('un acceso rápido cambia solo su dimensión y se puede apagar', async () => {
    vi.mocked(getTareas).mockResolvedValue(TAREAS)
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Sin fecha media')

    await user.click(screen.getByRole('button', { name: 'Atrasadas' }))
    expect(screen.getByText('Atrasada alta')).toBeInTheDocument()
    expect(screen.queryByText('Sin fecha media')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atrasadas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sin fecha' })).toHaveAttribute('aria-pressed', 'false')

    // Se suma con AND a otro acceso rápido.
    await user.click(screen.getByRole('button', { name: 'Prioridad alta' }))
    expect(titulos()).toEqual(['Atrasada alta'])

    // Apagar «Atrasadas» vuelve su dimensión a "todas" (no a la vista por defecto).
    await user.click(screen.getByRole('button', { name: 'Atrasadas' }))
    expect(titulos()).toEqual(['Atrasada alta', 'Sin fecha alta'])
  })

  it('«Más filtros» ofrece los filtros completos', async () => {
    vi.mocked(getTareas).mockResolvedValue(TAREAS)
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Sin fecha media')

    await user.click(screen.getByRole('button', { name: 'Más filtros' }))
    await user.selectOptions(screen.getByLabelText('Fecha'), 'todas')
    expect(titulos()).toContain('Futura')
    expect(titulos()).not.toContain('Hecha')

    await user.selectOptions(screen.getByLabelText('Estado'), 'todas')
    expect(titulos()).toContain('Hecha')

    await user.selectOptions(screen.getByLabelText('Prioridad'), 'BAJA')
    expect(titulos()).toEqual(['Hecha'])
  })

  it('rango de fechas: inclusivo y avisa si el inicio es posterior al fin', async () => {
    vi.mocked(getTareas).mockResolvedValue(TAREAS)
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Sin fecha media')
    await user.click(screen.getByRole('button', { name: 'Más filtros' }))
    await user.selectOptions(screen.getByLabelText('Fecha'), 'rango')
    await user.type(screen.getByLabelText('Desde'), '2026-11-01')
    await user.type(screen.getByLabelText('Hasta'), '2026-11-01')
    expect(titulos()).toEqual(['Atrasada alta'])

    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2026-10-01')
    expect(screen.getByRole('alert')).toHaveTextContent('«Desde» es posterior a «Hasta»')
  })

  it('filtra por vínculo: proyecto concreto y sueltas', async () => {
    vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 7, nombre: 'Casa nueva' }), proyecto({ id: 8, nombre: 'Viaje', estado: 'HECHO' })])
    vi.mocked(getTareas).mockResolvedValue([
      tarea({ id: 1, titulo: 'Pintar', proyectoId: 7 }),
      tarea({ id: 2, titulo: 'Reservar', proyectoId: 8 }),
      tarea({ id: 3, titulo: 'Suelta' }),
    ])
    const user = userEvent.setup()
    renderizar()
    // Cada fila rotula su proyecto por nombre, también si el proyecto está cerrado.
    expect(await screen.findByText('Proyecto: Casa nueva')).toBeInTheDocument()
    expect(await screen.findByText('Proyecto: Viaje')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Más filtros' }))
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'proyecto')
    await user.selectOptions(await screen.findByLabelText('Proyecto'), 'Casa nueva')
    expect(titulos()).toEqual(['Pintar'])

    await user.selectOptions(screen.getByLabelText('Vínculo'), 'suelta')
    expect(titulos()).toEqual(['Suelta'])
  })

  it('ordena por prioridad (alta primero) y se puede cambiar el orden y el sentido', async () => {
    vi.mocked(getTareas).mockResolvedValue([
      tarea({ id: 1, titulo: 'Baja', prioridad: 'BAJA', fechaCreacion: '2026-10-01T10:00:00-03:00' }),
      tarea({ id: 2, titulo: 'Alta', prioridad: 'ALTA', fechaCreacion: '2026-11-05T10:00:00-03:00' }),
      tarea({ id: 3, titulo: 'Sin prioridad', fechaCreacion: '2026-11-08T10:00:00-03:00' }),
    ])
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Sin prioridad')
    expect(titulos()).toEqual(['Alta', 'Baja', 'Sin prioridad'])

    await user.click(screen.getByRole('button', { name: /Invertir el sentido/ }))
    expect(titulos()).toEqual(['Baja', 'Alta', 'Sin prioridad'])

    // Al cambiar de orden el sentido vuelve al natural: antigüedad = más antiguas primero.
    await user.click(screen.getByRole('button', { name: 'Antigüedad' }))
    expect(screen.getByRole('button', { name: 'Antigüedad' })).toHaveAttribute('aria-pressed', 'true')
    expect(titulos()).toEqual(['Baja', 'Alta', 'Sin prioridad'])
    await user.click(screen.getByRole('button', { name: /Invertir el sentido/ }))
    expect(titulos()).toEqual(['Sin prioridad', 'Alta', 'Baja'])
  })
})

describe('CofrePage: accesos rápidos anclados', () => {
  it('por defecto: Sin fecha, Atrasadas y Prioridad alta', async () => {
    renderizar()
    await screen.findByText('No hay tareas sin fecha.')
    const grupo = screen.getByRole('group', { name: 'Accesos rápidos' })
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sin fecha', 'Atrasadas', 'Prioridad alta'])
  })

  it('se eligen hasta tres, se guardan en localStorage y se recuerdan al volver', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('No hay tareas sin fecha.')
    await user.click(screen.getByRole('button', { name: 'Más filtros' }))
    const accesos = screen.getByRole('group', { name: /hasta 3/ })

    // Con tres marcados, el resto queda deshabilitado.
    expect(within(accesos).getByRole('checkbox', { name: 'Futuras' })).toBeDisabled()
    await user.click(within(accesos).getByRole('checkbox', { name: 'Atrasadas' }))
    expect(within(accesos).getByRole('checkbox', { name: 'Futuras' })).toBeEnabled()
    await user.click(within(accesos).getByRole('checkbox', { name: 'Futuras' }))

    expect(JSON.parse(localStorage.getItem(CLAVE_ANCLADOS) ?? 'null')).toEqual(['sinFecha', 'prioridadAlta', 'futuras'])
    expect(within(screen.getByRole('group', { name: 'Accesos rápidos' })).queryByRole('button', { name: 'Atrasadas' })).not.toBeInTheDocument()
  })

  it('usa lo guardado, y si está corrupto vuelve a los de fábrica', async () => {
    localStorage.setItem(CLAVE_ANCLADOS, JSON.stringify(['sueltas']))
    renderizar()
    await screen.findByText('No hay tareas sin fecha.')
    const grupo = screen.getByRole('group', { name: 'Accesos rápidos' })
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sueltas'])
  })

  it('con localStorage corrupto la página funciona con los de fábrica', async () => {
    localStorage.setItem(CLAVE_ANCLADOS, '{roto')
    renderizar()
    await screen.findByText('No hay tareas sin fecha.')
    expect(within(screen.getByRole('group', { name: 'Accesos rápidos' })).getAllByRole('button')).toHaveLength(3)
  })
})

describe('CofrePage: subtareas anidadas', () => {
  it('anida las hijas, marca la subtarea cuya madre no se ve y cuenta las ocultas', async () => {
    vi.mocked(getTareas).mockResolvedValue([
      tarea({ id: 1, titulo: 'Madre' }),
      tarea({ id: 2, titulo: 'Hija abierta', padreId: 1 }),
      tarea({ id: 3, titulo: 'Hija hecha', padreId: 1, estado: 'HECHO' }),
      tarea({ id: 4, titulo: 'Madre con fecha', fecha: '2026-11-12' }),
      tarea({ id: 5, titulo: 'Hija sin fecha de madre con fecha', padreId: 4 }),
    ])
    renderizar()
    await screen.findByText('Madre')

    const madre = screen.getByText('Madre').closest('li')!
    expect(within(madre).getByText('Hija abierta')).toBeInTheDocument()
    expect(within(madre).queryByText('Hija hecha')).not.toBeInTheDocument()
    expect(within(madre).getByText('+1 subtarea oculta por el filtro')).toBeInTheDocument()

    const huerfana = screen.getByText('Hija sin fecha de madre con fecha').closest('li')!
    expect(within(huerfana).getByText('Subtarea de «Madre con fecha»')).toBeInTheDocument()
    expect(screen.queryByText('Madre con fecha')).not.toBeInTheDocument()
  })
})

describe('CofrePage: acciones', () => {
  it('marcar hecha usa la misma acción que Hoy y refresca la lista', async () => {
    const t = tarea({ id: 1, titulo: 'Idea' })
    vi.mocked(getTareas).mockResolvedValueOnce([t]).mockResolvedValue([])
    vi.mocked(marcarHecha).mockResolvedValue({ ...t, estado: 'HECHO' })
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Marcar «Idea» como hecha' }))
    expect(marcarHecha).toHaveBeenCalledWith(1)
    expect(await screen.findByRole('status')).toHaveTextContent('Marcada como hecha')
    await waitFor(() => expect(screen.queryByText('Idea')).not.toBeInTheDocument())
  })

  it('borrar una tarea con subtareas ofrece conservar o borrar y manda el modo elegido', async () => {
    const madre = tarea({ id: 1, titulo: 'Madre' })
    const hija = tarea({ id: 2, titulo: 'Hija', padreId: 1 })
    vi.mocked(getTareas).mockResolvedValue([madre, hija])
    vi.mocked(borrarTarea).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Madre»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Borrar tarea' })
    expect(await within(dialogo).findByText('«Madre» tiene 1 subtarea.')).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('radio', { name: /Borrar también las subtareas/ }))
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar la tarea y 1 subtarea' }))
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(1, 'borrar'))
    expect(await screen.findByRole('status')).toHaveTextContent('«Madre» borrada con 1 subtarea')
  })

  it('desde el Cofre se puede sacar una subtarea de su madre y la lista se refresca', async () => {
    const madre = tarea({ id: 1, titulo: 'Madre' })
    const hija = tarea({ id: 2, titulo: 'Hija', padreId: 1 })
    vi.mocked(getTareas).mockResolvedValueOnce([madre, hija]).mockResolvedValue([madre, { ...hija, padreId: null }])
    vi.mocked(actualizarTarea).mockResolvedValue({ ...hija, padreId: null })
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: /^Hija/ }))
    const dialogo = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Cambiar' })).toBeEnabled())
    expect(within(dialogo).getByTestId('madre-actual')).toHaveTextContent('«Madre»')
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar' }))
    await user.click(within(dialogo).getByRole('button', { name: /^Sin madre/ }))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledWith(2, expect.objectContaining({ padreId: null })))
    expect(await screen.findByRole('status')).toHaveTextContent('«Hija» ya no es subtarea')
    // La invalidación de ['tareas'] vuelve a pedir la lista (la apertura del diálogo ya cuenta una).
    await waitFor(() => expect(vi.mocked(getTareas).mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('cada fila son tres botones hermanos con nombre accesible', async () => {
    vi.mocked(getTareas).mockResolvedValue([tarea({ id: 1, titulo: 'Idea' })])
    renderizar()
    const fila = (await screen.findByText('Idea')).closest('li')!
    expect(within(fila).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Marcar «Idea» como hecha',
      'IdeaSin fecha',
      'Acciones de «Idea»',
    ])
  })

  it('una tarea creada sin fecha aparece en la vista por defecto', async () => {
    const nueva = tarea({ id: 9, titulo: 'Nueva idea' })
    vi.mocked(getTareas).mockResolvedValueOnce([]).mockResolvedValue([nueva])
    vi.mocked(crearTarea).mockResolvedValue(nueva)
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('No hay tareas sin fecha.')
    await user.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    await user.type(screen.getByLabelText('Título'), 'Nueva idea')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Nueva idea')).toBeInTheDocument()
    expect(crearTarea).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Nueva idea', fecha: null }))
  })

  it('"Agregar subtarea" crea la subtarea con padreId y aparece anidada bajo la madre', async () => {
    const madre = tarea({ id: 1, titulo: 'Madre' })
    const hija = tarea({ id: 9, titulo: 'Paso nuevo', padreId: 1 })
    vi.mocked(getTareas).mockResolvedValueOnce([madre]).mockResolvedValue([madre, hija])
    vi.mocked(crearTarea).mockResolvedValue(hija)
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Madre»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Agregar subtarea' }))
    expect(await screen.findByRole('heading', { name: 'Nueva subtarea de «Madre»' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Título'), 'Paso nuevo')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(crearTarea).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Paso nuevo', fecha: null, padreId: 1 }))
    expect(await screen.findByRole('status')).toHaveTextContent('Subtarea agregada a «Madre»')
    const fila = (await screen.findByText('Madre')).closest('li')!
    expect(await within(fila).findByText('Paso nuevo')).toBeInTheDocument()
  })
})

describe('CofrePage: agendar para hoy', () => {
  async function abrirMenu(user: ReturnType<typeof userEvent.setup>, titulo: string) {
    await user.click(await screen.findByRole('button', { name: `Acciones de «${titulo}»` }))
  }

  it('sin subtareas candidatas agenda directo, sin diálogo, y avisa', async () => {
    const t = tarea({ id: 1, titulo: 'Idea' })
    vi.mocked(getTareas).mockResolvedValue([t])
    vi.mocked(agendarTarea).mockResolvedValue([{ ...t, fecha: HOY }])
    const user = userEvent.setup()
    renderizar()
    await abrirMenu(user, 'Idea')
    await user.click(screen.getByRole('menuitem', { name: 'Agendar para hoy' }))
    expect(agendarTarea).toHaveBeenCalledWith(1, { fecha: HOY, hoy: HOY, incluirSubtareas: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('«Idea» agendada para hoy')
    expect(screen.getByRole('status')).not.toHaveTextContent('subtarea')
  })

  it('en ese caso un 409 se muestra en el cartel de error de la página', async () => {
    vi.mocked(getTareas).mockResolvedValue([tarea({ id: 1, titulo: 'Idea' })])
    vi.mocked(agendarTarea).mockRejectedValue(new ApiError(409, 'La tarea está cerrada'))
    const user = userEvent.setup()
    renderizar()
    await abrirMenu(user, 'Idea')
    await user.click(screen.getByRole('menuitem', { name: 'Agendar para hoy' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La tarea está cerrada')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('con subtareas candidatas abre el diálogo con «Incluir N subtareas» marcado', async () => {
    const madre = tarea({ id: 1, titulo: 'Madre' })
    vi.mocked(getTareas).mockResolvedValue([
      madre,
      tarea({ id: 2, titulo: 'Hija 1', padreId: 1 }),
      tarea({ id: 3, titulo: 'Nieta', padreId: 2, fecha: '2026-11-01' }),
      tarea({ id: 4, titulo: 'Hija de hoy', padreId: 1, fecha: HOY }),
    ])
    vi.mocked(agendarTarea).mockResolvedValue([{ ...madre, fecha: HOY }, tarea({ id: 2 }), tarea({ id: 3 })])
    const user = userEvent.setup()
    renderizar()
    await abrirMenu(user, 'Madre')
    await user.click(screen.getByRole('menuitem', { name: 'Agendar para hoy' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Agendar para hoy' })
    const casilla = within(dialogo).getByRole('checkbox', { name: 'Incluir 2 subtareas' })
    expect(casilla).toBeChecked()
    expect(agendarTarea).not.toHaveBeenCalled()

    await user.click(within(dialogo).getByRole('button', { name: 'Agendar para hoy' }))
    expect(agendarTarea).toHaveBeenCalledWith(1, { fecha: HOY, hoy: HOY, incluirSubtareas: true })
    // N = tareas devueltas − 1 (la madre viene primera).
    expect(await screen.findByText('«Madre» agendada para hoy (con 2 subtareas)')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('desmarcar la casilla manda incluirSubtareas en false', async () => {
    const madre = tarea({ id: 1, titulo: 'Madre' })
    vi.mocked(getTareas).mockResolvedValue([madre, tarea({ id: 2, titulo: 'Hija', padreId: 1 })])
    vi.mocked(agendarTarea).mockResolvedValue([{ ...madre, fecha: HOY }])
    const user = userEvent.setup()
    renderizar()
    await abrirMenu(user, 'Madre')
    await user.click(screen.getByRole('menuitem', { name: 'Agendar para hoy' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Agendar para hoy' })
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Incluir 1 subtarea' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Agendar para hoy' }))
    expect(agendarTarea).toHaveBeenCalledWith(1, { fecha: HOY, hoy: HOY, incluirSubtareas: false })
    expect(await screen.findByText('«Madre» agendada para hoy')).toBeInTheDocument()
  })

  it('un error dentro del diálogo se ve ahí y el diálogo sigue abierto', async () => {
    vi.mocked(getTareas).mockResolvedValue([tarea({ id: 1, titulo: 'Madre' }), tarea({ id: 2, titulo: 'Hija', padreId: 1 })])
    vi.mocked(agendarTarea).mockRejectedValue(new ApiError(409, 'La tarea está cerrada'))
    const user = userEvent.setup()
    renderizar()
    await abrirMenu(user, 'Madre')
    await user.click(screen.getByRole('menuitem', { name: 'Agendar para hoy' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Agendar para hoy' })
    await user.click(within(dialogo).getByRole('button', { name: 'Agendar para hoy' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La tarea está cerrada')
    expect(screen.getByRole('dialog', { name: 'Agendar para hoy' })).toBeInTheDocument()
  })

  it('no se ofrece si la fecha es hoy ni si la tarea está cerrada', async () => {
    vi.mocked(getTareas).mockResolvedValue([tarea({ id: 1, titulo: 'De hoy', fecha: HOY }), tarea({ id: 2, titulo: 'Cerrada', estado: 'HECHO' })])
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Más filtros' }))
    await user.selectOptions(screen.getByLabelText('Fecha'), 'todas')
    await user.selectOptions(screen.getByLabelText('Estado'), 'todas')
    await user.click(screen.getByRole('button', { name: 'Más filtros' }))

    await abrirMenu(user, 'De hoy')
    expect(screen.getByRole('menuitem', { name: 'Posponer' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Agendar para hoy' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    await abrirMenu(user, 'Cerrada')
    expect(screen.queryByRole('menuitem', { name: 'Agendar para hoy' })).not.toBeInTheDocument()
  })

  it('se ofrece en tareas atrasadas y futuras', async () => {
    vi.mocked(getTareas).mockResolvedValue([tarea({ id: 1, titulo: 'Vieja', fecha: '2026-11-01' }), tarea({ id: 2, titulo: 'Lejana', fecha: '2026-11-30' })])
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Más filtros' }))
    await user.selectOptions(screen.getByLabelText('Fecha'), 'con')
    await abrirMenu(user, 'Vieja')
    expect(screen.getByRole('menuitem', { name: 'Agendar para hoy' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await abrirMenu(user, 'Lejana')
    expect(screen.getByRole('menuitem', { name: 'Agendar para hoy' })).toBeInTheDocument()
  })
})
