import { aFechaLocal, formatearMinutos, minutosDelDia } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { PX_POR_HORA, calcularRango, distribuirSolapes, posicionBloque, type Bloque, type BloqueColocado, type Rango } from './horario'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'

interface Props {
  bloques: Bloque[]
  /** Día que se muestra (YYYY-MM-DD) y el instante actual, para decidir si va la línea de "ahora". */
  fecha: string
  ahora: Date
  cargando: boolean
  errores: string[]
  alEditar: (tarea: Tarea) => void
}

/** Tarjeta "Planificación por horas": línea de tiempo con tareas con hora y eventos. */
export function PlanificacionPorHoras({ bloques, fecha, ahora, cargando, errores, alEditar }: Props) {
  const rango = calcularRango(bloques)
  const colocados = distribuirSolapes(bloques)
  const horas = Array.from({ length: rango.finHora - rango.inicioHora + 1 }, (_, i) => rango.inicioHora + i)
  const alto = (rango.finHora - rango.inicioHora) * PX_POR_HORA

  // La línea de "ahora" solo existe si se mira el día de hoy y la hora cae dentro del rango.
  const esHoy = fecha === aFechaLocal(ahora)
  const minAhora = minutosDelDia(ahora, fecha)
  const mostrarAhora = esHoy && minAhora >= rango.inicioHora * 60 && minAhora <= rango.finHora * 60
  const topAhora = (minAhora - rango.inicioHora * 60) * (PX_POR_HORA / 60)

  return (
    <Tarjeta titulo="Planificación por horas">
      {cargando && <TextoVacio>Cargando tu agenda…</TextoVacio>}
      {errores.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {errores.map((e) => (
            <ErrorEnLinea key={e} mensaje={e} />
          ))}
        </div>
      )}
      {!cargando && bloques.length === 0 && errores.length === 0 && (
        <TextoVacio>No hay nada planificado por horas para hoy.</TextoVacio>
      )}

      <div className="py-3">
        <div className="relative" style={{ height: alto }}>
          {horas.map((hora) => (
            <div key={hora} className="absolute inset-x-0" style={{ top: (hora - rango.inicioHora) * PX_POR_HORA }}>
              <span className="absolute top-0 -translate-y-1/2 text-xs text-mut tabular-nums">{formatearMinutos(hora * 60)}</span>
              <div className="absolute right-0 left-14 border-t border-line" />
            </div>
          ))}

          <div className="absolute inset-y-0 right-0 left-14">
            {colocados.map((b) => (
              <BloqueVista key={b.clave} bloque={b} rango={rango} alEditar={alEditar} />
            ))}
          </div>

          {mostrarAhora && (
            <div
              data-testid="linea-ahora"
              role="img"
              aria-label={'Ahora, ' + formatearMinutos(minAhora)}
              className="pointer-events-none absolute right-0 left-12 z-10 flex items-center"
              style={{ top: topAhora }}
            >
              <span className="size-2.5 shrink-0 rounded-full bg-ahora" />
              <span className="h-0.5 flex-1 bg-ahora" />
            </div>
          )}
        </div>
      </div>
    </Tarjeta>
  )
}

function BloqueVista({ bloque, rango, alEditar }: { bloque: BloqueColocado; rango: Rango; alEditar: (tarea: Tarea) => void }) {
  const { top, height } = posicionBloque(bloque.inicioMin, bloque.finMin, rango)
  const esEvento = bloque.tipo === 'evento'
  const cerrada = bloque.estado === 'HECHO' || bloque.estado === 'CANCELADO'
  const etiqueta = (esEvento ? 'EVENTO' : 'TAREA') + ' · ' + formatearMinutos(bloque.inicioMin) + '–' + formatearMinutos(bloque.finMin)
  const corto = height < 48

  const tarea = bloque.tarea
  const Elemento = tarea ? 'button' : 'div'

  return (
    <Elemento
      {...(tarea ? { type: 'button' as const, onClick: () => alEditar(tarea) } : {})}
      className={cn(
        'absolute overflow-hidden rounded-xl px-2.5 py-1 text-left text-xs',
        esEvento ? 'bg-evento text-evento-tx' : 'bg-tarea text-tarea-tx',
        corto ? 'flex items-center gap-2' : 'flex flex-col justify-start',
        tarea && 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
      title={etiqueta + ' — ' + bloque.titulo}
      style={{
        top,
        height: height - 2,
        left: (bloque.columna / bloque.totalColumnas) * 100 + '%',
        width: 'calc(' + 100 / bloque.totalColumnas + '% - 4px)',
      }}
    >
      <span className="min-w-0 truncate font-semibold tracking-wide whitespace-nowrap">{etiqueta}</span>
      <span className={cn('min-w-0 truncate text-sm', cerrada && 'line-through opacity-80')}>{bloque.titulo}</span>
    </Elemento>
  )
}
