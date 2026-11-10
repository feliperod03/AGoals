import { CircleCheck, Lightbulb } from 'lucide-react'

import type { ItemJerarquico } from '@/features/jerarquia/tipos'
import { formatearFechaCorta } from '@/lib/fechas'
import type { Idea } from '@/types/idea'
import { MenuAccionesIdea } from './MenuAccionesIdea'
import type { AccionesIdeas } from './useAccionesIdeas'
import { textoVinculo } from './vinculo'

interface Props {
  ideas: Idea[]
  /** `undefined` si la lista no cargó: el vínculo se rotula con «n.º N». */
  proyectos: ItemJerarquico[] | undefined
  objetivos: ItemJerarquico[] | undefined
  acciones: AccionesIdeas
}

export function ListaIdeas({ ideas, proyectos, objetivos, acciones }: Props) {
  return (
    <ul className="flex flex-col">
      {ideas.map((idea) => (
        <FilaIdea key={idea.id} idea={idea} vinculo={textoVinculo(idea, proyectos, objetivos)} acciones={acciones} />
      ))}
    </ul>
  )
}

function FilaIdea({ idea, vinculo, acciones }: { idea: Idea; vinculo: string; acciones: AccionesIdeas }) {
  const concluida = idea.estado === 'CONCLUIDA'
  const Icono = concluida ? CircleCheck : Lightbulb
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-start gap-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium break-words">{idea.titulo}</span>
          {idea.descripcion && <p className="text-sm break-words whitespace-pre-line text-mut">{idea.descripcion}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mut">
            {/* Estado en texto además del ícono: no depende solo del color. */}
            <span className="inline-flex items-center gap-1">
              <Icono className={concluida ? 'size-4 text-mut' : 'size-4 text-gold'} aria-hidden="true" />
              {concluida ? 'Concluida' : 'Planteada'}
            </span>
            <span>{vinculo}</span>
            <span>Creada el {formatearFechaCorta(idea.fechaCreacion)}</span>
            {concluida && idea.fechaCierre && <span>Cerrada el {formatearFechaCorta(idea.fechaCierre)}</span>}
          </div>
          {idea.conclusion && (
            <p className="mt-1 rounded-xl bg-muted px-3 py-2 text-sm break-words whitespace-pre-line text-tx">
              <span className="font-medium">Conclusión: </span>
              {idea.conclusion}
            </p>
          )}
        </div>
        <MenuAccionesIdea idea={idea} acciones={acciones} />
      </div>
    </li>
  )
}
