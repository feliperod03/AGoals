import { useState } from 'react'

import { formatearFechaLarga, formatearHora, hoy } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { PrioridadChip } from './PrioridadChip'
import { useAgendaDelDia } from './useAgendaDelDia'

/** Página Hoy (rebanada 8.0): solo lista las tareas del día, sin acciones. */
export function HoyPage() {
  // Se fija al montar: así la página no cambia de día sola a medianoche sin recargar.
  const [fecha] = useState(hoy)
  const { data, isPending, error } = useAgendaDelDia(fecha)

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-4xl">Hoy</h1>
        <p className="mt-1 text-sm text-mut first-letter:uppercase">{formatearFechaLarga(fecha)}</p>
      </header>

      {isPending && <p className="text-mut">Cargando tu agenda…</p>}

      {error && (
        <p role="alert" className="rounded-card border border-alta bg-card p-4 text-tx">
          {error.message}
        </p>
      )}

      {data && data.conHora.length === 0 && data.sinHora.length === 0 && (
        <p className="rounded-card bg-card p-6 text-mut shadow-card">No tienes tareas para hoy.</p>
      )}

      {data && data.conHora.length > 0 && <ListaTareas titulo="Planificación por horas" tareas={data.conHora} />}
      {data && data.sinHora.length > 0 && <ListaTareas titulo="Lista del día" tareas={data.sinHora} />}
    </section>
  )
}

function ListaTareas({ titulo, tareas }: { titulo: string; tareas: Tarea[] }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-xl">{titulo}</h2>
      <ul className="flex flex-col gap-2">
        {tareas.map((tarea) => (
          <FilaTarea key={tarea.id} tarea={tarea} />
        ))}
      </ul>
    </div>
  )
}

function FilaTarea({ tarea }: { tarea: Tarea }) {
  const cerrada = tarea.estado === 'HECHO' || tarea.estado === 'CANCELADO'
  return (
    <li className="flex items-center gap-3 rounded-card bg-card px-4 py-3 shadow-card">
      {tarea.horaInicio && (
        <span className="w-24 shrink-0 text-sm font-medium text-mut">
          {formatearHora(tarea.horaInicio)}
          {tarea.horaFin && `–${formatearHora(tarea.horaFin)}`}
        </span>
      )}
      <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
      {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
    </li>
  )
}
