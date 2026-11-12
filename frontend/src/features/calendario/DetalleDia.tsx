import { Plus } from 'lucide-react'

import { PrioridadChip } from '@/components/PrioridadChip'
import { Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { EstadoIcono } from '@/features/agenda/EstadoIcono'
import { esAtrasada, formatearDiaSemana } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Evento } from '@/types/evento'
import { ATRIBUTO_EVENTO, etiquetaEditarEvento, textoHora, type ElementoDia } from './calendario'

interface PropsDetalle {
  fecha: string
  hoy: string
  elementos: ElementoDia[]
  /** Abre la edición de un evento (las filas de evento son botones). */
  alAbrirEvento?: (evento: Evento) => void
  /** «Agregar evento» al pie: crea uno en este día. */
  alAgregarEvento?: (fecha: string) => void
}

/**
 * Panel con todo lo del día elegido: eventos y tareas en el orden de la celda, con hora, estado y prioridad. Las filas
 * de evento abren su edición (9c); las de tarea siguen siendo de solo lectura. El título cambia con el día, pero no
 * es una región viva (el foco ya está en el día y su etiqueta se anuncia).
 */
export function DetalleDia({ fecha, hoy, elementos, alAbrirEvento, alAgregarEvento }: PropsDetalle) {
  return (
    <Tarjeta titulo={formatearDiaSemana(fecha)} className="@container">
      {elementos.length === 0 ? (
        <TextoVacio>Nada para este día.</TextoVacio>
      ) : (
        // Con el panel ancho (debajo de la cuadrícula) la lista se reparte en dos columnas; el orden del DOM no cambia.
        <ul className="grid gap-2 @min-[600px]:grid-cols-2">
          {elementos.map((e) => (
            <FilaDetalle key={e.clave} elemento={e} hoy={hoy} alAbrirEvento={alAbrirEvento} />
          ))}
        </ul>
      )}
      {alAgregarEvento && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          aria-label={`Agregar evento el ${formatearDiaSemana(fecha)}`}
          onClick={() => alAgregarEvento(fecha)}
        >
          <Plus aria-hidden="true" />
          Agregar evento
        </Button>
      )}
    </Tarjeta>
  )
}

/**
 * Una fila del detalle (tipo, hora, «Atrasada», prioridad, estado y título). También la usa la lista de la semana.
 * Con `alAbrirEvento`, la fila de un evento lleva un botón vacío que la cubre entera (hermano del contenido, que pasa
 * a `aria-hidden`: el nombre lo da el botón, «Editar evento: Reunión, 09:00–10:00»).
 */
export function FilaDetalle({ elemento, hoy, alAbrirEvento }: { elemento: ElementoDia; hoy: string; alAbrirEvento?: (evento: Evento) => void }) {
  const esEvento = elemento.tipo === 'evento'
  const hora = textoHora(elemento)
  const hecha = elemento.tipo === 'tarea' && elemento.estado === 'HECHO'
  const atrasada =
    elemento.tipo === 'tarea' && elemento.estado !== 'HECHO' && esAtrasada(elemento.tarea.fecha, hoy)

  const editable = elemento.tipo === 'evento' && alAbrirEvento !== undefined

  return (
    <li
      {...(elemento.tipo === 'evento' ? { [ATRIBUTO_EVENTO]: elemento.evento.id } : {})}
      className={cn('relative flex flex-col gap-1.5 rounded-xl border border-line px-3 py-2', editable && 'hover:bg-side')}
    >
      {elemento.tipo === 'evento' && alAbrirEvento && (
        <button
          type="button"
          aria-label={etiquetaEditarEvento(elemento)}
          onClick={() => alAbrirEvento(elemento.evento)}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      )}
      <div aria-hidden={editable || undefined} className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 font-semibold tracking-wide',
            esEvento ? 'bg-evento text-evento-tx' : 'bg-tarea text-tarea-tx',
          )}
        >
          {esEvento ? 'EVENTO' : 'TAREA'}
        </span>
        {hora && <span className="text-mut">{hora}</span>}
        {atrasada && <span className="font-semibold text-alta">Atrasada</span>}
        {elemento.prioridad && <PrioridadChip prioridad={elemento.prioridad} />}
      </div>
      <div aria-hidden={editable || undefined} className="flex items-start gap-2">
        {elemento.tipo === 'tarea' && <EstadoIcono estado={elemento.estado} />}
        <span className={cn('min-w-0 break-words', hecha && 'text-mut line-through')}>{elemento.titulo}</span>
      </div>
    </li>
  )
}
