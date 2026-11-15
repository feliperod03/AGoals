import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'

function Ejemplo({ alCerrarFoco }: { alCerrarFoco?: (e: Event) => void }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>
        Abrir
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent onCloseAutoFocus={alCerrarFoco}>
          <DialogTitle>Uno</DialogTitle>
          <DialogDescription>Descripción</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Apilados() {
  const [a, setA] = useState(false)
  const [b, setB] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setA(true)}>
        Abrir A
      </button>
      <Dialog open={a} onOpenChange={setA}>
        <DialogContent>
          <DialogTitle>A</DialogTitle>
          <DialogDescription>desc a</DialogDescription>
          <button type="button" onClick={() => setB(true)}>
            Abrir B
          </button>
          <Dialog open={b} onOpenChange={setB}>
            <DialogContent>
              <DialogTitle>B</DialogTitle>
              <DialogDescription>desc b</DialogDescription>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </>
  )
}

describe('DialogContent: devolver el foco', () => {
  it('al cerrar, el foco vuelve al botón que lo abrió', async () => {
    const user = userEvent.setup()
    render(<Ejemplo />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus())
  })

  it('si el consumidor hace preventDefault en onCloseAutoFocus, no enfoca nada', async () => {
    const user = userEvent.setup()
    render(<Ejemplo alCerrarFoco={(e) => e.preventDefault()} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).not.toHaveFocus()
  })

  function Efimero({ conRespaldo }: { conRespaldo: boolean }) {
    const [mostrar, setMostrar] = useState(true)
    const [abierto, setAbierto] = useState(false)
    return (
      <>
        {conRespaldo && (
          <h1 data-foco-respaldo tabIndex={-1}>
            Página
          </h1>
        )}
        {mostrar && (
          <button type='button' onClick={() => setAbierto(true)}>
            Abrir
          </button>
        )}
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogContent>
            <DialogTitle>X</DialogTitle>
            <DialogDescription>X</DialogDescription>
            <button
              type='button'
              onClick={() => {
                setMostrar(false)
                setAbierto(false)
              }}
            >
              Quitar y cerrar
            </button>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  it('si el disparador ya no existe y la página no tiene respaldo, no lanza ni enfoca nada', async () => {
    const user = userEvent.setup()
    render(<Efimero conRespaldo={false} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await user.click(await screen.findByRole('button', { name: 'Quitar y cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('si el disparador ya no existe y la página tiene un elemento de respaldo, el foco va ahí', async () => {
    const user = userEvent.setup()
    render(<Efimero conRespaldo />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await user.click(await screen.findByRole('button', { name: 'Quitar y cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Página' })).toHaveFocus())
  })

  it('con diálogos apilados, el de arriba devuelve el foco al botón del de abajo', async () => {
    const user = userEvent.setup()
    render(<Apilados />)
    await user.click(screen.getByRole('button', { name: 'Abrir A' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir B' }))
    await screen.findByText('B')
    await user.keyboard('{Escape}')
    expect(screen.queryByText('B')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir B' })).toHaveFocus())
  })
})
