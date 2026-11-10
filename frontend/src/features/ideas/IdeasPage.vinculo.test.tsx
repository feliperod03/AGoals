import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import { renderizarIdeas } from '@/test/renderIdeas'
import { idea } from './fabrica'

vi.mock('@/api/ideas', () => ({ getIdeas: vi.fn(), crearIdea: vi.fn(), actualizarIdea: vi.fn(), concluirIdea: vi.fn(), reabrirIdea: vi.fn(), borrarIdea: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
import { getIdeas } from '@/api/ideas'
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'

beforeEach(() => {
  vi.mocked(getIdeas).mockResolvedValue([
    idea({ id: 1, titulo: 'Suelta uno', fechaCreacion: '2026-11-01T10:00:00-03:00' }),
    idea({ id: 2, titulo: 'De la casa', proyectoId: 5, fechaCreacion: '2026-11-02T10:00:00-03:00' }),
    idea({ id: 3, titulo: 'Del viejo', proyectoId: 6, fechaCreacion: '2026-11-03T10:00:00-03:00' }),
    idea({ id: 4, titulo: 'De salud', objetivoId: 8, fechaCreacion: '2026-11-04T10:00:00-03:00' }),
  ])
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 5, nombre: 'Casa' }), proyecto({ id: 6, nombre: 'Archivado', estado: 'HECHO' }), proyecto({ id: 7, nombre: 'Vacío' })])
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 8, nombre: 'Salud' })])
})
afterEach(() => vi.resetAllMocks())

const titulos = () => screen.queryAllByRole('button', { name: /^Acciones de «/ }).map((b) => /«(.*)»/.exec(b.getAttribute('aria-label') ?? '')?.[1])

async function iniciar() {
  const user = userEvent.setup()
  renderizarIdeas()
  await screen.findByText('Suelta uno')
  return user
}

describe('IdeasPage: filtro de vínculo', () => {
  it('«Sueltas» deja solo las que no tienen proyecto ni objetivo', async () => {
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'sueltas')
    expect(titulos()).toEqual(['Suelta uno'])
  })

  it('«De un proyecto» deja las ligadas a cualquier proyecto; elegir uno por nombre acota', async () => {
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'proyecto')
    expect(titulos()).toEqual(['Del viejo', 'De la casa'])
    await user.selectOptions(screen.getByLabelText('Proyecto'), 'Casa')
    expect(titulos()).toEqual(['De la casa'])
  })

  it('la lista de proyectos del filtro incluye los cerrados, que pueden tener ideas', async () => {
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'proyecto')
    const select = screen.getByLabelText('Proyecto')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Cualquier proyecto', 'Archivado', 'Casa', 'Vacío'])
    await user.selectOptions(select, 'Archivado')
    expect(titulos()).toEqual(['Del viejo'])
  })

  it('«De un objetivo» y un objetivo concreto', async () => {
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'objetivo')
    expect(titulos()).toEqual(['De salud'])
    await user.selectOptions(screen.getByLabelText('Objetivo'), 'Salud')
    expect(titulos()).toEqual(['De salud'])
  })

  it('cambiar de tipo vuelve a «cualquiera» (no arrastra el id)', async () => {
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'proyecto')
    await user.selectOptions(screen.getByLabelText('Proyecto'), 'Casa')
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'objetivo')
    expect(screen.getByLabelText('Objetivo')).toHaveValue('')
    expect(titulos()).toEqual(['De salud'])
  })

  it('el texto de vacío nombra el proyecto elegido', async () => {
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'proyecto')
    await user.selectOptions(screen.getByLabelText('Proyecto'), 'Vacío')
    expect(screen.getByText('No hay ideas con estos filtros: Planteadas, Del proyecto «Vacío».')).toBeInTheDocument()
  })

  it('si la lista de proyectos falla, el selector queda deshabilitado con una nota y «Sueltas» sigue andando', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(0, 'sin conexión'))
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'proyecto')
    expect(screen.getByLabelText('Proyecto')).toBeDisabled()
    expect(screen.getByText('No se pudo cargar la lista de proyectos.')).toBeInTheDocument()
    // Sin lista, «cualquier proyecto» sigue funcionando (no necesita nombres).
    expect(titulos()).toEqual(['Del viejo', 'De la casa'])
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'sueltas')
    expect(titulos()).toEqual(['Suelta uno'])
  })

  it('mientras la lista carga, el selector está deshabilitado', async () => {
    vi.mocked(getObjetivos).mockReturnValue(new Promise(() => {}))
    const user = await iniciar()
    await user.selectOptions(screen.getByLabelText('Vínculo'), 'objetivo')
    expect(screen.getByLabelText('Objetivo')).toBeDisabled()
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })
})
