import { Ellipsis } from 'lucide-react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Idea } from '@/types/idea'
import type { AccionesIdeas } from './useAccionesIdeas'

/** Menú «Acciones de «título»» de una fila: Editar, Concluir (planteadas), Reabrir (concluidas) y Borrar. */
export function MenuAccionesIdea({ idea, acciones }: { idea: Idea; acciones: AccionesIdeas }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Acciones de «${idea.titulo}»`}
        disabled={acciones.pendiente}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-mut hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => acciones.abrirEditar(idea)}>Editar</DropdownMenuItem>
        {idea.estado === 'PLANTEADA' && <DropdownMenuItem onSelect={() => acciones.pedirConcluir(idea)}>Concluir</DropdownMenuItem>}
        {idea.estado === 'CONCLUIDA' && <DropdownMenuItem onSelect={() => acciones.reabrir(idea)}>Reabrir</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => acciones.pedirBorrado(idea)}>Borrar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
