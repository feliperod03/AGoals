import { Ellipsis } from 'lucide-react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { ItemJerarquico } from './tipos'
import type { AccionesJerarquia } from './useAccionesJerarquia'

/** Menú "Acciones de «nombre»" de una fila: editar y borrar. */
export function MenuAccionesItem<T extends ItemJerarquico>({ item, acciones }: { item: T; acciones: AccionesJerarquia<T> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Acciones de «${item.nombre}»`}
        disabled={acciones.pendiente}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-mut hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => acciones.abrirEditar(item)}>Editar</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => acciones.pedirBorrado(item)}>Borrar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
