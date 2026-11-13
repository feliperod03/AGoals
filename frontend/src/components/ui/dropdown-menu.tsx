import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { recordarDisparador } from './retornoFoco'

// Menú desplegable al estilo shadcn sobre Radix: Radix se ocupa del teclado (flechas, Home/End,
// Escape), del foco (vuelve al botón al cerrar) y de los roles ARIA (menu / menuitem).
// Si un ítem abre un diálogo, el foco del diálogo debe volver al botón del menú, no al ítem (que se desmonta):
// cada ítem lo registra en `retornoFoco` al seleccionarse y `dialog.tsx` lo recoge.

interface BotonDelMenu {
  boton: HTMLElement | null
  guardar: (boton: HTMLElement | null) => void
}
const BotonContext = React.createContext<BotonDelMenu | null>(null)

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const [boton, guardar] = React.useState<HTMLElement | null>(null)
  const valor = React.useMemo(() => ({ boton, guardar }), [boton])
  return (
    <BotonContext.Provider value={valor}>
      <DropdownMenuPrimitive.Root {...props} />
    </BotonContext.Provider>
  )
}

function DropdownMenuTrigger({ ref, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  const menu = React.useContext(BotonContext)
  const guardar = menu?.guardar
  // Estable: un ref que cambia en cada render se llamaría con `null` y de nuevo con el botón cada vez.
  const alMontar = React.useCallback(
    (el: HTMLButtonElement | null) => {
      guardar?.(el)
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [guardar, ref],
  )
  return <DropdownMenuPrimitive.Trigger ref={alMontar} {...props} />
}

function DropdownMenuContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-40 rounded-xl border border-line bg-card p-1 text-tx shadow-card data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({ className, onSelect, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  const menu = React.useContext(BotonContext)
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      onSelect={(e) => {
        recordarDisparador(menu?.boton ?? null)
        onSelect?.(e)
      }}
      {...props}
    />
  )
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger }
