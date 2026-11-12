import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlanificacionPorHoras } from './PlanificacionPorHoras'

const AHORA = new Date('2026-11-10T12:00:00-03:00')

function renderizar(fecha: string) {
  render(<PlanificacionPorHoras bloques={[]} fecha={fecha} ahora={AHORA} cargando={false} errores={[]} alEditar={() => {}} />)
}

describe('PlanificacionPorHoras: línea de "ahora"', () => {
  it('aparece si el día mostrado es hoy', () => {
    renderizar('2026-11-10')
    expect(screen.getByTestId('linea-ahora')).toBeInTheDocument()
  })

  it('no aparece si el día mostrado no es hoy', () => {
    renderizar('2026-11-11')
    expect(screen.queryByTestId('linea-ahora')).not.toBeInTheDocument()
    renderizar('2026-11-09')
    expect(screen.queryByTestId('linea-ahora')).not.toBeInTheDocument()
  })

  it('se coloca según la hora: a las 12:00 con rango 08-21 está a 4 horas del inicio', () => {
    renderizar('2026-11-10')
    expect(screen.getByTestId('linea-ahora').style.top).toBe('224px')
  })
})

describe('PlanificacionPorHoras: medianoche', () => {
  it('un bloque que termina a las 24:00 se escribe 22:00–00:00 y el eje no rotula las 24:00', () => {
    const bloque = { clave: 'e1', tipo: 'evento' as const, titulo: 'Guardia', inicioMin: 1320, finMin: 1440, prioridad: null }
    render(<PlanificacionPorHoras bloques={[bloque]} fecha="2026-11-10" ahora={AHORA} cargando={false} errores={[]} alEditar={() => {}} />)
    expect(screen.getByText('EVENTO · 22:00–00:00')).toBeInTheDocument()
    expect(screen.queryByText('24:00')).not.toBeInTheDocument()
    expect(screen.queryByText(/24:00/)).not.toBeInTheDocument()
    expect(screen.getByText('23:00')).toBeInTheDocument()
  })
})
