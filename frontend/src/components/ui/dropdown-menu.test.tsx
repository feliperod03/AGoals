import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'

// Como las páginas: el diálogo se abre por estado desde un ítem del menú (no hay `DialogTrigger`).
function Ejemplo({ alCerrarFoco }: { alCerrarFoco?: (e: Event) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [otro, setOtro] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>Acciones</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setAbierto(true)}>Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => undefined}>Cancelar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" onClick={() => setOtro(true)}>
        Otro botón
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent onCloseAutoFocus={alCerrarFoco}>
          <DialogTitle>Uno</DialogTitle>
          <DialogDescription>Descripción</DialogDescription>
        </DialogContent>
      </Dialog>
      <Dialog open={otro} onOpenChange={setOtro}>
        <DialogContent>
          <DialogTitle>Dos</DialogTitle>
          <DialogDescription>Descripción</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  )
}

async function abrirDesdeMenu(user: ReturnType<typeof userEvent.setup>, ítem = 'Editar') {
  await user.click(screen.getByRole('button', { name: 'Acciones' }))
  await user.click(await screen.findByRole('menuitem', { name: ítem }))
}

describe('menú «⋯» + diálogo: foco', () => {
  it('al cerrar con Escape un diálogo abierto desde un ítem, el foco vuelve al botón del menú', async () => {
    const user = userEvent.setup()
    render(<Ejemplo />)
    await abrirDesdeMenu(user)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones' })).toHaveFocus())
  })

  it('con teclado puro (Enter en el ítem) y cerrando con «Cerrar», también vuelve al botón del menú', async () => {
    const user = userEvent.setup()
    render(<Ejemplo />)
    screen.getByRole('button', { name: 'Acciones' }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    await user.keyboard('{Enter}') // primer ítem: Editar
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones' })).toHaveFocus())
  })

  it('un ítem que no abre diálogo no contamina a un diálogo abierto después desde otro botón', async () => {
    const user = userEvent.setup()
    render(<Ejemplo />)
    await abrirDesdeMenu(user, 'Cancelar')
    await user.click(screen.getByRole('button', { name: 'Otro botón' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Otro botón' })).toHaveFocus())
  })

  it('si el consumidor hace preventDefault en onCloseAutoFocus, el foco no vuelve al botón del menú', async () => {
    const user = userEvent.setup()
    render(<Ejemplo alCerrarFoco={(e) => e.preventDefault()} />)
    await abrirDesdeMenu(user)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acciones' })).not.toHaveFocus()
  })
})
