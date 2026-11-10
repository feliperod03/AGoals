import { CircleCheck, Lightbulb } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { formatearFechaCorta } from '@/lib/fechas'
import type { Idea } from '@/types/idea'
import { fechaDeOrden } from './filtros'
import { ideasLigadas, rutaIdeasDe, textoMasIdeas, type CampoVinculoIdea } from './ligadas'
import { useIdeas } from './useIdeas'

interface Props {
  /** Qué vínculo directo de la idea se mira. */
  campo: CampoVinculoIdea
  id: number
}

const ENLACE = 'rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/**
 * Ideas ligadas directamente a un proyecto u objetivo (8.4d), solo lectura: sin crear, editar, concluir ni borrar
 * (eso se hace en `/ideas`). Sale de `useIdeas` (`['ideas']`), así que cualquier cambio hecho en Ideas se ve aquí.
 * Vive en `ideas/` para que `jerarquia/` no importe de `ideas/`; las páginas de detalle la pasan como sección.
 */
export function IdeasLigadas({ campo, id }: Props) {
  const ideas = useIdeas()
  const ligadas = useMemo(() => (ideas.data ? ideasLigadas(ideas.data, campo, id) : undefined), [ideas.data, campo, id])
  const ruta = rutaIdeasDe(campo, id)

  return (
    <Tarjeta titulo="Ideas ligadas">
      {ideas.isPending && <TextoVacio>Cargando ideas…</TextoVacio>}
      {ideas.error && <ErrorEnLinea mensaje={ideas.error.message} />}
      {ligadas && ligadas.total === 0 && <TextoVacio>Aún no hay ideas ligadas</TextoVacio>}
      {ligadas && ligadas.total > 0 && (
        <>
          <ul className="flex flex-col">
            {ligadas.visibles.map((idea) => (
              <Fila key={idea.id} idea={idea} />
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-3 text-sm">
            {ligadas.ocultas > 0 && (
              <Link to={ruta} className={ENLACE}>
                {textoMasIdeas(ligadas.ocultas)}
              </Link>
            )}
            <Link to={ruta} className={ENLACE}>
              Ver todas en Ideas
            </Link>
          </p>
        </>
      )}
    </Tarjeta>
  )
}

function Fila({ idea }: { idea: Idea }) {
  const concluida = idea.estado === 'CONCLUIDA'
  const Icono = concluida ? CircleCheck : Lightbulb
  return (
    <li className="border-b border-line py-3 last:border-b-0">
      <span className="font-medium break-words">{idea.titulo}</span>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mut">
        {/* Estado en texto además del ícono: no depende solo del color. */}
        <span className="inline-flex items-center gap-1">
          <Icono className={concluida ? 'size-4 text-mut' : 'size-4 text-gold'} aria-hidden="true" />
          {concluida ? 'Concluida' : 'Planteada'}
        </span>
        <span>
          {concluida ? 'Cerrada el' : 'Creada el'} {formatearFechaCorta(fechaDeOrden(idea))}
        </span>
      </div>
      {idea.conclusion && (
        <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm break-words whitespace-pre-line text-tx">
          <span className="font-medium">Conclusión: </span>
          {idea.conclusion}
        </p>
      )}
    </li>
  )
}
