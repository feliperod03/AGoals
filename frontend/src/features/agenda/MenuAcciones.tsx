import { Ellipsis } from 'lucide-react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { puedePosponer } from './formularioTarea'
import type { Acciones } from './useAccionesTarea'

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Menú "Acciones de «título»": agendar para hoy (solo si la página pasa `alAgendar`), posponer (solo abiertas con fecha), cancelar o reactivar, y borrar. */
export function MenuAcciones({ tarea, acciones, alAgendar }: { tarea: Tarea; acciones: Acciones; alAgendar?: (tarea: Tarea) => void }) {
  const cancelada = tarea.estado === 'CANCELADO'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Acciones de «${tarea.titulo}»`}
        disabled={acciones.pendiente}
        className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full text-mut hover:bg-muted disabled:opacity-60', FOCO)}
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {alAgendar && <DropdownMenuItem onSelect={() => alAgendar(tarea)}>Agendar para hoy</DropdownMenuItem>}
        {puedePosponer(tarea) && <DropdownMenuItem onSelect={() => acciones.pedirPosponer(tarea)}>Posponer</DropdownMenuItem>}
        {cancelada ? (
          <DropdownMenuItem onSelect={() => acciones.ejecutar('reactivar', tarea)}>Reactivar</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => acciones.ejecutar('cancelar', tarea)}>Cancelar</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => acciones.pedirBorrado(tarea)}>Borrar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
