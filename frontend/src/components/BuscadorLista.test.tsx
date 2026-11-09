import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BuscadorLista, FilaBuscador, MAX_FILAS_BUSCADOR, type CandidataBuscador } from './BuscadorLista'

interface Cosa {
  id: number
  nombre: string
}

const cand = (id: number, texto: string, detalle = 'detalle'): CandidataBuscador<Cosa> => ({ item: { id, nombre: texto }, texto, detalle })

function renderizar(candidatas: CandidataBuscador<Cosa>[], extra: Partial<Parameters<typeof BuscadorLista<Cosa>>[0]> = {}) {
  const alElegir = vi.fn()
  render(<BuscadorLista idInput="buscar" idPanel="panel" etiqueta="Buscar cosa" candidatas={candidatas} alElegir={alElegir} {...extra} />)
  return alElegir
}

describe('BuscadorLista', () => {
  it('enfoca la búsqueda al montarse y lista las candidatas con su detalle', () => {
    renderizar([cand(1, 'Casa', 'Principal'), cand(2, 'Auto')])
    expect(screen.getByLabelText('Buscar cosa')).toHaveFocus()
    expect(screen.getByRole('button', { name: /Casa/ })).toHaveTextContent('Principal')
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('filtra sin tildes ni mayúsculas y elige con un clic', async () => {
    const user = userEvent.setup()
    const alElegir = renderizar([cand(1, 'Acción'), cand(2, 'Otra')])
    await user.type(screen.getByLabelText('Buscar cosa'), 'ACCION')
    expect(screen.queryByRole('button', { name: /Otra/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Acción/ }))
    expect(alElegir).toHaveBeenCalledWith({ id: 1, nombre: 'Acción' })
  })

  it('Enter elige solo si hay una única coincidencia, y no envía el formulario', async () => {
    const user = userEvent.setup()
    const alEnviar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const alElegir = vi.fn()
    render(
      <form onSubmit={alEnviar}>
        <BuscadorLista idInput="b" idPanel="p" etiqueta="Buscar" candidatas={[cand(1, 'Casa'), cand(2, 'Casino')]} alElegir={alElegir} />
      </form>,
    )
    await user.type(screen.getByLabelText('Buscar'), 'cas{Enter}')
    expect(alElegir).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Buscar'), 'a{Enter}') // "casa": única
    expect(alElegir).toHaveBeenCalledWith({ id: 1, nombre: 'Casa' })
    expect(alEnviar).not.toHaveBeenCalled()
  })

  it('sin coincidencias muestra el texto vacío', async () => {
    const user = userEvent.setup()
    renderizar([cand(1, 'Casa')], { textoVacio: 'Ningún proyecto coincide.' })
    await user.type(screen.getByLabelText('Buscar cosa'), 'zzz')
    expect(screen.getByText('Ningún proyecto coincide.')).toBeInTheDocument()
  })

  it('marca la fila actual y muestra la fila inicial', () => {
    renderizar([cand(1, 'Casa'), cand(2, 'Auto')], {
      idActual: 2,
      filaInicial: (
        <FilaBuscador actual={false} alElegir={() => {}}>
          <span>Sin padre</span>
        </FilaBuscador>
      ),
    })
    expect(screen.getByRole('button', { name: /Auto/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Casa/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Sin padre' })).toBeInTheDocument()
  })

  it('con más de 50 coincidencias muestra 50 y lo avisa', () => {
    renderizar(Array.from({ length: MAX_FILAS_BUSCADOR + 5 }, (_, i) => cand(i + 1, `Cosa ${i + 1}`)))
    expect(screen.getAllByRole('button')).toHaveLength(MAX_FILAS_BUSCADOR)
    expect(screen.getByText(`Mostrando ${MAX_FILAS_BUSCADOR} de ${MAX_FILAS_BUSCADOR + 5}: escribe para acotar.`)).toBeInTheDocument()
  })

  it('deshabilitado: las filas no se pueden activar ni con Enter', async () => {
    const user = userEvent.setup()
    const alElegir = renderizar([cand(1, 'Casa')], { deshabilitado: true })
    expect(screen.getByRole('button', { name: /Casa/ })).toBeDisabled()
    await user.type(screen.getByLabelText('Buscar cosa'), '{Enter}')
    expect(alElegir).not.toHaveBeenCalled()
  })
})
