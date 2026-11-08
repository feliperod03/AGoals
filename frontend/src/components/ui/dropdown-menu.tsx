import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Menú desplegable al estilo shadcn sobre Radix: Radix se ocupa del teclado (flechas, Home/End,
// Escape), del foco (vuelve al botón al cerrar) y de los roles ARIA (menu / menuitem).

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

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

function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger }
