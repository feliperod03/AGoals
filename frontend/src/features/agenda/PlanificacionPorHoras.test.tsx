import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlanificacionPorHoras } from './PlanificacionPorHoras'

const AHORA = new Date('2026-11-10T12:00:00-03:00')

function renderizar(fecha: string) {
  render(<PlanificacionPorHoras bloques={[]} fecha={fecha} ahora={AHORA} cargando={false} errores={[]} />)
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
