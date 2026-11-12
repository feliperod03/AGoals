import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Tarjeta } from './Tarjeta'

describe('Tarjeta', () => {
  it('con título dibuja el h2 (y no le pone aria-label a la sección)', () => {
    render(<Tarjeta titulo="Lista del día">contenido</Tarjeta>)
    expect(screen.getByRole('heading', { name: 'Lista del día', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('sin título no dibuja h2 y usa ariaLabel como nombre', () => {
    render(<Tarjeta ariaLabel="Proyectos">contenido</Tarjeta>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Proyectos' })).toBeInTheDocument()
  })
})
