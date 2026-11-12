import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import { elementosPorDia } from './calendario'
import { DetalleDia } from './DetalleDia'

const DIA = '2026-12-15'

const REUNION: Evento = {
  id: 7,
  titulo: 'Reunión',
  descripcion: '',
  fechaHoraInicio: '2026-12-15T09:00:00-03:00',
  fechaHoraFin: '2026-12-15T10:00:00-03:00',
  prioridad: 'ALTA',
}

const TAREA: Tarea = {
  id: 8,
  titulo: 'Pagar la luz',
  descripcion: null,
  estado: 'PENDIENTE',
  prioridad: null,
  fecha: DIA,
  horaInicio: null,
  horaFin: null,
  padreId: null,
  proyectoId: null,
  objetivoId: null,
  vecesPospuesta: 0,
  fechaCreacion: '2026-11-01T10:00:00-03:00',
}

function montar(conAcciones = true) {
  const alAbrirEvento = vi.fn()
  const alAgregarEvento = vi.fn()
  const elementos = elementosPorDia([DIA], [REUNION], [TAREA]).get(DIA) ?? []
  render(
    <DetalleDia
      fecha={DIA}
      hoy="2026-11-10"
      elementos={elementos}
      alAbrirEvento={conAcciones ? alAbrirEvento : undefined}
      alAgregarEvento={conAcciones ? alAgregarEvento : undefined}
    />,
  )
  return { alAbrirEvento, alAgregarEvento }
}

describe('DetalleDia (9c)', () => {
  it('la fila de un evento es un botón que abre su edición; la de una tarea no', async () => {
    const user = userEvent.setup()
    const { alAbrirEvento } = montar()
    await user.click(screen.getByRole('button', { name: 'Editar evento: Reunión, 09:00–10:00' }))
    expect(alAbrirEvento).toHaveBeenCalledWith(REUNION)
    expect(screen.queryByRole('button', { name: /Pagar la luz/ })).not.toBeInTheDocument()
    expect(screen.getByText('Pagar la luz')).toBeVisible()
  })

  it('el botón es vacío (sin div dentro) y el contenido de la fila queda aria-hidden', () => {
    montar()
    const boton = screen.getByRole('button', { name: /^Editar evento: Reunión/ })
    expect(boton).toBeEmptyDOMElement()
    const fila = boton.closest('li') as HTMLElement
    expect(fila).toHaveAttribute('data-evento-id', '7')
    for (const hijo of Array.from(fila.children).filter((h) => h !== boton)) expect(hijo).toHaveAttribute('aria-hidden', 'true')
  })

  it('«Agregar evento» nombra el día y crea en él', async () => {
    const user = userEvent.setup()
    const { alAgregarEvento } = montar()
    await user.click(screen.getByRole('button', { name: 'Agregar evento el martes 15 de diciembre' }))
    expect(alAgregarEvento).toHaveBeenCalledWith(DIA)
  })

  it('sin acciones queda como en 9a: sin botones y con todo legible', () => {
    montar(false)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    const lista = within(screen.getByRole('list'))
    expect(lista.getByText('Reunión')).toBeInTheDocument()
    expect(lista.getByText('EVENTO')).not.toHaveAttribute('aria-hidden')
  })
})
