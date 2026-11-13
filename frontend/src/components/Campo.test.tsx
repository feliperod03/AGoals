import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Campo } from './Campo'

describe('Campo', () => {
  it('asocia la etiqueta con su control', () => {
    render(
      <Campo id="titulo" etiqueta="Título">
        <input id="titulo" />
      </Campo>,
    )
    expect(screen.getByLabelText('Título')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra el error como alerta con id «<id>-error»', () => {
    render(
      <Campo id="titulo" etiqueta="Título" error="Obligatorio">
        <input id="titulo" />
      </Campo>,
    )
    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('Obligatorio')
    expect(alerta).toHaveAttribute('id', 'titulo-error')
  })
})
