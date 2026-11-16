import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Evento } from '@/types/evento'
import { elementosPorDia, etiquetaEditarEvento, type ElementoDia } from './calendario'
import { FilaDetalle } from './DetalleDia'
import { ElementoCelda } from './ElementoCelda'

// Indicador «se repite» (§3f): ícono solo en las filas del detalle; en chips y bloques, solo texto (title y nombre accesible).

const DIA = '2026-12-15'

const evento = (serieId: number | null): Evento => ({
  id: 7,
  titulo: 'Reunión',
  descripcion: '',
  fechaHoraInicio: '2026-12-15T09:00:00-03:00',
  fechaHoraFin: '2026-12-15T10:00:00-03:00',
  prioridad: null,
  serieId,
})

function elemento(serieId: number | null): Extract<ElementoDia, { tipo: 'evento' }> {
  const e = (elementosPorDia([DIA], [evento(serieId)], []).get(DIA) ?? [])[0]
  if (!e || e.tipo !== 'evento') throw new Error('se esperaba un evento')
  return e
}

describe('nombre accesible del botón de edición', () => {
  it('un evento de una serie suma «, se repite»', () => {
    expect(etiquetaEditarEvento(elemento(5))).toBe('Editar evento: Reunión, 09:00–10:00, se repite')
  })

  it('un evento suelto queda como siempre', () => {
    expect(etiquetaEditarEvento(elemento(null))).toBe('Editar evento: Reunión, 09:00–10:00')
  })
})

describe('FilaDetalle', () => {
  it('un evento de serie lleva el ícono (decorativo) y el texto «Se repite»', () => {
    const { container } = render(<ul><FilaDetalle elemento={elemento(5)} hoy="2026-12-01" /></ul>)
    expect(screen.getByText('Se repite')).toBeInTheDocument()
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('con edición, el botón nombra «se repite» y el contenido queda aria-hidden', () => {
    render(<ul><FilaDetalle elemento={elemento(5)} hoy="2026-12-01" alAbrirEvento={() => undefined} /></ul>)
    expect(screen.getByRole('button', { name: 'Editar evento: Reunión, 09:00–10:00, se repite' })).toBeInTheDocument()
  })

  it('un evento suelto no lleva ícono ni texto', () => {
    const { container } = render(<ul><FilaDetalle elemento={elemento(null)} hoy="2026-12-01" /></ul>)
    expect(screen.queryByText('Se repite')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})

describe('ElementoCelda (chip del mes)', () => {
  it('un evento de serie lo dice en el title, sin ícono', () => {
    const { container } = render(<ElementoCelda elemento={elemento(5)} />)
    expect(screen.getByTitle('Reunión — 09:00–10:00 (se repite)')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('un evento suelto conserva su title', () => {
    render(<ElementoCelda elemento={elemento(null)} />)
    expect(screen.getByTitle('Reunión — 09:00–10:00')).toBeInTheDocument()
  })
})
