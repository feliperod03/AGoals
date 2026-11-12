import { ArrowDownUp } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { OrdenRecomendacion, SentidoOrden } from '@/types/tarea'
import { ErrorEnLinea, TextoVacio } from '@/components/Tarjeta'
import { useAgendarTarea } from '@/features/agenda/useAgendarTarea'
import { FiltroVinculo } from './FiltroVinculo'
import { HorizonteFuturas } from './HorizonteFuturas'
import { ListaRecomendada } from './ListaRecomendada'
import { useRecomendacion } from './useRecomendacion'

interface Props {
  abierto: boolean
  alCerrar: () => void
  /** El "hoy" del cliente (de `useAhora`). */
  hoy: string
  /** Último aviso de la página: se repite en una región viva dentro del diálogo. */
  aviso: string
  alAvisar: (mensaje: string) => void
}

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

const ETIQUETA_SENTIDO: Record<OrdenRecomendacion, Record<SentidoOrden, string>> = {
  prioridad: { desc: 'Alta primero', asc: 'Baja primero' },
  antiguedad: { desc: 'Más antiguas primero', asc: 'Más recientes primero' },
}

/**
 * Diálogo de recomendación. El contenido se monta de nuevo cada vez que se abre, así que orden, filtro y
 * consultas empiezan de cero. Radix deja el resto de la página con `aria-hidden` mientras está abierto:
 * por eso el aviso de "agendada" también se escribe en una región viva propia.
 */
export function RecomendacionDialog({ abierto, alCerrar, hoy, aviso, alAvisar }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && alCerrar()}>
      <DialogContent className="max-w-2xl">{abierto && <Contenido hoy={hoy} aviso={aviso} alAvisar={alAvisar} />}</DialogContent>
    </Dialog>
  )
}

function Contenido({ hoy, aviso, alAvisar }: Pick<Props, 'hoy' | 'aviso' | 'alAvisar'>) {
  const r = useRecomendacion(hoy)
  const agendar = useAgendarTarea({ hoy, alAgendar: alAvisar })

  const proyectos = useMemo(() => new Map((r.proyectos.data ?? []).map((p) => [p.id, p.nombre])), [r.proyectos.data])
  const objetivos = useMemo(() => new Map((r.objetivos.data ?? []).map((o) => [o.id, o.nombre])), [r.objetivos.data])
  const errorListados = r.proyectos.error?.message ?? r.objetivos.error?.message ?? null

  const ordenBoton = (valor: OrdenRecomendacion) =>
    cn('rounded-full border px-3 py-1 text-sm', FOCO, r.orden === valor ? 'border-acc bg-acc text-acc-tx' : 'border-line bg-card hover:bg-muted')

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Recomendación</DialogTitle>
        <DialogDescription>
          Tareas abiertas sin fecha o atrasadas{r.horizonte !== null && `, o con fecha en los próximos ${r.horizonte} días`}, para armar tu día.
        </DialogDescription>
      </div>

      {/* Región viva propia: la de la página queda oculta a los lectores de pantalla mientras el diálogo está abierto. */}
      <p role="status" aria-live="polite" className={aviso ? 'text-sm text-tx' : 'sr-only'}>
        {aviso}
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Ordenar por" className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-mut" aria-hidden="true">
              Ordenar por
            </span>
            <button type="button" aria-pressed={r.orden === 'prioridad'} className={ordenBoton('prioridad')} onClick={() => r.setOrden('prioridad')}>
              Prioridad
            </button>
            <button type="button" aria-pressed={r.orden === 'antiguedad'} className={ordenBoton('antiguedad')} onClick={() => r.setOrden('antiguedad')}>
              Antigüedad
            </button>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label={`Invertir el sentido (ahora: ${ETIQUETA_SENTIDO[r.orden][r.sentido]})`} onClick={r.invertirSentido}>
            <ArrowDownUp aria-hidden="true" />
            {ETIQUETA_SENTIDO[r.orden][r.sentido]}
          </Button>
        </div>
        <HorizonteFuturas horizonte={r.horizonte} alEncender={r.setIncluirFuturas} alElegir={r.setHorizonte} deshabilitado={agendar.isPending} />
        <FiltroVinculo
          filtro={r.filtro}
          alCambiar={r.setFiltro}
          proyectos={r.proyectos.data?.map((p) => ({ id: p.id, nombre: p.nombre }))}
          objetivos={r.objetivos.data?.map((o) => ({ id: o.id, nombre: o.nombre }))}
          error={errorListados}
          deshabilitado={agendar.isPending}
        />
      </div>

      {agendar.error && <ErrorEnLinea mensaje={agendar.error.message} />}

      {r.recomendacion.isPending && <TextoVacio>Cargando recomendaciones…</TextoVacio>}
      {r.recomendacion.error && <ErrorEnLinea mensaje={r.recomendacion.error.message} />}
      {r.recomendacion.data && r.recomendacion.data.length === 0 && <TextoVacio>
          {r.horizonte === null ? 'No hay tareas para recomendar' : `No hay tareas para recomendar ni para los próximos ${r.horizonte} días.`}
        </TextoVacio>}
      {r.recomendacion.data && r.recomendacion.data.length > 0 && (
        <ListaRecomendada
          tareas={r.recomendacion.data}
          hoy={hoy}
          proyectos={proyectos}
          objetivos={objetivos}
          pendiente={agendar.isPending}
          alAgendar={(raiz, incluirSubtareas) => agendar.mutate({ tarea: raiz.tarea, incluirSubtareas })}
        />
      )}
    </div>
  )
}
