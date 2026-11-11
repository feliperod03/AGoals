import { PrioridadChip } from '@/components/PrioridadChip'
import { Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { EstadoIcono } from '@/features/agenda/EstadoIcono'
import { esAtrasada, formatearDiaSemana } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { textoHora, type ElementoDia } from './calendario'

/**
 * Panel de solo lectura con todo lo del día elegido: eventos y tareas en el orden de la celda, con hora, estado y
 * prioridad. El título cambia con el día, pero no es una región viva (el foco ya está en el día y su etiqueta se anuncia).
 */
export function DetalleDia({ fecha, hoy, elementos }: { fecha: string; hoy: string; elementos: ElementoDia[] }) {
  return (
    <Tarjeta titulo={formatearDiaSemana(fecha)} className="@container">
      {elementos.length === 0 ? (
        <TextoVacio>Nada para este día.</TextoVacio>
      ) : (
        // Con el panel ancho (debajo de la cuadrícula) la lista se reparte en dos columnas; el orden del DOM no cambia.
        <ul className="grid gap-2 @min-[600px]:grid-cols-2">
          {elementos.map((e) => (
            <FilaDetalle key={e.clave} elemento={e} hoy={hoy} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

/** Una fila del detalle (tipo, hora, «Atrasada», prioridad, estado y título). También la usa la lista de la semana. */
export function FilaDetalle({ elemento, hoy }: { elemento: ElementoDia; hoy: string }) {
  const esEvento = elemento.tipo === 'evento'
  const hora = textoHora(elemento)
  const hecha = elemento.tipo === 'tarea' && elemento.estado === 'HECHO'
  const atrasada =
    elemento.tipo === 'tarea' && elemento.estado !== 'HECHO' && esAtrasada(elemento.tarea.fecha, hoy)

  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
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
      <div className="flex items-start gap-2">
        {elemento.tipo === 'tarea' && <EstadoIcono estado={elemento.estado} />}
        <span className={cn('min-w-0 break-words', hecha && 'text-mut line-through')}>{elemento.titulo}</span>
      </div>
    </li>
  )
}
