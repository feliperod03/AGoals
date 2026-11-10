import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { PrioridadChip } from '@/components/PrioridadChip'
import { Button } from '@/components/ui/button'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { BuscadorTareas } from '@/features/agenda/BuscadorTareas'
import { EstadoIcono } from '@/features/agenda/EstadoIcono'
import { useTodasLasTareas } from '@/features/agenda/useTodasLasTareas'
import { armarArbol, type NodoCofre } from '@/features/cofre/arbol'
import { formatearDiaMes } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { candidatasTareaParaDestino, type TipoVinculo } from './candidatosVinculo'
import { useVincularTarea } from './useVincularTarea'

interface Props {
  /** Qué vínculo directo de la tarea se mira. */
  campo: 'proyectoId' | 'objetivoId'
  id: number
  titulo: string
  /** Frase bajo el título (p. ej. dónde ver las tareas que no están en esta sección). */
  aclaracion?: string
  textoVacio: string
  /** Nombre del proyecto/objetivo (para los avisos). */
  nombre: string
  /** Solo con el proyecto/objetivo abierto se ofrece «Vincular una existente» (como «Agregar proyecto» de 8.4a2). */
  abierto: boolean
  /** Aviso flotante de la página (la región `status` es única por página). */
  alMensaje: (mensaje: string) => void
}

/**
 * Tareas ligadas directamente a un proyecto u objetivo, con «Quitar» en cada una (solo las ligadas directamente,
 * no las subtareas anidadas) y «Vincular una existente» (8.4b). No hay «crear nueva ya ligada»: serían un POST y un
 * PUT no atómicos. Sale de `useTodasLasTareas` (`['tareas','todas']`): cada mutación de tarea ya invalida el prefijo `['tareas']`,
 * así que se mantiene fresca sin código extra. Las subtareas ligadas también se anidan bajo su madre.
 */
export function TareasLigadas({ campo, id, titulo, aclaracion, textoVacio, nombre, abierto, alMensaje }: Props) {
  const tipo: TipoVinculo = campo === 'proyectoId' ? 'proyecto' : 'objetivo'
  const tareas = useTodasLasTareas()
  // Mismas claves que el resto de la app (la página ya las tiene en caché); sirven para nombrar el otro proyecto/objetivo.
  const nombres = useQuery({
    queryKey: [tipo === 'proyecto' ? 'proyectos' : 'objetivos'],
    queryFn: tipo === 'proyecto' ? getProyectos : getObjetivos,
  })
  const vinculo = useVincularTarea({ alMensaje })
  const [vinculando, setVinculando] = useState(false)
  const destino = { id, nombre }
  const candidatas = useMemo(
    () => (tareas.data ? candidatasTareaParaDestino(tipo, id, tareas.data, nombres.data) : []),
    [tipo, id, tareas.data, nombres.data],
  )
  const nodos = useMemo(() => {
    const todas = tareas.data
    if (!todas) return undefined
    const ligadas = todas
      .filter((t) => t[campo] === id)
      .sort((a, b) => Number(esCerrada(a.estado)) - Number(esCerrada(b.estado)) || normalizarTexto(a.titulo).localeCompare(normalizarTexto(b.titulo), 'es') || a.id - b.id)
    return { total: ligadas.length, nodos: armarArbol(todas, ligadas) }
  }, [tareas.data, campo, id])

  return (
    <Tarjeta titulo={titulo}>
      {aclaracion && <p className="mb-3 text-sm text-mut">{aclaracion}</p>}
      {abierto && tareas.data && (
        <div className="mb-3 flex flex-col gap-3">
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={vinculo.pendiente}
              aria-expanded={vinculando}
              aria-controls={`ligadas-vincular-${campo}`}
              onClick={() => setVinculando((v) => !v)}
            >
              Vincular una existente
            </Button>
          </div>
          {vinculando && (
            <BuscadorTareas
              idInput={`ligadas-buscar-${campo}`}
              idPanel={`ligadas-vincular-${campo}`}
              etiqueta="Buscar tarea"
              candidatas={candidatas}
              deshabilitado={vinculo.pendiente}
              // Solo se cierra tras un éxito: con un error el buscador sigue abierto y el mensaje a la vista.
              alElegir={(tarea) => vinculo.asignar({ tipo, tarea, destino, alExito: () => setVinculando(false) })}
            />
          )}
        </div>
      )}
      {vinculo.error && (
        <div className="mb-3">
          <ErrorEnLinea mensaje={vinculo.error} />
        </div>
      )}
      {tareas.isPending && <TextoVacio>Cargando tareas…</TextoVacio>}
      {tareas.error && <ErrorEnLinea mensaje={tareas.error.message} />}
      {nodos && nodos.total === 0 && <TextoVacio>{textoVacio}</TextoVacio>}
      {nodos && nodos.total > 0 && (
        <ul className="flex flex-col">
          {nodos.nodos.map((nodo) => (
            <Fila key={nodo.tarea.id} nodo={nodo} campo={campo} id={id} tipo={tipo} pendiente={vinculo.pendiente} alQuitar={(tarea) => vinculo.quitar({ tipo, tarea, destino })} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

const esCerrada = (estado: string) => estado === 'HECHO' || estado === 'CANCELADO'

interface PropsFila {
  nodo: NodoCofre
  campo: Props['campo']
  id: number
  tipo: TipoVinculo
  pendiente: boolean
  alQuitar: (tarea: Tarea) => void
}

function Fila({ nodo, ...resto }: PropsFila) {
  const { campo, id, tipo, pendiente, alQuitar } = resto
  const { tarea, subtareas, madre } = nodo
  const cerrada = esCerrada(tarea.estado)
  // Las subtareas anidadas bajo su madre pueden no ser del proyecto/objetivo: solo se quita lo ligado directamente.
  const directa = tarea[campo] === id
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 py-2">
        <EstadoIcono estado={tarea.estado} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex w-full min-w-0 items-center gap-3">
            <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
            {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
          </span>
          <span className="flex flex-wrap gap-x-3 text-xs text-mut">
            <span>{tarea.fecha ? formatearDiaMes(tarea.fecha) : 'Sin fecha'}</span>
            {madre && <span>Subtarea de «{madre}»</span>}
          </span>
        </div>
        {directa && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pendiente}
            aria-label={`Quitar «${tarea.titulo}» del ${tipo}`}
            onClick={() => alQuitar(tarea)}
          >
            Quitar
          </Button>
        )}
      </div>
      {subtareas.length > 0 && (
        <ul className="ml-6 flex flex-col border-l border-line pl-3">
          {subtareas.map((hija) => (
            <Fila key={hija.tarea.id} nodo={hija} {...resto} />
          ))}
        </ul>
      )}
    </li>
  )
}
